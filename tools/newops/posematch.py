# scale between two frames drawn in the same pose (whole figure matched over scales); used to tie clips together where they meet
import json, sys, numpy as np, cv2
from PIL import Image
def rend(D, f, Z=0.4):
    im=Image.open(f"{D}/{f['img']}.png").convert("RGBA"); k=f['k']*Z
    im=im.resize((max(1,round(im.width*k)),max(1,round(im.height*k))),Image.LANCZOS)
    bg=Image.new("RGBA",(im.width+200,im.height+200),(128,128,128,255)); bg.alpha_composite(im,(100,100)); return np.asarray(bg.convert("L")).astype(np.float32), im
def scale(D, fa, fb):
    A,_=rend(D,fa); B,imb=rend(D,fb); best=(-1,1)
    T=B[100:100+imb.height, 100:100+imb.width]
    T=T[:int(T.shape[0]*0.45)]   # head and shoulders
    for s in np.arange(0.6,1.6,0.01):
        t=cv2.resize(T,None,fx=s,fy=s)
        if t.shape[0]>=A.shape[0] or t.shape[1]>=A.shape[1]: continue
        r=cv2.matchTemplate(A,t,cv2.TM_CCOEFF_NORMED).max()
        if r>best[0]: best=(r,s)
    return best   # fb drawn * s == fa
