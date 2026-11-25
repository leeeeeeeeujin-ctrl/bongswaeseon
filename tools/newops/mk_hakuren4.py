# Hakuren (other aspect), on-model parts (parts3_hakuren2.png). Arms folded into the torso drawing; blown variants on their own bones, shown by scaling.
import json
B = [("root", None, 0, 0), ("hip", "root", 90, -225), ("torso", "hip", 96, -150), ("head", "torso", 78, -346),
     ("hair_back", "head", 56, -596), ("hair_mid", "hair_back", 30, -420), ("hair_tip", "hair_mid", 20, -250),
     ("arm_r", "torso", 80, -330), ("forearm_r", "arm_r", 80, -290), ("hand_r", "forearm_r", 80, -250),
     ("arm_l", "torso", 110, -330), ("forearm_l", "arm_l", 110, -290), ("hand_l", "forearm_l", 110, -250),
     ("skirt", "hip", 100, -238), ("skirt_hem", "skirt", 100, -118),
     ("leg_r", "hip", 134, -150), ("shin_r", "leg_r", 134, -75), ("leg_l", "hip", 53, -150), ("shin_l", "leg_l", 53, -75),
     ("tail", "hip", -30, -190), ("tail_mid", "tail", -90, -130), ("tail_tip", "tail_mid", -140, -60),
     ("blow_hair", "head", 56, -596), ("blow_skirt", "hip", 100, -238), ("blow_tail", "hip", -30, -190)]
bones = [{"name": n, "parent": p, "x": x, "y": y} for n, p, x, y in B]
S = {
 "tail": {"img": "tail", "bone": "tail", "s": 0.8, "px": 190, "py": 14, "mesh": {"cols": 4, "rows": 6, "chain": ["tail", "tail_mid", "tail_tip"], "splits": [0.4, 0.75], "blend": 0.18}},
 "tail_flung": {"img": "tail_flung", "bone": "blow_tail", "s": 0.8, "px": 285, "py": 30},
 "hair_back": {"img": "hair_back", "bone": "hair_back", "s": 1.55, "px": 126, "py": 12, "mesh": {"cols": 4, "rows": 10, "chain": ["hair_back", "hair_mid", "hair_tip"], "splits": [0.4, 0.72], "blend": 0.14}},
 "hair_blown": {"img": "hair_blown", "bone": "blow_hair", "s": 1.55, "px": 260, "py": 14},
 "foot_f": {"img": "foot_f", "bone": "shin_l", "s": 0.44, "px": 50, "py": -150},
 "foot_n": {"img": "foot_n", "bone": "shin_r", "s": 0.44, "px": 50, "py": -150},
 "skirt": {"img": "skirt", "bone": "skirt", "s": 0.96, "px": 95, "py": 20, "mesh": {"cols": 5, "rows": 6, "chain": ["skirt", "skirt_hem"], "splits": [0.5], "blend": 0.2}},
 "skirt_flared": {"img": "skirt_flared", "bone": "blow_skirt", "s": 0.99, "px": 150, "py": 22},
 "torso": {"img": "torso", "bone": "torso", "s": 1.18, "px": 92, "py": 196},
 "head": {"img": "head", "bone": "head", "s": 1.14, "px": 140, "py": 268, "heads": True},
}
order = ["tail", "tail_flung", "hair_back", "hair_blown", "foot_f", "foot_n", "torso", "skirt", "skirt_flared", "head", "CROSS"]
rig = {"bones": bones, "front": {"slots": S, "order": order}, "back": {"slots": {}, "order": order},
 "arms": {"r": {"upper": "arm_r", "lower": "forearm_r", "hand": [0, 40], "bend": 1}, "l": {"upper": "arm_l", "lower": "forearm_l", "hand": [0, 40], "bend": 1}},
 "legs": {"r": {"upper": "leg_r", "lower": "shin_r", "foot": [0, 75], "bend": 1, "rest": [134, 0]}, "l": {"upper": "leg_l", "lower": "shin_l", "foot": [0, 75], "bend": 1, "rest": [53, 0]}},
 "hands": {"open": {"img": "none", "s": 0.1, "px": 0, "py": 0, "ang": 90}},
 "cross": {"img": "none", "s": 1, "px": 0, "py": 0, "grips": {g: {"r": [0, 0], "l": [0, 0]} for g in ("guard", "hammer", "top")}, "head": -100},
 "height": 640, "eyes": [], "heads": {"neutral": "head", "closed": "head_closed", "blink": "head_closed"}, "trail": [[240, 240, 255], [200, 210, 240], [150, 160, 210], [60, 60, 110]]}
json.dump(rig, open("art/hakuren4/u_rig.json", "w"))
