# Cut the webcam take by edl.json with alternating 1.0/1.08 punch-ins inside each line (hides jump cuts).
import json, subprocess, sys
segs = json.load(open('edl.json')); src = sys.argv[1]; out = sys.argv[2]
f = []; labels = []; prev = None; k = 0
for i, s in enumerate(segs):
    if s['line'] != prev: k = 0
    z = 1.0 if k % 2 == 0 else 1.08; k += 1; prev = s['line']
    w = int(1920/z)//2*2; h = int(1080/z)//2*2; cx, cy = 1030, 500
    x = max(0, min(1920-w, cx-w//2)); y = max(0, min(1080-h, cy-h//2))
    f.append(f"[0:v]trim=start={s['s']}:end={s['e']},setpts=PTS-STARTPTS,crop={w}:{h}:{x}:{y},scale=1920:1080:flags=lanczos,setsar=1,fps=30[v{i}];")
    labels.append(f"[v{i}]")
f.append("".join(labels) + f"concat=n={len(segs)}:v=1:a=0[out]")
open('cut.fgraph', 'w').write("\n".join(f))
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', src, '-filter_complex_script', 'cut.fgraph', '-map', '[out]',
                '-c:v', 'libx264', '-crf', '14', '-preset', 'fast', '-pix_fmt', 'yuv420p', out], check=True)
