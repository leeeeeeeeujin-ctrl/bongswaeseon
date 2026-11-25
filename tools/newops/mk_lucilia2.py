import json
B = [("root", None, 0, 0), ("hip", "root", 30, -160), ("torso", "hip", 30, -212), ("head", "torso", 30, -336),
     ("hair_back", "head", -20, -520), ("hair_mid", "hair_back", -34, -370), ("hair_tip", "hair_mid", -44, -240),
     ("arm_r", "torso", -4, -318), ("forearm_r", "arm_r", -4, -258), ("hand_r", "forearm_r", -4, -196),
     ("arm_l", "torso", 66, -320), ("forearm_l", "arm_l", 66, -260), ("hand_l", "forearm_l", 66, -198),
     ("skirt", "hip", 30, -222), ("skirt_hem", "skirt", 30, -140),
     ("leg_r", "hip", -8, -150), ("shin_r", "leg_r", -8, -75), ("leg_l", "hip", 62, -150), ("shin_l", "leg_l", 62, -75)]
bones = [{"name": n, "parent": p, "x": x, "y": y} for n, p, x, y in B]
S = {
 "hair_back": {"img": "hair_back", "bone": "hair_back", "s": 1.3, "px": 190, "py": 30, "rot": -14, "mesh": {"cols": 4, "rows": 8, "chain": ["hair_back", "hair_mid", "hair_tip"], "splits": [0.45, 0.75], "blend": 0.16}},
 "ribbon": {"img": "ribbon", "bone": "hair_back", "s": 0.5, "px": 150, "py": -120},
 "uarm_f": {"img": "uarm_f", "bone": "arm_l", "s": 0.58, "px": 46, "py": 36, "rot": 29},
 "leg_f": {"img": "leg_f", "bone": "leg_l", "s": 0.78, "px": 50, "py": 6, "mesh": {"cols": 2, "rows": 8, "chain": ["leg_l", "shin_l"], "splits": [0.45], "blend": 0.12}},
 "leg_n": {"img": "leg_n", "bone": "leg_r", "s": 0.78, "px": 44, "py": 6, "mesh": {"cols": 2, "rows": 8, "chain": ["leg_r", "shin_r"], "splits": [0.45], "blend": 0.12}},
 "skirt": {"img": "skirt", "bone": "skirt", "s": 0.8, "px": 136, "py": 10, "mesh": {"cols": 6, "rows": 5, "chain": ["skirt", "skirt_hem"], "splits": [0.55], "blend": 0.2}},
 "torso": {"img": "torso", "bone": "torso", "s": 0.95, "px": 92, "py": 150},
 "farm_f": {"img": "farm_f", "bone": "forearm_l", "s": 0.54, "px": 24, "py": 72, "rot": 103},
 "book": {"img": "book", "bone": "hand_l", "s": 0.6, "px": 126, "py": 110},
 "head": {"img": "head", "bone": "head", "s": 1.28, "px": 150, "py": 206, "heads": True},
 "uarm_n": {"img": "uarm_n", "bone": "arm_r", "s": 0.58, "px": 92, "py": 36, "rot": -33},
 "farm_n": {"img": "farm_n", "bone": "forearm_r", "s": 0.54, "px": 24, "py": 68, "rot": 108},
}
order = ["hair_back", "ribbon", "uarm_f", "leg_f", "leg_n", "skirt", "torso", "farm_f", "book", "head", "CROSS", "uarm_n", "farm_n"]
rig = {"bones": bones, "front": {"slots": S, "order": order}, "back": {"slots": {}, "order": order},
 "arms": {"r": {"upper": "arm_r", "lower": "forearm_r", "hand": [0, 62], "bend": 1}, "l": {"upper": "arm_l", "lower": "forearm_l", "hand": [0, 62], "bend": 1}},
 "legs": {"r": {"upper": "leg_r", "lower": "shin_r", "foot": [0, 75], "bend": 1, "rest": [-12, 0]}, "l": {"upper": "leg_l", "lower": "shin_l", "foot": [0, 75], "bend": 1, "rest": [66, -2]}},
 "hands": {"open": {"img": "none", "s": 0.1, "px": 0, "py": 0, "ang": 90}},
 "cross": {"img": "staff", "s": 1.36, "px": 50, "py": 176, "grips": {g: {"r": [0, 0], "l": [0, 0]} for g in ("guard", "hammer", "top")}, "head": -170},
 "height": 640, "eyes": [], "heads": {"neutral": "head", "closed": "head_closed", "blink": "head_closed"}, "trail": [[255, 250, 220], [255, 190, 90], [240, 110, 40], [120, 30, 10]]}
json.dump(rig, open("art/lucilia2/u_rig.json", "w"))
