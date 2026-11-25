# Lucilia frames: cut sheets -> even out size per clip (butterfly ornament) -> tie the summon to idle/shot where poses meet
set -e
python3 mk_lucilia6.py
python3 bflysz.py art/lucilia6 >/dev/null
python3 evensize.py art/lucilia6
python3 -c "
import json; D='art/lucilia6'; kf=json.load(open(D+'/kf.json'))
for f in kf['skill']['frames']: f['k']*=0.915     # summon: matched to idle at its start and to the shot at its end
for f in kf['attack']['frames']: f['k']/=1.02
json.dump(kf,open(D+'/kf.json','w'))"
