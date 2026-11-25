# Lucilia from GPT frame sheets (key sheets + in-between sheets, 2x2 each), played by nwkf.js. Feet found from the shoes only, so the bow's glow never moves the anchor.
import numpy as np, json
from scipy import ndimage
from PIL import Image
D = "art/lucilia6"
def cells(path, cols=2, rows=2):
    im = np.asarray(Image.open(path).convert("RGB")).astype(int); H, W, _ = im.shape; cw, ch = W // cols, H // rows; out = []
    for i in range(cols * rows):
        c = im[(i // cols) * ch:(i // cols + 1) * ch, (i % cols) * cw:(i % cols + 1) * cw]
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
    # x: the solid black chest ribbon (thin outlines removed by an opening), which rides on the torso; y: the shoe soles
    solid = ndimage.binary_opening(rib, iterations=3); lab, n = ndimage.label(solid)
    if n: k = np.argmax(np.bincount(lab.ravel())[1:]) + 1; return float(np.median(np.nonzero(lab == k)[1])), bot
    band = shoe[bot - 40:bot + 1]; xs = np.nonzero(band.any(0))[0]
    return (xs.min() + xs.max()) / 2, bot
saved = {}
def save(name, im, sc=1.0, at=None):
    fx, fb = at if at else feet(im); p = np.asarray(im).copy(); p[int(fb) + 14:, :, 3] = 0; im = Image.fromarray(p); bb = im.getbbox(); c = im.crop(bb)
    if sc != 1.0: c = c.resize((round(c.width * sc), round(c.height * sc)), Image.LANCZOS)
    c.save(f"{D}/{name}.png")
    a = np.asarray(c)[..., 3].astype(float); ys, xs = np.nonzero(a > 128); ox, oy = (fx - bb[0]) * sc, (fb - bb[1]) * sc
    saved[name] = dict(img=name, ox=float(ox), oy=float(oy), mx=float(xs.mean() - ox), my=float(ys.mean() - oy))
    return name
def clip(names, times, k, dur, **kw):
    fr = [dict(t=t, img=n, ox=saved[n]["ox"], oy=saved[n]["oy"], k=k, cx=saved[n]["mx"], cy=saved[n]["my"]) for n, t in zip(names, times)]
    return dict(k=k, notrail=True, frames=fr, xf=0.0, slide=0, **kw), dur
STAND = 640.0
H = dict(idle_k=540, idle_a=540, atk_k=515, atk_a=515, atk_b=515, sum_k=463, sum_a=395, sum_b=395, loop_k=466, loop_a=460)   # standing height of each sheet in px (one GPT conversation per motion)
C = {n: cells(f"q_{n}.png") for n in H}
H["shot8"] = 313; C["shot8"] = cells("q_shot8.png", 4, 2); H["sum8"] = 313; H["idle8"] = 372; C["idle8"] = cells("q_idle8.png", 4, 2); H["atk8"] = 352; C["atk8"] = cells("q_atk8.png", 4, 2); C["sum8"] = cells("q_sum8.png", 4, 2); H["shot16"] = 232; C["shot16"] = cells("q_shot16.png", 4, 4); H.update(shot16b=226, idle16=284, atk16=255, sum16=286)
for _n in ("shot16b", "idle16", "atk16", "sum16"):   # one generation, 16 cells, drawn with black cell borders
    C[_n] = cells(f"q_{_n}.png", 4, 4)
    for _c in C[_n]:
        _p = np.asarray(_c).copy(); _p[:9, :, 3] = 0; _p[-9:, :, 3] = 0; _p[:, :9, 3] = 0; _p[:, -9:, 3] = 0; _c.paste(Image.fromarray(_p))   # one generation, 8 cells: head 115px vs 159px in the summon key sheet
fr = {}
GRID_SHEETS = {"idle16", "atk16", "sum16", "shot16b", "shot16", "shot8", "sum8", "idle8", "atk8"}
GRID = {}   # sheets drawn in one generation keep GPT's own registration: every cell uses the same anchor point (the first cell's feet)
SC = {("sum16", i): 286 / h for i, h in zip(range(1, 6), (238, 239, 238, 238, 242))}   # GPT drew the first summon cells a size smaller
SC[("sum16", 6)] = 286 / 262
def F(n, i, tag):
    at = None
    if n in GRID_SHEETS: at = GRID.setdefault(n, feet(C[n][0]))
    fr[tag] = (save(tag, C[n][i - 1], sc=SC.get((n, i), 1.0), at=at), STAND / H[n]); return tag
def clip2(tags, times, dur):
    out = [dict(t=t, img=saved[g]["img"], ox=saved[g]["ox"], oy=saved[g]["oy"], k=fr[g][1], cx=saved[g]["mx"], cy=saved[g]["my"]) for g, t in zip(tags, times)]
    return dict(k=out[0]["k"], notrail=True, frames=out, xf=0.0, slide=0), dur
idle = [F("idle16", i, f"i{i - 1}") for i in range(1, 17)]
atk = [F("atk16", i, f"a{i - 1}") for i in range(1, 17)]
sm = [F("sum16", i, f"s{i - 1}") for i in range(1, 17)]
lp = [F("shot16b", i, f"l{j}") for j, i in enumerate([16] + list(range(1, 16)))]
kf, durs = {}, {}
kf["idle"], durs["idle"] = clip2(idle, [round(j * 0.2, 3) for j in range(16)], 3.2)
kf["attack"], durs["attack"] = clip2(atk, [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.41, 0.48, 0.55, 0.62, 0.7, 0.78, 0.86, 0.94], 1.0)
kf["skill"], durs["skill"] = clip2(sm, [round(j * 1.05 / 16, 3) for j in range(16)], 1.05)
kf["skill_loop"], durs["skill_loop"] = clip2(lp, [round(j * 1.3 / 16, 3) for j in range(16)], 1.3)
json.dump(kf, open(f"{D}/kf.json", "w"))
print(durs)
