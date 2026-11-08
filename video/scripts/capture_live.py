"""Capture the live caveo.work clips for the video.

Usage: python3 video/scripts/capture_live.py [summit|brightline|inbox|craft ...]
Writes video/public/live/app-<name>.mp4 (1440x900, 30fps). Each clip records a
marker log; the edit keeps the action and squeezes the waits.
"""
import base64, json, os, shutil, subprocess, sys, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "video" / "public" / "live"
TMP = ROOT / "video" / "build" / "cap"
URL = "https://caveo.work"
OUT.mkdir(parents=True, exist_ok=True)
TMP.mkdir(parents=True, exist_ok=True)

CURSOR_JS = """
try { localStorage.setItem("caveo-guide-done", "1"); } catch (e) {}
(() => {
  if (window.__cur) return;
  const d = document.createElement('div'); window.__cur = d;
  d.style.cssText = 'position:fixed;left:0;top:0;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;'
    + 'background:#2b211b;box-shadow:0 0 0 3px #fff,0 3px 10px rgba(0,0,0,.4);z-index:2147483647;pointer-events:none;'
    + 'transition:transform .12s ease-out;left:720px;top:450px';
  const add = () => document.body.appendChild(d);
  document.body ? add() : addEventListener('DOMContentLoaded', add);
  addEventListener('mousemove', e => { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', () => d.style.transform = 'scale(.7)', true);
  addEventListener('mouseup', () => d.style.transform = 'none', true);
})();
"""


def api(path, method="GET", data=None):
    req = urllib.request.Request(URL + path, method=method, data=data,
                                 headers={"User-Agent": "caveo-capture"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read() or "null")


def case_of(email_id):
    for m in api("/api/inbox"):
        if m["id"] == email_id:
            return m.get("case")


class Clip:
    def __init__(self, p, name):
        self.name = name
        self.dir = TMP / name
        shutil.rmtree(self.dir, ignore_errors=True)
        self.b = p.chromium.launch()
        self.ctx = self.b.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=2,
                                      record_video_dir=str(self.dir), record_video_size={"width": 1440, "height": 900})
        self.ctx.add_init_script(CURSOR_JS)
        self.t0 = time.time()
        self.page = self.ctx.new_page()
        self.page.mouse.move(720, 450)
        self.marks = []
        self.mx, self.my = 720, 450

    def mark(self, label):
        self.marks.append((label, round(time.time() - self.t0, 2)))
        print(f"  [{self.name}] {self.marks[-1][1]:6.2f}s {label}", flush=True)

    def hide_guide(self):
        g = self.page.locator("#guide-close")
        try:
            if g.is_visible():
                g.click()
        except Exception:
            pass

    def move(self, loc, click=True, steps=25):
        loc.scroll_into_view_if_needed()
        time.sleep(0.7)  # let any smooth scroll settle before measuring
        bb = loc.bounding_box()
        x, y = bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2
        self.page.mouse.move(x, y, steps=steps)
        self.mx, self.my = x, y
        time.sleep(0.15)
        if click:
            self.page.mouse.down(); time.sleep(0.08); self.page.mouse.up()
            time.sleep(0.1)

    def scroll_to(self, sel, block="start"):
        self.page.evaluate(f"document.querySelector('{sel}')?.scrollIntoView({{behavior:'smooth',block:'{block}'}})")

    def finish(self, segments):
        """segments: list of (start_s, end_s, speed). Encodes app-<name>.mp4."""
        vid = self.page.video
        self.ctx.close(); self.b.close()
        src = vid.path()
        parts, fl = [], []
        for i, (a, b, sp) in enumerate(segments):
            fl.append(f"[0:v]trim={a}:{b},setpts=(PTS-STARTPTS)/{sp},fps=30[v{i}]")
            parts.append(f"[v{i}]")
        fl.append("".join(parts) + f"concat=n={len(parts)}:v=1:a=0,scale=1440:900:flags=lanczos,format=yuv420p[out]")
        out = OUT / f"app-{self.name}.mp4"
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", src, "-filter_complex", ";".join(fl),
                        "-map", "[out]", "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-r", "30", str(out)], check=True)
        (TMP / f"{self.name}-marks.json").write_text(json.dumps(self.marks, indent=1))
        dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(out)],
                             capture_output=True, text=True).stdout.strip()
        print(f"  -> {out} {dur}s", flush=True)


