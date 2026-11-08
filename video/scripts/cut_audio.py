# Assemble the cut audio with 12ms crossfades at every join (no clicks) for checking and for the final mix.
import json, numpy as np, soundfile as sf, sys
src = sys.argv[1]; out = sys.argv[2]
a, sr = sf.read(src)
if a.ndim > 1: a = a.mean(1)
segs = json.load(open('edl.json'))
xf = int(sr*0.012); gap_line = 0
parts = []; prev_line = None
for sg in segs:
    p = a[int(sg['s']*sr):int(sg['e']*sr)].copy()
    ramp = np.linspace(0, 1, xf); p[:xf] *= ramp; p[-xf:] *= ramp[::-1]
    parts.append(p); prev_line = sg['line']
y = np.concatenate(parts); sf.write(out, y, sr); print(out, round(len(y)/sr, 2), 's')
