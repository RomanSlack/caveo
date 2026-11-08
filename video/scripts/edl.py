# Build a tight cut list from the raw take: keep chosen line ranges, drop silences, compress pauses.
import json, numpy as np, soundfile as sf
a, sr = sf.read('final1.wav')
hop = int(sr*0.01); n = len(a)//hop
rms = np.array([np.sqrt((a[i*hop:(i+1)*hop]**2).mean()) for i in range(n)])
floor = np.percentile(rms, 20); thr = max(floor*4, 0.006)
speech = rms > thr
# line ranges on the source clock (seconds), redo takes removed
LINES = [
 (1, 2.15, 11.95), (2, 12.80, 18.50), (2, 25.95, 29.90), (3, 37.10, 48.12), (4, 48.15, 52.45),
 (5, 53.10, 64.30), (6, 66.00, 77.20), (7, 77.95, 80.10), (8, 81.00, 90.80), (9, 92.20, 101.90),
 (10, 103.70, 111.80), (11, 113.05, 119.15), (12, 120.80, 132.95), (13, 133.80, 142.50), (14, 143.55, 147.15),
]
MAXGAP, PAD, TAIL = 0.38, 0.08, 0.2   # keep pauses up to 0.22s; trim longer ones
segs = []
for line, s, e in LINES:
    fs, fe = int(s*100), int(e*100)
    on = speech[fs:fe]
    idx = np.where(on)[0]
    if not len(idx): continue
    # chunks of speech
    chunks = []; start = idx[0]; prev = idx[0]
    for i in idx[1:]:
        if (i-prev)/100 > MAXGAP: chunks.append((start, prev)); start = i
        prev = i
    chunks.append((start, prev))
    for c0, c1 in chunks:
        a0 = max(s, (fs+c0)/100 - PAD); a1 = min(e, (fs+c1+1)/100 + TAIL)
        if a1 - a0 < 0.12: continue
        segs.append({'line': line, 's': round(a0, 3), 'e': round(a1, 3)})
json.dump(segs, open('edl.json', 'w'), indent=1)
tot = sum(x['e']-x['s'] for x in segs)
per = {}
for x in segs: per[x['line']] = per.get(x['line'], 0) + x['e'] - x['s']
print(len(segs), 'segments, total', round(tot, 2), 's'); print({k: round(v, 2) for k, v in per.items()})