def wait_case(c, email_id, timeout=120):
    t = time.time()
    while time.time() - t < timeout:
        cs = case_of(email_id)
        if cs and cs.get("status") not in (None, "processing"):
            return cs
        time.sleep(1)
    raise RuntimeError("case timeout " + email_id)


def M(c, label):
    return dict(c.marks)[label]


def run_case_clip(p, name, email_id):
    c = Clip(p, name)
    pg = c.page
    pg.goto(URL); pg.wait_for_selector("#inbox .mail"); time.sleep(1.2)
    c.hide_guide()
    c.mark("ready")
    c.move(pg.locator(f'#inbox .mail[data-id="{email_id}"]'))
    time.sleep(0.6); c.hide_guide()
    pg.wait_for_selector("#btn-run")
    c.mark("opened")
    time.sleep(0.6)
    c.move(pg.locator("#btn-run"))
    c.mark("run")
    time.sleep(0.5); c.hide_guide()
    pg.mouse.move(c.mx + 260, c.my + 40, steps=20)
    wait_case(c, email_id)
    time.sleep(1.0)  # let the UI poll and render the verdict
    pg.wait_for_selector(".stamp", timeout=20000)
    c.hide_guide()
    c.mark("verdict")
    return c


def clip_summit(p):
    c = run_case_clip(p, "summit", "msg-003")
    pg = c.page
    pg.evaluate("window.scrollTo({top:0,behavior:'smooth'})")
    time.sleep(4.0)
    c.mark("end")
    r, v, e = M(c, "ready"), M(c, "run"), M(c, "verdict")
    # landing + click + run at real speed, checking wait at 2.5x, the blocks and verdict at real speed
    c.finish([(max(0, r - 0.3), v + 1.2, 1), (v + 1.2, max(v + 1.3, e - 3.0), 2.5), (max(v + 1.3, e - 3.0), M(c, "end"), 1)])


def clip_brightline(p):
    c = run_case_clip(p, "brightline", "msg-002")
    pg = c.page
    time.sleep(1.5)
    c.scroll_to("#sec-sandbox", "start"); time.sleep(1.2)
    rb = pg.locator("#btn-reveal")
    c.move(rb)
    if rb.get_attribute("aria-pressed") != "true":
        rb.click()
    c.mark("revealed")
    time.sleep(1.0)
    pg.evaluate("document.querySelector('#shot')?.scrollIntoView({behavior:'smooth',block:'center'})")
    time.sleep(3.2)
    c.scroll_to("#sec-decide", "center"); time.sleep(1.2)
    fl = pg.locator(".finding").first
    if fl.count():
        fl.scroll_into_view_if_needed()
    pg.evaluate("document.querySelector('#sec-checks')?.nextElementSibling?.scrollIntoView({behavior:'smooth',block:'start'})")
    time.sleep(2.0)
    c.scroll_to("#sec-decide", "center"); time.sleep(2.2)
    c.mark("end")
    r, v, e = M(c, "ready"), M(c, "run"), M(c, "verdict")
    c.finish([(max(0, r - 0.3), v + 1.2, 1), (v + 1.2, max(v + 1.3, e - 2.0), 2.5), (max(v + 1.3, e - 2.0), M(c, "end"), 1)])


def send_inbound():
    env = {}
    for ln in (ROOT / ".env").read_text().splitlines():
        if "=" in ln and not ln.startswith("#"):
            k, v = ln.split("=", 1); env[k.strip()] = v.strip().strip('"')
    pdf = (ROOT / "data" / "attachments" / "Brightline_INV-B-5530.pdf").read_bytes()
    body = {"from": "Brightline Billing <billing@caveo.work>", "to": ["invoices@caveo.work"],
            "subject": "Invoice INV-B-5530 (new bank details)",
            "text": "Hi team, our bank details changed. Please pay the attached invoice today.",
            "attachments": [{"filename": "Brightline_INV-B-5530.pdf", "content": base64.b64encode(pdf).decode()}]}
    req = urllib.request.Request("https://api.resend.com/emails", data=json.dumps(body).encode(), method="POST",
                                 headers={"Authorization": "Bearer " + env["RESEND_API_KEY"], "Content-Type": "application/json",
                                          "User-Agent": "caveo-capture"})
    with urllib.request.urlopen(req, timeout=30) as r:
        print("  resend:", r.status, flush=True)


