# Lucilia, on-model parts (parts3_lucilia.png): silver hair, butterfly ornaments, white frilly dress; casts with bare hands.
import json
B = [("root", None, 0, 0), ("hip", "root", 54, -170), ("torso", "hip", 62, -212), ("head", "torso", 104, -362),
     ("hair_back", "head", 84, -606), ("hair_mid", "hair_back", 74, -426), ("hair_tip", "hair_mid", 66, -240),
     ("arm_r", "torso", -24, -304), ("forearm_r", "arm_r", -24, -206), ("hand_r", "forearm_r", -24, -112),
     ("arm_l", "torso", 126, -306), ("forearm_l", "arm_l", 126, -208), ("hand_l", "forearm_l", 126, -114),
     ("skirt", "hip", 62, -196), ("skirt_hem", "skirt", 62, -90),
     ("leg_r", "hip", 36, -110), ("shin_r", "leg_r", 36, -55), ("leg_l", "hip", 76, -110), ("shin_l", "leg_l", 76, -55),
     ("blow_hair", "head", 84, -606)]
bones = [{"name": n, "parent": p, "x": x, "y": y} for n, p, x, y in B]
S = {
 "hair_back": {"img": "hair_back", "bone": "hair_back", "s": 1.8, "px": 124, "py": 12, "mesh": {"cols": 4, "rows": 10, "chain": ["hair_back", "hair_mid", "hair_tip"], "splits": [0.4, 0.72], "blend": 0.14}},
 "hair_blown": {"img": "hair_blown", "bone": "blow_hair", "s": 1.8, "px": 300, "py": 14},
 "uarm_f": {"img": "sleeve_f", "bone": "arm_l", "s": 0.6, "sx": 0.8, "px": 70, "py": 2},
 "uarm_f_hi": {"img": "sleeve_f", "bone": "arm_l", "s": 0.6, "sx": 0.8, "px": 70, "py": 2, "showIf": "armhi"},
 "farm_f": {"img": "farm_f", "bone": "forearm_l", "s": 0.46, "px": 28, "py": 124, "rot": 114},
 "leg_f": {"img": "leg_f", "bone": "leg_l", "s": 0.55, "px": 48, "py": 6, "mesh": {"cols": 2, "rows": 6, "chain": ["leg_l", "shin_l"], "splits": [0.45], "blend": 0.12}},
 "leg_n": {"img": "leg_n", "bone": "leg_r", "s": 0.55, "px": 46, "py": 6, "mesh": {"cols": 2, "rows": 6, "chain": ["leg_r", "shin_r"], "splits": [0.45], "blend": 0.12}},
 "skirt": {"img": "skirt", "bone": "skirt", "s": 0.98, "sx": 1.0, "px": 160, "py": 10, "mesh": {"cols": 6, "rows": 5, "chain": ["skirt", "skirt_hem"], "splits": [0.5], "blend": 0.2}},
 "torso": {"img": "torso", "bone": "torso", "s": 1.06, "px": 114, "py": 160},
 "head": {"img": "head", "bone": "head", "s": 1.26, "px": 170, "py": 200, "heads": True},
 "uarm_n": {"img": "sleeve_n", "bone": "arm_r", "s": 0.6, "sx": 0.8, "px": 68, "py": 2},
 "farm_n": {"img": "farm_n", "bone": "forearm_r", "s": 0.44, "px": 34, "py": 150, "rot": 123},
}
order = ["hair_back", "hair_blown", "leg_f", "leg_n", "skirt", "uarm_f", "uarm_n", "torso", "farm_f", "head", "CROSS", "farm_n"]
rig = {"bones": bones, "front": {"slots": S, "order": order}, "back": {"slots": {}, "order": order},
 "arms": {"r": {"upper": "arm_r", "lower": "forearm_r", "hand": [0, 94], "bend": 1}, "l": {"upper": "arm_l", "lower": "forearm_l", "hand": [0, 94], "bend": 1}},
 "legs": {"r": {"upper": "leg_r", "lower": "shin_r", "foot": [0, 55], "bend": 1, "rest": [36, 0]}, "l": {"upper": "leg_l", "lower": "shin_l", "foot": [0, 55], "bend": 1, "rest": [76, 0]}},
 "hands": {"open": {"img": "none", "s": 0.1, "px": 0, "py": 0, "ang": 90}},
 "cross": {"img": "none", "s": 1, "px": 0, "py": 0, "grips": {g: {"r": [0, 0], "l": [0, 0]} for g in ("guard", "hammer", "top")}, "head": -100},
 "height": 640, "eyes": [], "heads": {"neutral": "head", "closed": "head_closed", "blink": "head_closed"}, "trail": [[250, 240, 255], [200, 160, 255], [140, 90, 220], [60, 30, 110]]}
json.dump(rig, open("art/lucilia3/u_rig.json", "w"))
