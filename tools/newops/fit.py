import sys, subprocess, json
from PIL import Image
clip, t, ref, ox, oy = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]), float(sys.argv[5]); out = sys.argv[6]
subprocess.run(["python3", "strip.py", "unneko2", "u_rig.json", "u_clips.js", "UNNEKO2_MY", json.dumps([[clip, [float(t)]]]), "_fit.png", "0.9", "760", "660"], check=True, capture_output=True)
a = Image.open("_fit.png").convert("RGBA"); r = Image.open(ref).convert("RGBA"); k = 1.485 * 0.9
r = r.resize((round(r.width * k), round(r.height * k)))
x0, y0 = round(760 * 0.45 - ox * k), round(660 - 24 - oy * k)
B = Image.new("RGBA", a.size, (74, 83, 98, 255)); B.alpha_composite(r, (max(0, x0), max(0, y0)))
O = a.copy(); r2 = r.copy(); r2.putalpha(r2.getchannel("A").point(lambda v: v // 2)); O.alpha_composite(r2, (max(0, x0), max(0, y0)))
W = Image.new("RGB", (760 * 3, 660)); W.paste(a.convert("RGB"), (0, 0)); W.paste(B.convert("RGB"), (760, 0)); W.paste(O.convert("RGB"), (1520, 0)); W.save(out)
