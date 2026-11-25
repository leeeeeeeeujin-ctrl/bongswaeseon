import json, os, sys, subprocess
from PIL import Image, ImageDraw, ImageFont
D = sys.argv[1]; out = sys.argv[2]
kf = json.load(open(f"{D}/kf.json")); imgs = {}
def img(n):
    if n not in imgs: imgs[n] = Image.open(f"{D}/{n}.png")
    return imgs[n]
PW, PH, Z = 520, 460, 300 / 640   # 640 rig units -> 300 px
names = [("idle", "대기"), ("attack", "평타"), ("skill", "2스 소환"), ("skill_loop", "2스 사격(1발)")]
try: font = ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc", 22)
except Exception: font = None
fps, T = 30, 6.3
os.makedirs("pv", exist_ok=True)
for i in range(int(T * fps)):
    t = i / fps; frame = Image.new("RGB", (PW * 2, PH * 2), (52, 58, 66)); d = ImageDraw.Draw(frame)
    for p, (c, label) in enumerate(names):
        K = kf[c]; F = K["frames"]; dur = {"idle": 2.4, "attack": 0.9, "skill": 1.05, "skill_loop": 1.05}[c]
        tc = t % (dur + (0.35 if c in ("attack", "skill") else 0))
        j = 0
        for q in range(len(F)):
            mid = (F[q]["t"] + F[q + 1]["t"]) / 2 if q + 1 < len(F) else 9e9
            if tc < mid: j = q; break
        f = F[j]; im = img(f["img"]); s = f["k"] * Z
        q = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
        X, Y = (p % 2) * PW + PW // 2 - 40, (p // 2) * PH + PH - 40
        d.ellipse([X - 70, Y - 12, X + 70, Y + 12], fill=(36, 40, 46))
        frame.paste(q, (int(X - f["ox"] * s), int(Y - f["oy"] * s)), q)
        d.text(((p % 2) * PW + 12, (p // 2) * PH + 8), f"{label}  {len(F)}장", fill=(235, 235, 240), font=font)
    frame.save(f"pv/{i:04d}.png")
subprocess.run(["ffmpeg", "-y", "-v", "error", "-framerate", str(fps), "-i", "pv/%04d.png", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", out], check=True)
