# generic frame-drawing operator: 4x4 one-generation sheets (idle / attack / skill), cut on the grid with GPT's own registration,
# sizes evened by the standing height of cell 1 (every sheet is asked to open on the same neutral stance as the idle).
# usage: python3 mk_nw16.py <id> <dir> idle=q.png attack=q.png skill=q.png [skill_loop=q.png] [--dur idle=3.2,attack=1.0,skill=1.4] [--impact 0.35]
import sys, json, os, numpy as np
from PIL import Image
from scipy import ndimage
args = sys.argv[1:]; ID, D = args[0], args[1]; os.makedirs(D, exist_ok=True)
sheets = {}; opt = {}; i = 2
while i < len(args):
    if args[i].startswith("--"): opt[args[i][2:]] = args[i + 1]; i += 2
    else: k, v = args[i].split("=", 1); sheets[k] = v; i += 1
DUR = dict(idle=3.2, attack=1.0, skill=1.4, skill_loop=1.2); DUR.update({k: float(v) for k, v in (p.split("=") for p in opt.get("dur", "").split(",") if p)})
IMPACT = float(opt.get("impact", 0.35))
def key(c):
    r, g, b = c[..., 0], c[..., 1], c[..., 2]; a = np.clip((90 - (g - np.maximum(r, b))) / 50, 0, 1)
    o = np.dstack([c, a * 255]).astype(np.uint8); o[..., 1] = np.where(a < 1, np.minimum(o[..., 1], np.maximum(o[..., 0], o[..., 2]) + 12), o[..., 1]); o[..., 3][o[..., 3] < 30] = 0
    return o
def cells(path):
    im = np.asarray(Image.open(path).convert("RGB")).astype(int); H, W, _ = im.shape; cw, ch = W // 4, H // 4; out = []
    for k in range(16):
        o = key(im[(k // 4) * ch:(k // 4 + 1) * ch, (k % 4) * cw:(k % 4 + 1) * cw]); o[:9, :, 3] = 0; o[-9:, :, 3] = 0; o[:, :9, 3] = 0; o[:, -9:, 3] = 0
        lab, n = ndimage.label(o[..., 3] > 0)
        if n:   # drop specks from the neighbouring cells
            sz = np.bincount(lab.ravel())[1:]; keep = np.isin(lab, np.nonzero(sz > 0.02 * sz.max())[0] + 1); o[..., 3] = np.where(keep, o[..., 3], 0)
        out.append(o)
    return out
def body(o):   # figure mask without glow/effects: fairly opaque, not pure light
    return o[..., 3] > 200
def feet_and_height(o):
    m = body(o); lab, n = ndimage.label(m); m = lab == (np.argmax(np.bincount(lab.ravel())[1:]) + 1)
    ys = np.nonzero(m.any(1))[0]; top, bot = ys[0], ys[-1]
    xs = np.nonzero(m[bot - max(8, (bot - top) // 12):bot + 1].any(0))[0]
    return (xs.min() + xs.max()) / 2, bot, bot - top
STAND = 640.0; kf = {}; info = {}
for clip, path in sheets.items():
    C = cells(path); fx, fb, h0 = feet_and_height(C[0]); k = STAND / h0; frames = []
    order = list(range(16))
    if clip == "skill_loop": order = [15] + list(range(15))
    for j, ci in enumerate(order):
        o = C[ci]; a = o[..., 3] > 0
        if not a.any(): continue
        ys, xs = np.nonzero(a); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        nm = f"{clip[:2]}{ci}"; Image.fromarray(o[y0:y1, x0:x1]).save(f"{D}/{nm}.png")
        frames.append(dict(t=round(j * DUR[clip] / 16, 3), img=nm, ox=float(fx - x0), oy=float(fb - y0), k=k))
    kf[clip] = dict(k=k, notrail=True, frames=frames, xf=0.0, slide=0)
    info[clip] = dict(h0=int(h0), k=round(k, 3))
# die: the idle's first drawing, fading (u_clips carries the alpha)
f0 = dict(kf["idle"]["frames"][0]); f0["t"] = 0; kf["die"] = dict(k=f0["k"], notrail=True, frames=[f0], xf=0.0, slide=0)
json.dump(kf, open(f"{D}/kf.json", "w"))
G = ID.upper() + "NW_MY"
clips = ["(function (root) {", '  "use strict";', "  const E = () => ({ bones: {}, extra: {} });", "  const C = {};"]
for c in kf:
    if c == "die": continue
    d = DUR[c]; extra = ""
    clips.append(f"  C.{c} = Object.assign(E(), {{ dur: {d}{', loop: true' if c in ('idle', 'skill_loop') else ''}{', impact: ' + str(round(IMPACT * d, 3)) if c == 'attack' else ''}{', impact: ' + str(d) if c == 'skill' else ''} }});")
clips.append('  C.die = Object.assign(E(), { dur: 1.2, extra: { alpha: [[0, 1], [0.6, 1], [1.2, 0]] } });')
clips.append(f"  root.{G} = {{ CLIPS: C }};")
clips.append('})(typeof window !== "undefined" ? window : globalThis);')
open(f"{D}/u_clips.js", "w").write("\n".join(clips) + "\n")
# a rig with no parts: the drawings carry everything, the bones only feed the evaluator
R = json.load(open("art/lucilia6/u_rig.json"))
for s in ("front", "back"): R[s]["slots"] = {}; R[s]["order"] = []
R["heads"] = {}
json.dump(R, open(f"{D}/u_rig.json", "w"))
print(json.dumps(dict(id=ID, glob=G, info=info)))
