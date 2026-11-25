# hakuren (other aspect) on GPT-style parts. Arms are folded into the torso drawings; the "blown" drawings (torso2, hair_blown, skirt_flared, tail_flung)
# sit on their own bones and are shown by scaling those bones up from 0 (and the calm ones down).
import json
B = [("root", None, 0, 0), ("hip", "root", 20, -200), ("torso", "hip", 40, -206), ("head", "torso", 6, -364),
     ("hair_back", "head", 10, -600), ("hair_mid", "hair_back", 0, -450), ("hair_tip", "hair_mid", -6, -300),
     ("arm_r", "torso", 0, -330), ("forearm_r", "arm_r", 0, -280), ("hand_r", "forearm_r", 0, -230),
     ("arm_l", "torso", 40, -330), ("forearm_l", "arm_l", 40, -280), ("hand_l", "forearm_l", 40, -230),
     ("skirt", "hip", 32, -268), ("skirt_hem", "skirt", 32, -130),
     ("leg_r", "hip", 8, -180), ("shin_r", "leg_r", 8, -90), ("leg_l", "hip", 66, -180), ("shin_l", "leg_l", 66, -90),
     ("tail", "hip", -10, -210), ("tail_mid", "tail", -70, -170), ("tail_tip", "tail_mid", -110, -120),
     ("torso2", "torso", 40, -206), ("blow_hair", "head", 10, -600), ("blow_skirt", "hip", 32, -268), ("blow_tail", "hip", -10, -210)]
bones = [{"name": n, "parent": p, "x": x, "y": y} for n, p, x, y in B]
S = {
 "tail": {"img": "tail", "bone": "tail", "s": 0.82, "px": 196, "py": 28, "rot": 0, "mesh": {"cols": 4, "rows": 6, "chain": ["tail", "tail_mid", "tail_tip"], "splits": [0.4, 0.75], "blend": 0.18}},
 "tail_flung": {"img": "tail_flung", "bone": "blow_tail", "s": 0.82, "px": 330, "py": 40},
 "hair_back": {"img": "hair_back", "bone": "hair_back", "s": 1.38, "px": 110, "py": 16, "mesh": {"cols": 4, "rows": 8, "chain": ["hair_back", "hair_mid", "hair_tip"], "splits": [0.45, 0.75], "blend": 0.16}},
 "hair_blown": {"img": "hair_blown", "bone": "blow_hair", "s": 1.38, "px": 200, "py": 20},
 "leg_f": {"img": "leg_f", "bone": "leg_l", "s": 0.86, "px": 46, "py": 10, "mesh": {"cols": 2, "rows": 8, "chain": ["leg_l", "shin_l"], "splits": [0.45], "blend": 0.12}},
 "leg_n": {"img": "leg_n", "bone": "leg_r", "s": 0.86, "px": 44, "py": 10, "mesh": {"cols": 2, "rows": 8, "chain": ["leg_r", "shin_r"], "splits": [0.45], "blend": 0.12}},
 "skirt": {"img": "skirt", "bone": "skirt", "s": 1.02, "px": 107, "py": 8, "mesh": {"cols": 6, "rows": 5, "chain": ["skirt", "skirt_hem"], "splits": [0.55], "blend": 0.2}},
 "skirt_flared": {"img": "skirt_flared", "bone": "blow_skirt", "s": 1.02, "px": 156, "py": 8},
 "torso": {"img": "torso", "bone": "torso", "s": 1.24, "px": 75, "py": 150},
 "torso2": {"img": "torso2", "bone": "torso2", "s": 1.24, "px": 79, "py": 156},
 "head": {"img": "head", "bone": "head", "s": 1.4, "px": 108, "py": 205, "heads": True},
}
order = ["tail", "tail_flung", "hair_back", "hair_blown", "leg_f", "leg_n", "skirt", "skirt_flared", "torso", "torso2", "head", "CROSS"]
rig = {"bones": bones, "front": {"slots": S, "order": order}, "back": {"slots": {}, "order": order},
 "arms": {"r": {"upper": "arm_r", "lower": "forearm_r", "hand": [0, 50], "bend": 1}, "l": {"upper": "arm_l", "lower": "forearm_l", "hand": [0, 50], "bend": 1}},
 "legs": {"r": {"upper": "leg_r", "lower": "shin_r", "foot": [0, 90], "bend": 1, "rest": [8, 0]}, "l": {"upper": "leg_l", "lower": "shin_l", "foot": [0, 90], "bend": 1, "rest": [66, -2]}},
 "hands": {"open": {"img": "none", "s": 0.1, "px": 0, "py": 0, "ang": 90}},
 "cross": {"img": "none", "s": 1, "px": 0, "py": 0, "grips": {g: {"r": [0, 0], "l": [0, 0]} for g in ("guard", "hammer", "top")}, "head": -100},
 "height": 640, "eyes": [], "heads": {"neutral": "head", "closed": "head_closed", "blink": "head_closed"}, "trail": [[240, 240, 255], [200, 210, 240], [150, 160, 210], [60, 60, 110]]}
json.dump(rig, open("art/hakuren3/u_rig.json", "w"))
