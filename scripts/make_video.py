"""Produce the Caveo demo video: Vultr TTS voiceover + a real recording of the live site + deck slides.

  1. voiceover lines -> Vultr Serverless Inference TTS (qwen3-tts), cached in pitch/video/vo/ (rerun skips existing)
  2. Playwright records the live app running the guided tour + a crafted attack, advancing each step when its line ends
  3. ffmpeg lays the voice clips at the recorded timestamps and stitches slides + app footage into one 1080p mp4

Usage: python scripts/make_video.py [--url https://...]   (resets the live demo first)
"""
import json, os, pathlib, subprocess, sys, time, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "pitch" / "video"; VO = OUT / "vo"; VO.mkdir(parents=True, exist_ok=True)
URL = sys.argv[sys.argv.index("--url") + 1] if "--url" in sys.argv else "https://caveo-144-202-120-235.sslip.io"
SLIDES = ROOT / "pitch" / "img"
KEY = os.environ["VULTR_INFERENCE_KEY"]
NAME = "Kahvayoh"  # spelled so the TTS says it right; Whisper transcribes this exactly as "Caveo"

LINES = {
    "s01": f"{NAME}. An airlock for your invoices.",
    "s02": "Last year, US businesses lost three billion dollars to one kind of email: we changed banks, please pay the new account. "
           "Now finance teams are putting AI on their invoices, so attackers hide orders for the AI, in text no human can see.",
    "t1": "Here's an accounts payable inbox. This email says the vendor changed banks, and asks to be paid today.",
    "t2": f"{NAME} never opens the attachment on the server. It goes into a throwaway G Visor sandbox on Vultr, "
          "with no internet, no secrets, and hard limits on memory and time.",
    "t3": "Quarantined. The email came from a lookalike domain, and the bank account doesn't match the one on file.",
    "t4": "And here's what was hiding in the PDF: white text, one and a half points tall, telling the AI to approve the payment. "
          "Our model reported it as evidence instead of obeying it. And the model never decides anyway. Fixed rules do.",
    "t5": "Next, an invoice viewer that attacks the moment it opens. Watch it hit the walls.",
    "t5b": "It went for the cookies, a login token and a password, and tried to send them out. Every attempt was blocked. "
           "Then the sandbox was destroyed. Nothing touched the server.",
    "t6": "Your turn. Anyone can build their own fake invoice and try to get it paid.",
    "c1": "Impersonate the vendor from its real, hacked mailbox. Swap in your own bank account. Hide an instruction under a white box. "
          "Same sandbox, same rules.",
    "c2": "Caught. Every rule it tripped is listed right there.",
    "s07": f"We red-teamed it with eleven hiding places. A naive AI approver on the same model paid one of them. {NAME} paid none, and flagged all eleven.",
    "s08": "It all runs on Vultr. Cloud Compute is the control plane that sends every attachment to a fresh sandbox. "
           "Serverless Inference reads the evidence, and even voiced this video.",
    "s10": f"{NAME}. An airlock for your invoices. Try it live, and try to beat it.",
}


def tts(key, text):
    p = VO / f"{key}.mp3"
    if not p.exists():
        body = {"model": "qwen3-tts-12hz-1.7b", "voice": "ryan", "input": text, "response_format": "mp3", "language": "English",
                "instructions": "Calm, confident product-demo narrator. Clear and warm, steady pace."}
        req = urllib.request.Request("https://api.vultrinference.com/v1/audio/speech", data=json.dumps(body).encode(),
                                     headers={"Authorization": "Bearer " + KEY, "Content-Type": "application/json"})
        p.write_bytes(urllib.request.urlopen(req, timeout=120).read())
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                                capture_output=True, text=True).stdout)


