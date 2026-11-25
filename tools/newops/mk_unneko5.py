# Unneko from GPT frame sheets (anime-style drawings), played by nwkf.js. Each sheet is cut, keyed, trimmed and anchored at the feet.
import numpy as np, json
from PIL import Image
D = "art/unneko5"
def cells(path, cols, rows):
    im = np.asarray(Image.open(path).convert("RGB")).astype(int); H, W, _ = im.shape; cw, ch = W // cols, H // rows; out = []
    for i in range(cols * rows):
        c = im[(i // cols) * ch:(i // cols + 1) * ch, (i % cols) * cw:(i % cols + 1) * cw]
        r, g, b = c[..., 0], c[..., 1], c[..., 2]; a = np.clip((90 - (g - np.maximum(r, b))) / 50, 0, 1)
        o = np.dstack([c, a * 255]).astype(np.uint8); o[..., 1] = np.where(a < 1, np.minimum(o[..., 1], np.maximum(o[..., 0], o[..., 2]) + 12), o[..., 1])
        al = o[..., 3]; al[al < 30] = 0; out.append(Image.fromarray(o))
    return out
def feet(im):
    a = np.asarray(im)[..., 3] > 128; ys = np.nonzero(a.any(1))[0]; bot = ys[-1]
    band = a[bot - int(0.12 * im.height):bot - 3]; xs = np.nonzero(band.any(0))[0]; return (xs.min() + xs.max()) / 2, bot
def height(im):
    a = np.asarray(im)[..., 3] > 128; ys = np.nonzero(a.any(1))[0]; return ys[-1] - ys[0]
saved = {}
def save(name, im):
    fx, fb = feet(im); bb = im.getbbox(); c = im.crop(bb); c.save(f"{D}/{name}.png")
    a = np.asarray(c)[..., 3].astype(float); ys, xs = np.nonzero(a > 128)
    saved[name] = dict(img=name, ox=float(fx - bb[0]), oy=float(fb - bb[1]), mx=float(xs.mean() - (fx - bb[0])), my=float(ys.mean() - (fb - bb[1])))
    return name
def clip(names, times, k, dur, **kw):
    fr = []
    for n, t in zip(names, times):
        s = saved[n]; fr.append(dict(t=t, img=n, ox=s["ox"], oy=s["oy"], k=k, cx=s["mx"], cy=s["my"]))
    return dict(k=k, notrail=True, frames=fr, xf=0.0, slide=0, **kw), dur
STAND = 640.0
idle = cells("gpt_un_idle_v1.png", 4, 2); k_idle = STAND / height(idle[0])
atk = cells("gpt_un_attack_v2.png", 4, 3); k_atk = STAND / height(atk[0])
f10 = cells("gpt_un_attack_f10.png", 1, 1)[0]; f10 = f10.resize((round(f10.width * 0.29 * atk[0].height / 362), round(f10.height * 0.29 * atk[0].height / 362)), Image.LANCZOS)
atk[9] = f10
slam = cells("gpt_un_skill1_v1.png", 4, 3); k_slam = STAND / height(slam[0])
v2 = cells("gpt_un_skill2_v2.png", 4, 4); k_v2 = STAND / height(v2[0])
v3 = cells("gpt_un_spin_v3.png", 4, 2); v3 = [f.resize((round(f.width * 0.62), round(f.height * 0.62)), Image.LANCZOS) for f in v3]
I = [save(f"idle{i}", f) for i, f in enumerate(idle)]
A = [save(f"atk{i}", f) for i, f in enumerate(atk)]
S = [save(f"slam{i}", f) for i, f in enumerate(slam)]
W = [save(f"wind{i}", f) for i, f in enumerate(v2[:7])] + [save(f"spin{i}", f) for i, f in enumerate(v3)] + [save(f"rec{i}", f) for i, f in enumerate(v2[12:16])]
kf, durs = {}, {}
kf["idle"], durs["idle"] = clip(I, [i * 0.3 for i in range(8)], k_idle, 2.4)
kf["attack"], durs["attack"] = clip(A, [0, 0.06, 0.14, 0.24, 0.32, 0.40, 0.47, 0.54, 0.62, 0.70, 0.84, 0.96], k_atk, 1.1)
kf["attack_un_kick"], durs["attack_un_kick"] = clip(S, [0, 0.05, 0.11, 0.17, 0.23, 0.28, 0.33, 0.38, 0.48, 0.58, 0.72, 0.86], k_slam, 1.0)
sp = W[7:15]
kf["attack_un_star"], durs["attack_un_star"] = clip([W[6]] + sp, [0, 0.06, 0.12, 0.16, 0.20, 0.24, 0.28, 0.32, 0.38], k_v2, 0.55)
tw = [0, 0.09, 0.18, 0.27, 0.36, 0.45, 0.54]; ts = [0.65, 0.72, 0.755, 0.79, 0.825, 0.86, 0.895, 0.93]; tr = [1.02, 1.12, 1.22, 1.32]
kf["skill"], durs["skill"] = clip(W, tw + ts + tr, k_v2, 1.8)
json.dump(kf, open(f"{D}/kf.json", "w"))
json.dump({"durs": durs, "impact": {"attack": 0.32, "attack_un_kick": 0.38, "attack_un_star": 0.20, "skill": 0.8}}, open(f"{D}/timing.json", "w"))
print({k: round(v, 3) for k, v in [("idle", k_idle), ("atk", k_atk), ("slam", k_slam), ("v2", k_v2)]})
