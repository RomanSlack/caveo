"""Runs INSIDE the throwaway sandbox container.

Opens one untrusted attachment mounted read-only at /job/<name>, records what it is
and everything it tries to do, and prints a single JSON report to stdout.
It never holds secrets and never talks to the host except through stdout.
"""
import base64, json, os, re, socket, sys, time

JOB_DIR = "/job"
MAX_PAGES = 3
report = {"probes": {}, "active_content": [], "network_attempts": [], "behaviors": [],
          "hidden_text": [], "links": [], "pages": [], "text": "", "errors": []}


def probe_containment():
    """Prove the walls are there: no egress, no DNS, no secrets, no writable system dirs."""
    p = report["probes"]
    try:
        socket.create_connection(("1.1.1.1", 443), timeout=2).close()
        p["egress"] = "OPEN"
    except OSError as e:
        p["egress"] = f"blocked ({e.__class__.__name__})"
    try:
        socket.gethostbyname("example.com")
        p["dns"] = "OPEN"
    except OSError as e:
        p["dns"] = f"blocked ({e.__class__.__name__})"
    names = sorted(os.environ)
    p["env_vars"] = names
    # GPG_KEY is the python base image's public release-signing key id, not a secret
    p["secret_like_env"] = [n for n in names if re.search(r"KEY|TOKEN|SECRET|PASS|AUTH", n, re.I) and n != "GPG_KEY"]
    try:
        open("/opt/caveo/pwned", "w").write("x")
        p["system_write"] = "OPEN"
    except OSError as e:
        p["system_write"] = f"blocked ({e.__class__.__name__})"
    p["uid"] = os.getuid()


def analyze_pdf(path):
    import fitz
    raw = open(path, "rb").read()
    for marker in ["/JavaScript", "/JS", "/OpenAction", "/AA", "/Launch", "/EmbeddedFile", "/SubmitForm", "/RichMedia"]:
        if re.search(re.escape(marker).encode() + rb"[\s/<(\[]", raw):
            report["active_content"].append(marker)
    doc = fitz.open(path)
    texts = []
    for i, page in enumerate(doc):
        texts.append(page.get_text())
        for link in page.get_links():
            if link.get("uri"):
                report["links"].append(link["uri"])
        rect = page.rect
        dark_fills = [d["rect"] for d in page.get_drawings()
                      if d.get("fill") and min(d["fill"][:3]) < 0.85]
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                for span in line["spans"]:
                    t = span["text"].strip()
                    if not t:
                        continue
                    c = span["color"]
                    r, g, b = (c >> 16) & 255, (c >> 8) & 255, c & 255
                    why = []
                    mid = fitz.Point((span["bbox"][0] + span["bbox"][2]) / 2, (span["bbox"][1] + span["bbox"][3]) / 2)
                    if min(r, g, b) >= 235 and not any(fr.contains(mid) for fr in dark_fills):
                        why.append("white-on-white text")
                    if span["size"] < 3:
                        why.append(f"tiny {span['size']:.1f}pt font")
                    x0, y0, x1, y1 = span["bbox"]
                    if x1 < 0 or y1 < 0 or x0 > rect.width or y0 > rect.height:
                        why.append("placed off-page")
                    if why:
                        report["hidden_text"].append({"page": i + 1, "text": t, "why": why, "bbox": [round(v, 1) for v in span["bbox"]],
                                                       "page_size": [rect.width, rect.height]})
        if i < MAX_PAGES:
            png = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5)).tobytes("png")
            report["pages"].append(base64.b64encode(png).decode())
    report["text"] = "\n".join(texts)[:20000]
    report["page_count"] = len(doc)
    try:
        report["embedded_files"] = [{"name": n, "size": doc.embfile_info(n).get("size")} for n in doc.embfile_names()]
    except Exception:
        report["embedded_files"] = []
    js = re.findall(rb"/JS\s*\((.{0,400}?)\)\s*>>", raw, re.S)
    report["pdf_scripts"] = [j.decode("latin-1").replace("\\(", "(").replace("\\)", ")") for j in js][:5]


