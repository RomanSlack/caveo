# Robust Video Matting: read frames with ffmpeg, write a grayscale alpha video with ffmpeg.
import subprocess, numpy as np, torch
W, H = 1920, 1080
model = torch.hub.load("PeterL1n/RobustVideoMatting", "resnet50", trust_repo=True).cuda().eval().half()
rd = subprocess.Popen(['ffmpeg', '-loglevel', 'error', '-i', 'face_cut_noaudio.mp4', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
wr = subprocess.Popen(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', f'{W}x{H}', '-r', '30', '-i', '-',
                       '-c:v', 'libx264', '-crf', '10', '-preset', 'fast', '-pix_fmt', 'yuv420p', 'pha.mp4'], stdin=subprocess.PIPE)
rec = [None] * 4; n = 0
with torch.no_grad():
    while True:
        buf = rd.stdout.read(W * H * 3)
        if len(buf) < W * H * 3: break
        src = torch.from_numpy(np.frombuffer(buf, np.uint8).reshape(H, W, 3).copy()).cuda().permute(2, 0, 1)[None].half() / 255
        fgr, pha, *rec = model(src, *rec, downsample_ratio=0.25)
        wr.stdin.write((pha[0, 0].clamp(0, 1) * 255).byte().cpu().numpy().tobytes()); n += 1
wr.stdin.close(); wr.wait(); print('frames', n)
