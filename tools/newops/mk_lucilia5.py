# Lucilia from GPT frame sheets (key sheets + in-between sheets, 2x2 each), played by nwkf.js. Feet found from the shoes only, so the bow's glow never moves the anchor.
import numpy as np, json
from scipy import ndimage
from PIL import Image
D = "art/lucilia5"
def cells(path):
    im = np.asarray(Image.open(path).convert("RGB")).astype(int); H, W, _ = im.shape; cw, ch = W // 2, H // 2; out = []
    for i in range(4):
        c = im[(i // 2) * ch:(i // 2 + 1) * ch, (i % 2) * cw:(i % 2 + 1) * cw]
        r, g, b = c[..., 0], c[..., 1], c[..., 2]; a = np.clip((90 - (g - np.maximum(r, b))) / 50, 0, 1)
        o = np.dstack([c, a * 255]).astype(np.uint8); o[..., 1] = np.where(a < 1, np.minimum(o[..., 1], np.maximum(o[..., 0], o[..., 2]) + 12), o[..., 1])
        al = o[..., 3]; al[al < 30] = 0
        lab, n = ndimage.label(al > 0); edge = set(np.unique(np.concatenate([lab[:6].ravel(), lab[-6:].ravel(), lab[:, :6].ravel(), lab[:, -6:].ravel()]))) - {0}
        tot = (al > 0).sum(); edge = [e for e in edge if (lab == e).sum() < 0.04 * tot]
        if edge: al[np.isin(lab, edge)] = 0   # bits of the neighbouring cell's drawing
        out.append(Image.fromarray(o))
    return out
def feet(im):
    p = np.asarray(im).astype(int); a = p[..., 3] > 200; lab, n = ndimage.label(a); a = lab == (np.argmax(np.bincount(lab.ravel())[1:]) + 1); r, g, b = p[..., 0], p[..., 1], p[..., 2]
    rib = a & (np.maximum(np.maximum(r, g), b) < 70); ry, rx = np.nonzero(rib); cx = np.median(rx)
    shoe = a & (np.abs(r - g) < 22) & (np.abs(b - g) < 26) & (g > 175)
    shoe[:, :max(0, int(cx - 150))] = False; shoe[:, int(cx + 150):] = False
    ys = np.nonzero(shoe.sum(1) > 6)[0]; bot = ys[-1]
    band = shoe[bot - 40:bot + 1]; xs = np.nonzero(band.any(0))[0]
    return (xs.min() + xs.max()) / 2, bot
saved = {}
def save(name, im, sc=1.0):
    fx, fb = feet(im); p = np.asarray(im).copy(); p[int(fb) + 14:, :, 3] = 0; im = Image.fromarray(p); bb = im.getbbox(); c = im.crop(bb)
    if sc != 1.0: c = c.resize((round(c.width * sc), round(c.height * sc)), Image.LANCZOS)
    c.save(f"{D}/{name}.png")
    a = np.asarray(c)[..., 3].astype(float); ys, xs = np.nonzero(a > 128); ox, oy = (fx - bb[0]) * sc, (fb - bb[1]) * sc
    saved[name] = dict(img=name, ox=float(ox), oy=float(oy), mx=float(xs.mean() - ox), my=float(ys.mean() - oy))
    return name
def clip(names, times, k, dur, **kw):
    fr = [dict(t=t, img=n, ox=saved[n]["ox"], oy=saved[n]["oy"], k=k, cx=saved[n]["mx"], cy=saved[n]["my"]) for n, t in zip(names, times)]
    return dict(k=k, notrail=True, frames=fr, xf=0.0, slide=0, **kw), dur
STAND = 640.0
k = STAND / 540.0                 # idle and attack sheets: standing figure 540px with shadow
kb = k * 533 / 480                # bow sheets are drawn smaller (standing 480 vs 533 in the idle sheet)
I = [save(f"idle{i}", f) for i, f in enumerate(cells("gpt_lc_idle.png"))]
a, m = cells("gpt_lc_atk.png"), cells("gpt_lc_atk2.png")
A = [save(f"atk{j}", f) for j, f in enumerate([a[0], m[0], a[1], m[1], a[2], m[2], a[3], m[3]])]
sa, sm = cells("gpt_lc_bowA.png"), cells("gpt_lc_bowA2.png"); s5 = cells("gpt_lc_S5.png")
SA = [save(f"sum{j}", f, (1.032 if j % 2 == 0 and j < 6 else 1.0)) for j, f in enumerate([sa[0], sm[0], sa[1], sm[1], sa[2], sm[2]] + s5)]
L1, L2, L3, L4 = (cells(f"gpt_lc_L{i}.png") for i in (1, 2, 3, 4))
# one shot, as Typhon's S3 does it: release, a held follow-through with the eyes shut, the hand over the shoulder for a new arrow,
# the arrow swung round low in front and nocked, the bow raised and drawn again
B = [save(f"shot{j}", f) for j, f in enumerate([L4[3], L1[0], L1[1], L1[2], L1[3], L2[0], L2[2], L2[3], L3[0], L3[1], L3[2], L3[3], L4[0], L4[1], L4[2]])]
kf, durs = {}, {}
kf["idle"], durs["idle"] = clip(I, [0, 0.55, 1.1, 1.25], k, 1.9)
kf["attack"], durs["attack"] = clip(A, [0, 0.09, 0.18, 0.28, 0.38, 0.52, 0.66, 0.8], k, 0.95)
kf["skill"], durs["skill"] = clip(SA, [0, 0.1, 0.2, 0.3, 0.42, 0.54, 0.66, 0.78, 0.88, 0.97], kb, 1.05)
kf["skill_loop"], durs["skill_loop"] = clip(B, [0, 0.05, 0.12, 0.24, 0.4, 0.48, 0.55, 0.63, 0.7, 0.77, 0.83, 0.88, 0.93, 0.97, 1.01], kb, 1.05)
json.dump(kf, open(f"{D}/kf.json", "w"))
print(durs, round(k, 3), round(kb, 3))
for n, s in saved.items(): print(n, round(s["ox"]), round(s["oy"]))
