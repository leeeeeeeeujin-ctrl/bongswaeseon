# cut a 3x2 green keyframe sheet into transparent frames with a shared origin (cell centre, ground line): python3 cutkf.py kf.png outdir prefix
import sys, os, json
import numpy as np
from PIL import Image
src, outdir, pre = sys.argv[1:4]
GRID = [a for a in sys.argv[4:] if 'x' in a]; COLS, ROWS = (int(v) for v in GRID[0].split('x')) if GRID else (3, 2)
EXT = {int(a.split(':')[0]): int(a.split(':')[1]) for a in sys.argv[4:] if ':' in a}   # cell: extra rows taken from the cell above
im = Image.open(src).convert("RGB"); a = np.asarray(im).astype(np.int32); H, W, _ = a.shape; cw, ch = W // COLS, H // ROWS
r, g, b = a[..., 0], a[..., 1], a[..., 2]
key = (g - np.maximum(r, b))            # how green
alpha = np.clip((90 - key) / 50.0, 0, 1)
dark = (r + g + b) < 60                 # ground line / cell borders are near black thin lines: handled per cell below
out = np.dstack([a, (alpha * 255)]).astype(np.uint8)
# despill
sp = np.minimum(out[..., 1], np.maximum(out[..., 0], out[..., 2]) + 12); out[..., 1] = np.where(alpha < 1, sp, out[..., 1])
meta = []
for i in range(COLS * ROWS):
    cx, cy = (i % COLS) * cw, (i // COLS) * ch
    ex = EXT.get(i, 0)
    c = out[cy + 6 - ex:cy + ch - 6, cx + 6:cx + cw - 6].copy()
    # the drawn ground line first: any row whose dark pixels span most of the cell is the line, wherever stray specks sit below it
    dk = (c[..., :3].sum(2) < 150) & (c[..., 3] > 40)
    for y in range(c.shape[0] - 1, c.shape[0] - 90, -1):
        if dk[y].sum() > 0.45 * c.shape[1]: c[y, :, 3] = np.where(dk[y], 0, c[y, :, 3]); c[y + 3:, :, 3] = 0   # and nothing of this figure lies below its ground line
    # then specks: keep only pieces of a reasonable size
    from scipy import ndimage
    lab, n = ndimage.label(c[..., 3] > 40)
    if n > 1:
        sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1)); big = sizes.max()
        for j, sz in enumerate(sizes, 1):
            if sz < 0.004 * big: c[..., 3][lab == j] = 0
    al = c[..., 3] > 40
    rows = al.sum(1)
    # the drawn ground line: a wide thin dark row near the bottom; remove it (rows that are mostly a thin horizontal stroke)
    ys = np.where(rows > 0)[0]; base = ys.max()
    for y in range(base, max(base - 14, 0), -1):
        seg = c[y, :, :3].sum(1) < 120
        if (al[y] & seg).sum() > 0.5 * al[y].sum() and al[y].sum() > 0.3 * cw: c[y, :, 3] = np.where(seg, 0, c[y, :, 3])
    # leftovers of the ground line: dark pixels in the last rows with nothing of the figure a few rows above them
    al = c[..., 3] > 40; ys = np.where(al.sum(1) > 0)[0]; base = ys.max()
    for y in range(base, max(base - 12, 6), -1):
        darkpx = (c[y, :, :3].sum(1) < 150) & al[y]; lone = ~(c[y - 6, :, 3] > 40)
        c[y, :, 3] = np.where(darkpx & lone, 0, c[y, :, 3])
    al = c[..., 3] > 40; ys = np.where(al.sum(1) > 0)[0]; xs = np.where(al.sum(0) > 0)[0]
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    Image.fromarray(c[y0:y1, x0:x1]).save(f"{outdir}/{pre}{i}.png")
    meta.append({"img": f"{pre}{i}", "ox": float((cw - 12) / 2 - x0), "oy": float(y1 - y0), "w": int(x1 - x0), "h": int(y1 - y0)})
json.dump(meta, open(f"{outdir}/{pre}meta.json", "w"))
print(meta)
