# Steadies a clip of separately generated drawings: each frame's head is template-matched onto the first frame's head
# (grey image, so eyes and outlines line up, not just the silhouette); x and y both come from the head, then y is
# pulled back so the soles stay on the ground line.
import json, sys, numpy as np, cv2
from PIL import Image
Z = 0.5   # work at half rig scale
def comp(D, f):
    im = Image.open(f"{D}/{f['img']}.png").convert("RGBA"); k = f["k"] * Z
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    W, H = 900, 520; can = Image.new("RGBA", (W, H), (128, 128, 128, 255))
    x0, y0 = round(W / 2 - f["ox"] * k), round(H - 20 - f["oy"] * k); can.alpha_composite(im, (x0, y0))
    p = np.asarray(im).astype(int); body = (p[..., 3] > 128) & ~((p[..., 2] - p[..., 1] > 40) & (p[..., 0] - p[..., 1] > 15))   # the bow and spell light left out
    return np.asarray(can.convert("L")).astype(np.float32), body * 255, (x0, y0)
def head_box(g, a, off):
    ys, xs = np.nonzero(a > 128); top = ys.min() + off[1]
    # head: from the crown down 150 rig units (75 here); x: around the column with the most pixels in that band
    band = (a[ys.min():ys.min() + 75] > 128); cx = int(np.median(np.nonzero(band)[1])) + off[0]
    return max(0, cx - 55), top, 110, 75
def align(D, clip, search=30, ref=0):
    F = clip["frames"]; g0, a0, o0 = comp(D, F[ref]); x, y, w, h = head_box(g0, a0, o0); T = g0[y:y + h, x:x + w]; out = []
    for f in F:
        g, a, o = comp(D, f)
        R = g[max(0, y - search):y + h + search, max(0, x - search):x + w + search]
        if R.shape[0] < h or R.shape[1] < w: out.append((0, 0, 0)); continue
        res = cv2.matchTemplate(R, T, cv2.TM_CCOEFF_NORMED); _, sc, _, loc = cv2.minMaxLoc(res)
        dx = loc[0] - (x - max(0, x - search)); dy = loc[1] - (y - max(0, y - search))
        f["ox"] += dx / (f["k"] * Z)   # x from the head; y stays on the soles so crouches never lift the feet off the ground
        out.append((int(-dx / Z), int(-dy / Z), round(sc, 2)))
    return out
if __name__ == "__main__":
    D = sys.argv[1]; clips = sys.argv[2].split(","); kf = json.load(open(f"{D}/kf.json"))
    for c in clips:
        nm, _, r = c.partition(":"); print(nm, align(D, kf[nm], 60 if r else 30, int(r or 0)))
    json.dump(kf, open(f"{D}/kf.json", "w"))
