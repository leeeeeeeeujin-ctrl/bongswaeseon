# cut a parts sheet by connected components: python3 cutparts.py sheet.png outdir rowbreaks(csv of y) names(csv, row by row left to right)
import sys, numpy as np, json
from PIL import Image
from scipy import ndimage
src, out, rb, names = sys.argv[1], sys.argv[2], [int(v) for v in sys.argv[3].split(",")], sys.argv[4].split(",")
a = np.asarray(Image.open(src).convert("RGB")).astype(np.int32); r, g, b = a[..., 0], a[..., 1], a[..., 2]
alpha = np.clip((90 - (g - np.maximum(r, b))) / 50.0, 0, 1); o = np.dstack([a, alpha * 255]).astype(np.uint8)
o[..., 1] = np.where(alpha < 1, np.minimum(o[..., 1], np.maximum(o[..., 0], o[..., 2]) + 12), o[..., 1])
lab, n = ndimage.label(ndimage.binary_dilation(alpha > 0.3, iterations=4)); sl = ndimage.find_objects(lab)
C = [(s[0].start, s[1].start, s[0].stop, s[1].stop, i + 1) for i, s in enumerate(sl) if (s[0].stop - s[0].start) * (s[1].stop - s[1].start) > 2500]
row = lambda c: sum((c[0] + c[2]) / 2 > y for y in rb)
C.sort(key=lambda c: (row(c), c[1])); meta = {}
assert len(C) == len(names), (len(C), len(names))
for nm, (y0, x0, y1, x1, i) in zip(names, C):
    c = o[y0:y1, x0:x1].copy(); c[..., 3] = np.where(lab[y0:y1, x0:x1] == i, c[..., 3], 0); Image.fromarray(c).save(f"{out}/{nm}.png"); meta[nm] = [int(x1 - x0), int(y1 - y0)]
json.dump(meta, open(f"{out}/sizes.json", "w")); print(meta)