def clip_inbox(p):
    before = {m["id"] for m in api("/api/inbox")}
    c = Clip(p, "inbox")
    pg = c.page
    pg.goto(URL); pg.wait_for_selector("#inbox .mail"); time.sleep(1.2)
    c.hide_guide()
    c.move(pg.locator("#live-inbox"), click=False)
    c.mark("banner")
    send_inbound()
    new = None
    t = time.time()
    while time.time() - t < 120 and not new:
        ids = [m["id"] for m in api("/api/inbox") if m["id"] not in before]
        new = ids[0] if ids else None
        time.sleep(1)
    if not new:
        raise RuntimeError("inbound never arrived")
    pg.wait_for_selector(f'#inbox .mail[data-id="{new}"]', timeout=30000)
    c.mark("arrived")
    time.sleep(1.5)
    c.move(pg.locator(f'#inbox .mail[data-id="{new}"]'))
    c.hide_guide()
    c.mark("clicked")
    wait_case(c, new)
    time.sleep(1.0)
    pg.wait_for_selector(".stamp", timeout=20000)
    pg.evaluate("window.scrollTo({top:0,behavior:'smooth'})")
    c.mark("verdict")
    time.sleep(3.5)
    c.mark("end")
    b, a, k, v = M(c, "banner"), M(c, "arrived"), M(c, "clicked"), M(c, "verdict")
    c.finish([(max(0, b - 0.5), b + 2.5, 1), (a - 0.6, k + 1.0, 1), (k + 1.0, max(k + 1.1, v - 1.5), 3), (max(k + 1.1, v - 1.5), M(c, "end"), 1)])


def clip_craft(p):
    c = Clip(p, "craft")
    pg = c.page
    pg.goto(URL); pg.wait_for_selector("#inbox .mail"); time.sleep(1.2)
    c.hide_guide()
    c.mark("ready")
    c.move(pg.locator("#btn-craft"))
    pg.wait_for_selector("#craft-dlg[open]")
    time.sleep(0.6)
    for sel in ['input[name="injection"][value="covered"]', 'input[name="amount"][value="inflated"]']:
        c.move(pg.locator(sel).locator("xpath=.."), steps=14)
        time.sleep(0.5)
    c.move(pg.locator('#craft-form button[type="submit"]'))
    c.mark("sent")
    before_ids = {m["id"] for m in api("/api/inbox")}
    time.sleep(1.0)
    # the crafted email becomes the selected case; wait for its verdict
    t = time.time(); cid = None
    while time.time() - t < 120:
        for m in api("/api/inbox"):
            cs = m.get("case") or {}
            if m["id"].startswith("craft") or (m["id"] not in {"msg-001", "msg-002", "msg-003", "msg-004", "msg-005"} and not m.get("inbound")):
                cid = m["id"]
                if cs.get("status") not in (None, "processing"):
                    t = -1e9
                break
        if t < 0:
            break
        time.sleep(1)
    time.sleep(1.2)
    pg.wait_for_selector(".stamp", timeout=30000)
    pg.evaluate("window.scrollTo({top:0,behavior:'smooth'})")
    c.mark("verdict")
    time.sleep(1.0)
    c.move(pg.locator(".score"), click=False)
    time.sleep(2.5)
    c.mark("end")
    r, s, v = M(c, "ready"), M(c, "sent"), M(c, "verdict")
    c.finish([(max(0, r - 0.3), s + 1.0, 1), (s + 1.0, max(s + 1.1, v - 1.5), 3), (max(s + 1.1, v - 1.5), M(c, "end"), 1)])


CLIPS = {"summit": clip_summit, "brightline": clip_brightline, "inbox": clip_inbox, "craft": clip_craft}

if __name__ == "__main__":
    names = sys.argv[1:] or list(CLIPS)
    with sync_playwright() as p:
        for n in names:
            print("clip", n, flush=True)
            CLIPS[n](p)
