# generic keyframe timeline: python3 mkkf_gen.py <id> '<json spec>'   spec = { height, clips: { name: { src:[[prefix,index,t],...], slide?, still?, period? } } }
import json, sys, numpy as np
from PIL import Image
id, spec = sys.argv[1], json.loads(sys.argv[2]); d = f'art/{id}'; M = {}
def meta(p):
    if p not in M: M[p] = json.load(open(f'{d}/kf{p}_meta.json'))
    return M[p]
ref = spec["ref"]; k = spec["height"] / meta(ref[0])[ref[1]]["h"]
def fr(p, i, t):
    m = meta(p)[i]; al = np.asarray(Image.open(f"{d}/{m['img']}.png"))[..., 3] > 60; ys, xs = np.nonzero(al)
    return {"t": t, "img": m["img"], "ox": m["ox"], "oy": m["oy"], "cx": float(xs.mean() - m["ox"]), "cy": float(ys.mean() - m["oy"])}
kf = {}
for name, c in spec["clips"].items():
    o = {"k": k, "notrail": True, "frames": [fr(*s) for s in c["src"]]}
    for key in ("slide", "still", "period", "xf"):
        if key in c: o[key] = c[key]
    kf[name] = o
json.dump(kf, open(f'{d}/kf.json', 'w')); print(id, {n: len(c["frames"]) for n, c in kf.items()}, round(k, 3))
