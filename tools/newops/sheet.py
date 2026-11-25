import sys
from PIL import Image, ImageDraw
d=sys.argv[1]; names=sys.argv[3].split(','); out=sys.argv[2]
ims=[Image.open(f"{d}/{n}.png").convert("RGBA") for n in names]
W=sum(i.width+30 for i in ims); H=max(i.height for i in ims)+40
sh=Image.new("RGBA",(W,H),(70,80,95,255)); dr=ImageDraw.Draw(sh); x=10
for n,i in zip(names,ims):
    sh.alpha_composite(i,(x,30)); dr.rectangle([x,30,x+i.width,30+i.height],outline=(255,255,0,255))
    for gy in range(0,i.height,50): dr.line([x-6,30+gy,x,30+gy],fill=(255,255,255,255)); dr.text((x+2,30+gy),str(gy),fill=(255,255,0,255))
    for gx in range(0,i.width,50): dr.line([x+gx,24,x+gx,30],fill=(255,255,255,255))
    dr.text((x,5),f"{n} {i.width}x{i.height}",fill=(255,255,255,255)); x+=i.width+30
sh.save(out)
