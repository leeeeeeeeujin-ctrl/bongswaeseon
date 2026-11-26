# inline assets/fxl_*.webp into fxtex.js (the painted textures fxlib.js adopts)
import os, base64, json, glob
A = "/home/claude/assets/"
d = {os.path.basename(p)[4:-5]: "data:image/webp;base64," + base64.b64encode(open(p, "rb").read()).decode() for p in sorted(glob.glob(A + "fxl_*.webp"))}
open(os.path.join(os.path.dirname(__file__), "..", "fxtex.js"), "w").write("// painted effect textures for fxlib.js (assets/fxl_*.webp, inlined; regenerate with tools/mk_fxtex.py)\nwindow.FXTEX = " + json.dumps(d) + ";\n")
print(len(d))
