"""Caveo web app: inbox, cases, audit log, human approval."""
import json, pathlib, re, subprocess, threading, time, uuid
from collections import defaultdict, deque
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import pipeline, store

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
UPLOADS = DATA / "uploads"
ALLOWED = {".pdf", ".html", ".htm", ".png", ".jpg", ".jpeg"}
MAX_BYTES = 5 * 1024 * 1024
_sem = threading.BoundedSemaphore(3)  # at most 3 sandboxes at once on one VM

app = FastAPI(title="Caveo")
store.init()


def _inbox():
    return [json.loads(p.read_text()) for p in sorted((DATA / "inbox").glob("*.json"))]


_hits = defaultdict(deque)


def _rate_limit(req: Request, limit=12, window=600):
    """Public demo: cap sandbox runs per client so nobody can burn the inference budget."""
    ip = req.headers.get("x-forwarded-for", req.client.host).split(",")[0].strip()
    q, now = _hits[ip], time.time()
    while q and now - q[0] > window:
        q.popleft()
    if len(q) >= limit:
        raise HTTPException(429, "Demo limit reached: 12 sandbox runs per 10 minutes. Try again shortly.")
    q.append(now)


def _start(email, att_dir):
    cid = pipeline.new_case(email)

    def run():
        with _sem:
            pipeline.process(cid, email, att_dir)
    threading.Thread(target=run, daemon=True).start()
    return cid


@app.get("/api/inbox")
def inbox():
    latest = {}
    for c in store.list_cases():
        latest.setdefault(c["email_id"], c)
    emails = [c["data"]["email"] for c in latest.values() if c["email_id"].startswith("up-")] + _inbox()
    return [{**e, "case": {k: latest[e["id"]][k] for k in ("id", "status", "risk", "decision")} if e["id"] in latest else None}
            for e in emails]


@app.get("/api/stats")
def stats():
    live = subprocess.run(["docker", "ps", "-q", "--filter", "name=caveo-sbx-"], capture_output=True, text=True).stdout.split()
    return {"live": len(live), **store.stats()}


@app.post("/api/inbox/{email_id}/process")
def process(email_id: str, req: Request):
    _rate_limit(req)
    email = next((e for e in _inbox() if e["id"] == email_id), None)
    if not email:
        raise HTTPException(404)
    return {"case_id": _start(email, DATA / "attachments")}


@app.post("/api/upload")
async def upload(file: UploadFile = File(...), from_email: str = Form("unknown@external.example"),
                 from_name: str = Form("Uploaded by user"), subject: str = Form("Uploaded invoice"), body: str = Form(""),
                 req: Request = None):
    _rate_limit(req)
    ext = pathlib.Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED:
        raise HTTPException(400, f"Allowed: {', '.join(sorted(ALLOWED))}")
    raw = await file.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise HTTPException(400, "Max 5 MB")
    uid = "up-" + uuid.uuid4().hex[:8]
    d = UPLOADS / uid
    d.mkdir(parents=True)
    name = re.sub(r"[^A-Za-z0-9._-]", "_", pathlib.Path(file.filename).name)[:80] or "upload" + ext
    (d / name).write_bytes(raw)
    email = {"id": uid, "from_name": from_name[:80], "from_email": from_email[:120], "subject": subject[:200],
             "body": body[:4000], "received_at": time.strftime("%Y-%m-%dT%H:%M:%S"), "attachments": [name]}
    return {"case_id": _start(email, d)}


@app.get("/api/cases")
def cases():
    return [{k: c[k] for k in ("id", "email_id", "created", "status", "risk", "decision")} | {"email": c["data"]["email"]}
            for c in store.list_cases()]


@app.get("/api/cases/{cid}")
def case(cid: str):
    c = store.get_case(cid)
    if not c:
        raise HTTPException(404)
    return c


class Decision(BaseModel):
    action: str  # approve | reject | escalate
    note: str = ""
    callback_verified: bool = False


@app.post("/api/cases/{cid}/decision")
def decide(cid: str, d: Decision):
    c = store.get_case(cid)
    if not c or c["status"] != "awaiting_human":
        raise HTTPException(409, "Case is not awaiting a decision")
    if d.action == "approve":
        if c["decision"] == "quarantined":
            raise HTTPException(403, "Quarantined cases cannot be approved for payment. Reject or escalate to security.")
        if c["decision"] == "hold" and not d.callback_verified:
            raise HTTPException(403, "Confirm you verified the vendor by calling the number on file.")
    if d.action not in ("approve", "reject", "escalate"):
        raise HTTPException(400)
    status = {"approve": "approved", "reject": "rejected", "escalate": "escalated"}[d.action]
    store.update_case(cid, status=status, data={"human": {"action": d.action, "note": d.note[:500],
                                                         "callback_verified": d.callback_verified, "at": time.time()}})
    store.log(cid, "human", {"approve": "Human approved payment", "reject": "Human rejected the invoice",
                             "escalate": "Human escalated to security"}[d.action] + (f": {d.note[:200]}" if d.note else ""))
    return {"status": status}


@app.post("/api/reset")
def reset():
    store.reset()
    return {"ok": True}


@app.get("/runs/{cid}/{name}")
def run_file(cid: str, name: str):
    p = (DATA / "runs" / cid / name).resolve()
    if not str(p).startswith(str((DATA / "runs").resolve())) or not p.is_file():
        raise HTTPException(404)
    return FileResponse(p)


app.mount("/", StaticFiles(directory=ROOT / "app" / "static", html=True), name="static")
