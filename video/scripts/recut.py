"""Re-cut a captured clip from its raw webm. Usage: recut.py <name> "a:b:speed,a:b:speed,..." (seconds)."""
import subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
name, spec = sys.argv[1], sys.argv[2]
src = next((ROOT / "build" / "cap" / name).glob("*.webm"))
segs = [tuple(float(x) for x in s.split(":")) for s in spec.split(",")]
fl = [f"[0:v]trim={a}:{b},setpts=(PTS-STARTPTS)/{sp},fps=30[v{i}]" for i, (a, b, sp) in enumerate(segs)]
fl.append("".join(f"[v{i}]" for i in range(len(segs))) + f"concat=n={len(segs)}:v=1:a=0,scale=1440:900:flags=lanczos,format=yuv420p[out]")
out = ROOT / "public" / "live" / f"app-{name}.mp4"
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(src), "-filter_complex", ";".join(fl), "-map", "[out]",
                "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-r", "30", str(out)], check=True)
print(out, subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(out)], capture_output=True, text=True).stdout.strip())
