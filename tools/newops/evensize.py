# evens out drawing size across clips: butterfly ornament size (bflysz.py) matched to the idle median.
# whole sheet by its median; a clip listed in PERFRAME follows each frame (smoothed), for sheets GPT drew drifting in size
import json, sys, numpy as np
D=sys.argv[1]; PERFRAME=set(sys.argv[2].split(",")) if len(sys.argv)>2 else set()
kf=json.load(open(D+"/kf.json")); B=json.load(open(D+"/bfly.json"))
ref=np.median([x for x in B['idle'] if x])
for c in kf:
    v=np.array([x if x else np.nan for x in B[c]],float); med=np.nanmedian(v)
    if c in PERFRAME:
        v[np.isnan(v)|(v<0.7*med)]=np.nan; v=np.where(np.isnan(v),med,v)
        v=np.array([np.median(v[max(0,i-2):i+3]) for i in range(len(v))])
    else: v=np.full(len(v),med)
    for f,s in zip(kf[c]['frames'],v): f['k']*=ref/s
    print(c, round(float(ref/med),3))
json.dump(kf,open(D+"/kf.json","w"))
