# drawing scale per frame from the butterfly hair ornament (left side of the head, the bow is always on the right)
import json, numpy as np, sys
from PIL import Image
from scipy import ndimage
def bfly(p, f):
    a=p[...,3]>200; r,g,b=[p[...,i].astype(int) for i in range(3)]
    m=a&(b>100)&(b-g>55)&(r>60)&(g<140)
    ox=int(f['ox']); m[:, ox+int(40/f['k']):]=False          # left of a line just right of the feet anchor
    ys=np.nonzero(a.any(1))[0]; m[int(f['oy']-400/f['k']):, :]=False   # above 400 rig units below crown? -> keep only head height
    lab,n=ndimage.label(ndimage.binary_closing(m,iterations=2))
    if n==0: return None
    sz=np.bincount(lab.ravel())[1:]; k=np.argmax(sz)+1; yy,xx=np.nonzero(lab==k)
    return np.sqrt(sz[k-1])
if __name__=="__main__":
    D=sys.argv[1]; kf=json.load(open(D+"/kf.json")); out={}
    for c in kf:
        v=[]
        for f in kf[c]['frames']:
            h=bfly(np.asarray(Image.open(f"{D}/{f['img']}.png")),f); v.append(round(h*f['k'],1) if h else None)
        out[c]=v; v2=[x for x in v if x]; print(c.ljust(11),'med',np.median(v2),v)
    json.dump(out,open(D+"/bfly.json","w"))
