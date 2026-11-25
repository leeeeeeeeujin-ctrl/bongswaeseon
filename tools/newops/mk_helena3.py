# Helena, on-model parts (parts3_helena.png): red curly hair, pointed elf ears, wide witch hat, dark cape and robe, crooked wooden cane.
import json
HDX = 0
B = [("root", None, 0, 0), ("hip", "root", 64, -170), ("torso", "hip", 70, -184), ("head", "torso", 88, -300), ("hat", "head", 52, -462),
     ("hair_back", "head", 40, -430), ("hair_mid", "hair_back", 36, -330), ("hair_tip", "hair_mid", 32, -210),
     ("cape", "torso", 120, -290),
     ("arm_r", "torso", 22, -272), ("forearm_r", "arm_r", 22, -187), ("hand_r", "forearm_r", 22, -92),
     ("arm_l", "torso", 140, -274), ("forearm_l", "arm_l", 140, -189), ("hand_l", "forearm_l", 140, -94),
     ("skirt", "hip", 64, -236), ("skirt_hem", "skirt", 64, -110),
     ("leg_r", "hip", 40, -110), ("shin_r", "leg_r", 40, -55), ("leg_l", "hip", 92, -110), ("shin_l", "leg_l", 92, -55)]
bones = [{"name": n, "parent": p, "x": x, "y": y} for n, p, x, y in B]
S = {
 "cloak_tail": {"img": "cloak_tail", "bone": "cape", "s": 1.0, "px": 262, "py": 12},
 "hair_back": {"img": "hair_back", "bone": "hair_back", "s": 1.14, "px": 164, "py": 8, "mesh": {"cols": 5, "rows": 6, "chain": ["hair_back", "hair_mid", "hair_tip"], "splits": [0.4, 0.75], "blend": 0.16}},
 "foot_f": {"img": "foot_f", "bone": "shin_l", "s": 0.62, "px": 48, "py": 10},
 "foot_n": {"img": "foot_n", "bone": "shin_r", "s": 0.62, "px": 46, "py": 10},
 "robe": {"img": "robe", "bone": "skirt", "s": 1.12, "px": 166, "py": 8, "mesh": {"cols": 6, "rows": 5, "chain": ["skirt", "skirt_hem"], "splits": [0.5], "blend": 0.2}},
 "torso": {"img": "torso", "bone": "torso", "s": 1.0, "px": 112, "py": 150},
 "uarm_f": {"img": "uarm_f", "bone": "arm_l", "s": 0.62, "px": 62, "py": 22},
 "farm_f": {"img": "farm_f", "bone": "forearm_l", "s": 0.62, "px": 42, "py": 42, "rot": 79},
 "head": {"img": "head", "bone": "head", "s": 1.08, "px": 162, "py": 186, "heads": True},
 "hat_back": {"img": "hat", "bone": "hat", "s": 1.5, "px": 168, "py": 150},
 "hat": {"img": "hat_front", "bone": "hat", "s": 1.5, "px": 168, "py": 150},
 "uarm_n": {"img": "uarm_n", "bone": "arm_r", "s": 0.62, "px": 62, "py": 22},
 "farm_n": {"img": "farm_n", "bone": "forearm_r", "s": 0.62, "px": 14, "py": 40, "rot": 86, "hideIf": "armlow"},
 "farm_n_lo": {"img": "farm_n", "bone": "forearm_r", "s": 0.62, "px": 14, "py": 40, "rot": 86, "showIf": "armlow"},
}
order = ["cloak_tail", "hair_back", "foot_f", "foot_n", "robe", "uarm_f", "uarm_n", "farm_f", "torso", "farm_n_lo", "hat_back", "head", "hat", "CROSS", "farm_n"]
cs = 0.95
def L(x, y): return [round((x - 62) * cs), round((y - 78) * cs)]
rig = {"bones": bones, "front": {"slots": S, "order": order}, "back": {"slots": {}, "order": order},
 "arms": {"r": {"upper": "arm_r", "lower": "forearm_r", "hand": [0, 95], "bend": 1}, "l": {"upper": "arm_l", "lower": "forearm_l", "hand": [0, 95], "bend": 1}},
 "legs": {"r": {"upper": "leg_r", "lower": "shin_r", "foot": [0, 55], "bend": 1, "rest": [40, 0]}, "l": {"upper": "leg_l", "lower": "shin_l", "foot": [0, 55], "bend": 1, "rest": [92, 0]}},
 "hands": {"open": {"img": "none", "s": 0.1, "px": 0, "py": 0, "ang": 90}},
 "cross": {"img": "cane", "s": cs, "px": 62, "py": 78, "grips": {"top": {"r": L(40, 18), "l": L(34, 2)}, "guard": {"r": L(54, 170), "l": L(56, 148)}, "hammer": {"r": L(47, 236), "l": L(49, 214)}}, "head": L(30, 6)[1]},
 "height": 640, "eyes": [], "heads": {"neutral": "head", "closed": "head_grin", "blink": "head", "grin": "head_grin"}, "trail": [[255, 200, 120], [255, 120, 60], [220, 70, 40], [90, 30, 20]]}
import os
from headshift import shift_head
shift_head(rig["bones"], float(os.environ.get("HEADDX", HDX)))
json.dump(rig, open("art/helena3/u_rig.json", "w"))
print(rig["cross"])
