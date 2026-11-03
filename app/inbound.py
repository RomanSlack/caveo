"""Real inbox: polls Resend's Receiving API and turns every inbound email into a Caveo case.

Anyone can email an invoice to the Resend inbound address (RESEND_INBOUND_ADDRESS). The poller downloads only
supported attachments (PDF/HTML/PNG/JPG, <= 5 MB) to disk, never opens them on the host, and hands them to the
same sandbox pipeline. SPF/DKIM/DMARC results from Resend become evidence for the policy engine.
"""
import email.utils, json, os, pathlib, re, threading, time, urllib.request
import store

API = "https://api.resend.com"
KEY = os.environ.get("RESEND_API_KEY", "")
ADDRESS = os.environ.get("RESEND_INBOUND_ADDRESS", "")
ALLOWED = {".pdf", ".html", ".htm", ".png", ".jpg", ".jpeg"}
MAX_BYTES = 5 * 1024 * 1024
POLL_S = int(os.environ.get("RESEND_POLL_SECONDS", "8"))
PER_SENDER_PER_HOUR = 6
GLOBAL_PER_HOUR = 60
status = {"enabled": bool(KEY), "address": ADDRESS, "last_poll": None, "last_error": None, "received": 0}


def _get(path):
    req = urllib.request.Request(API + path, headers={"Authorization": "Bearer " + KEY, "User-Agent": "caveo-inbound/1.0"})
    return json.load(urllib.request.urlopen(req, timeout=20))


def _download(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "caveo-inbound/1.0"}), timeout=30) as r:
        data = r.read(MAX_BYTES + 1)
    return data if len(data) <= MAX_BYTES else None


def _strip_html(h):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", re.sub(r"(?is)<(script|style).*?</\1>", " ", h or ""))).strip()


def _ok_rate(sender):
    now = time.time()
    with store._lock, store._conn() as c:
        total = c.execute("SELECT COUNT(*) FROM inbound WHERE ts > ? AND processed = 1", (now - 3600,)).fetchone()[0]
        mine = c.execute("SELECT COUNT(*) FROM inbound WHERE ts > ? AND processed = 1 AND sender = ?", (now - 3600, sender)).fetchone()[0]
    return total < GLOBAL_PER_HOUR and mine < PER_SENDER_PER_HOUR


def _handle(item, start_case, uploads):
    rid = item["id"]
    full = _get(f"/emails/receiving/{rid}")
    name, addr = email.utils.parseaddr(full.get("from") or item.get("from") or "")
    addr = (addr or "unknown@external.example").lower()[:120]
    atts = [a for a in (full.get("attachments") or []) if pathlib.Path(a.get("filename") or "").suffix.lower() in ALLOWED
            and (a.get("size") or 0) <= MAX_BYTES and (a.get("content_disposition") or "attachment") != "inline"]
    store.inbound_mark(rid, addr, processed=0)
    if not atts:
        status["last_error"] = f"{addr}: no PDF/HTML/image attachment, skipped"
        return
    if not _ok_rate(addr):
        status["last_error"] = f"{addr}: rate limited"
        return
    d = uploads / f"in-{rid[:8]}"
    d.mkdir(parents=True, exist_ok=True)
    names = []
    for a in atts[:3]:
        meta = _get(f"/emails/receiving/{rid}/attachments/{a['id']}")
        data = _download(meta["download_url"])
        if data is None:
            continue
        fn = re.sub(r"[^A-Za-z0-9._-]", "_", pathlib.Path(a["filename"]).name)[:80]
        (d / fn).write_bytes(data)
        names.append(fn)
    if not names:
        return
    body = full.get("text") or _strip_html(full.get("html"))
    e = {"id": f"in-{rid[:8]}", "from_name": (name or addr.split("@")[0])[:80], "from_email": addr,
         "subject": (full.get("subject") or "(no subject)")[:200], "body": (body or "")[:4000],
         "received_at": full.get("created_at") or time.strftime("%Y-%m-%dT%H:%M:%S"), "attachments": names,
         "inbound": True, "auth": full.get("authentication") or {}}
    store.inbound_mark(rid, addr, processed=1)
    start_case(e, d)
    status["received"] += 1


STARTED = time.time()


def _new(item):
    """Only mail that arrives after this server started; never replay an old inbox."""
    try:
        from datetime import datetime
        return datetime.fromisoformat(item["created_at"].replace("Z", "+00:00")).timestamp() >= STARTED - 5
    except Exception:
        return False


def poll_forever(start_case, uploads):
    if not KEY:
        return
    while True:
        try:
            listing = _get("/emails/receiving?limit=20")
            for item in reversed(listing.get("data") or []):
                if not store.inbound_seen(item["id"]):
                    if not _new(item):
                        store.inbound_mark(item["id"], "(before start)", processed=0)
                        continue
                    try:
                        _handle(item, start_case, uploads)
                    except Exception as e:
                        store.inbound_mark(item["id"], "?", processed=0)
                        status["last_error"] = f"{e.__class__.__name__}: {e}"[:200]
            status["last_poll"] = time.time()
        except Exception as e:
            status["last_error"] = f"{e.__class__.__name__}: {e}"[:200]
        time.sleep(POLL_S)


def start(start_case, uploads):
    if KEY:
        threading.Thread(target=poll_forever, args=(start_case, uploads), daemon=True).start()