INIT_HOOKS = r"""
(() => {
  const log = (kind, detail) => { try { window.__caveoLog(kind, String(detail).slice(0, 300)); } catch (e) {} };
  const cookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
  Object.defineProperty(document, 'cookie', {
    get() { log('read_cookies', 'document.cookie'); return cookie.get.call(document); },
    set(v) { log('write_cookie', v); return cookie.set.call(document, v); }
  });
  for (const fn of ['getItem', 'setItem']) {
    const orig = Storage.prototype[fn];
    Storage.prototype[fn] = function (...a) { log('storage_' + fn, a[0]); return orig.apply(this, a); };
  }
  const beacon = navigator.sendBeacon && navigator.sendBeacon.bind(navigator);
  navigator.sendBeacon = (u, d) => { log('beacon', u); return beacon ? beacon(u, d) : false; };
  if (navigator.clipboard) navigator.clipboard.readText = () => { log('clipboard_read', ''); return Promise.reject('blocked'); };
  window.open = (u) => { log('popup', u); return null; };
})();
"""


def analyze_html(path):
    from playwright.sync_api import sync_playwright
    own_url = "file://" + path
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"])
        ctx = browser.new_context(viewport={"width": 1100, "height": 1300}, java_script_enabled=True)
        ctx.expose_function("__caveoLog", lambda kind, detail: report["behaviors"].append({"kind": kind, "detail": detail}))
        ctx.add_init_script(INIT_HOOKS)

        def route(r):
            url = r.request.url
            if url == own_url or url.startswith("data:"):
                return r.continue_()
            report["network_attempts"].append({"method": r.request.method, "url": url[:300],
                                               "type": r.request.resource_type,
                                               "is_navigation": r.request.is_navigation_request()})
            if r.request.is_navigation_request():
                r.fulfill(status=204)  # 204 cancels the navigation, so the page under inspection stays loaded
            else:
                r.abort("blockedbyclient")
        ctx.route("**/*", route)
        page = ctx.new_page()
        page.on("console", lambda m: report["behaviors"].append({"kind": "console", "detail": m.text[:300]}))
        page.on("crash", lambda: report["behaviors"].append({"kind": "renderer_crash",
                                                             "detail": "page process died while allocating memory"}))
        try:
            page.goto(own_url, wait_until="load", timeout=10000)
        except Exception as e:
            report["errors"].append(f"load: {e.__class__.__name__}")
        time.sleep(4)  # let timers, beacons and delayed redirects fire
        try:
            report["forms"] = page.evaluate("""[...document.forms].map(f => ({action: f.action,
                password_fields: f.querySelectorAll('input[type=password]').length}))""")
            report["text"] = page.inner_text("body")[:20000]
            report["links"] = page.evaluate("[...document.links].map(a => a.href)")[:50]
        except Exception as e:
            report["errors"].append(f"inspect: {e.__class__.__name__}")
        report["final_url"] = page.url
        try:
            report["pages"].append(base64.b64encode(page.screenshot(full_page=True, timeout=8000)).decode())
        except Exception as e:
            report["errors"].append(f"screenshot: {e.__class__.__name__}")
        browser.close()


def analyze_image(path):
    report["pages"].append(base64.b64encode(open(path, "rb").read()).decode())


def main():
    name = sys.argv[1]
    path = os.path.join(JOB_DIR, os.path.basename(name))
    report["file"] = os.path.basename(name)
    report["size"] = os.path.getsize(path)
    report["magic"] = open(path, "rb").read(8).hex()
    probe_containment()
    ext = os.path.splitext(name)[1].lower()
    try:
        if ext == ".pdf":
            report["kind"] = "pdf"; analyze_pdf(path)
        elif ext in (".html", ".htm"):
            report["kind"] = "html"; analyze_html(path)
        elif ext in (".png", ".jpg", ".jpeg"):
            report["kind"] = "image"; analyze_image(path)
        else:
            report["kind"] = "unsupported"
    except Exception as e:
        report["errors"].append(f"{e.__class__.__name__}: {e}"[:300])
    sys.stdout.write("\n@@CAVEO_REPORT@@" + json.dumps(report))


if __name__ == "__main__":
    main()