def record(dur):
    from playwright.sync_api import sync_playwright
    urllib.request.urlopen(urllib.request.Request(URL + "/api/reset", method="POST"))
    marks = {}
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": 1600, "height": 900}, record_video_dir=str(OUT / "raw"),
                            record_video_size={"width": 1600, "height": 900})
        pg = ctx.new_page(); t0 = time.time()
        pg.goto(URL + "/"); pg.wait_for_timeout(2500)
        pg.evaluate("window.__tourManual = true")
        mark = lambda k: marks.__setitem__(k, time.time() - t0)
        step = lambda: pg.inner_text("#tour-step") if pg.locator("#tour").is_visible() else ""
        def nxt():
            pg.wait_for_function("window.__tourHolding === true", timeout=120000)
            pg.click("#tour-next")

        def wait_step(prefix, timeout=90):
            end = time.time() + timeout
            while prefix not in step():
                if time.time() > end:
                    raise TimeoutError(prefix)
                pg.wait_for_timeout(100)

        pg.click("[data-tour]")
        for key, prefix in [("t1", "1 / 6"), ("t2", "2 / 6"), ("t3", "3 / 6"), ("t4", "4 / 6")]:
            wait_step(prefix); mark(key)
            pg.wait_for_timeout(int((dur[key] + 0.8) * 1000))
            nxt()  # waits until the tour is paused on this step (step 2 pauses only after the sandbox run finishes)
        wait_step("BOOBY"); mark("t5")
        wait_step("CONTAINED", 120); mark("t5b")
        pg.wait_for_timeout(int((dur["t5b"] + 1.0) * 1000)); nxt()
        wait_step("6 / 6"); mark("t6")
        pg.wait_for_timeout(int((dur["t6"] + 0.6) * 1000)); nxt()          # "Try it" opens the craft dialog
        pg.wait_for_selector("#craft-dlg[open]"); mark("c1")
        for name, val in [("vendor_id", "V-1002"), ("sender", "real"), ("bank", "changed"), ("injection", "covered")]:
            pg.wait_for_timeout(1300); pg.select_option(f"select[name={name}]", val)
        pg.wait_for_timeout(max(500, int((dur["c1"] - 5.2) * 1000)))
        pg.click("#craft-form button[type=submit]")
        pg.wait_for_selector(".banner", timeout=120000); mark("c2")
        pg.locator(".banner").scroll_into_view_if_needed()
        pg.wait_for_timeout(4500); mark("end")
        video = pg.video.path(); ctx.close(); b.close()
    return pathlib.Path(video), marks


def ff(*args):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args], check=True)


def main():
    dur = {k: tts(k, v) for k, v in LINES.items()}
    print("voiceover seconds:", round(sum(dur.values()), 1))
    raw, marks = record(dur)
    print("marks:", {k: round(v, 1) for k, v in marks.items()})
    start = marks["t1"] - 1.0
    # app segment: trim, scale to 1080p, lay each voice clip at its mark
    clips = [k for k in ("t1", "t2", "t3", "t4", "t5", "t5b", "t6", "c1", "c2") if k in marks]
    inputs, filt = ["-ss", f"{start:.2f}", "-to", f"{marks['end']:.2f}", "-i", str(raw)], []
    for i, k in enumerate(clips):
        inputs += ["-i", str(VO / f"{k}.mp3")]
        filt.append(f"[{i + 1}:a]adelay={int((marks[k] - start) * 1000)}|{int((marks[k] - start) * 1000)}[a{i}]")
    filt.append("".join(f"[a{i}]" for i in range(len(clips))) + f"amix=inputs={len(clips)}:normalize=0[aout]")
    filt.append("[0:v]scale=1920:1080:flags=lanczos,fps=30,format=yuv420p[vout]")
    ff(*inputs, "-filter_complex", ";".join(filt), "-map", "[vout]", "-map", "[aout]", "-c:v", "libx264", "-crf", "18",
       "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", str(OUT / "seg_app.mp4"))

    def slide(img, key, name):
        ff("-loop", "1", "-i", str(SLIDES / img), "-i", str(VO / f"{key}.mp3"), "-filter_complex",
           f"[0:v]scale=1920:1080,fps=30,format=yuv420p[v];[1:a]apad=pad_dur=1.0[a]", "-map", "[v]", "-map", "[a]",
           "-t", f"{dur[key] + 1.0:.2f}", "-c:v", "libx264", "-crf", "18", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
           str(OUT / name))
    slide("slide01.png", "s01", "seg_01.mp4"); slide("slide02.png", "s02", "seg_02.mp4")
    slide("slide07.png", "s07", "seg_07.mp4"); slide("slide08.png", "s08", "seg_08.mp4"); slide("slide10.png", "s10", "seg_10.mp4")
    order = ["seg_01.mp4", "seg_02.mp4", "seg_app.mp4", "seg_07.mp4", "seg_08.mp4", "seg_10.mp4"]
    (OUT / "list.txt").write_text("".join(f"file '{OUT / n}'\n" for n in order))
    ff("-f", "concat", "-safe", "0", "-i", str(OUT / "list.txt"), "-c:v", "libx264", "-crf", "18", "-c:a", "aac", "-b:a", "192k",
       "-movflags", "+faststart", str(ROOT / "pitch" / "Caveo-demo.mp4"))
    print("wrote", ROOT / "pitch" / "Caveo-demo.mp4")


if __name__ == "__main__":
    main()
