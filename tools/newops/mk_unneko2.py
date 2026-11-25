# unneko rig from the GPT-style parts (art/unneko2). Units: feet on y=0, about 640 tall. n = near (viewer) side, f = far side; rig3 names: r = near, l = far.
import json
P = {}   # tweakables
B = [("root", None, 0, 0), ("hip", "root", 22, -172), ("torso", "hip", 22, -196), ("head", "torso", 30, -318),
     ("arm_r", "torso", -4, -288), ("forearm_r", "arm_r", -4, -212), ("hand_r", "forearm_r", -4, -137),
     ("arm_l", "torso", 62, -292), ("forearm_l", "arm_l", 62, -216), ("hand_l", "forearm_l", 62, -141),
     ("leg_r", "hip", -2, -168), ("shin_r", "leg_r", -2, -84), ("leg_l", "hip", 46, -168), ("shin_l", "leg_l", 46, -84),
     ("tail", "hip", -62, -176), ("tail_mid", "tail", -104, -104), ("tail_tip", "tail_mid", -96, -30),
     ("scarf", "torso", -14, -316), ("scarf_tip", "scarf", -70, -300), ("scarf2", "torso", -12, -304), ("scarf2_tip", "scarf2", -64, -280),
     ("hair_back", "head", 0, -600), ("hair_mid", "hair_back", 0, -500), ("hair_tip", "hair_mid", 0, -400), ("skirt", "hip", 0, -200), ("skirt_hem", "skirt", 0, -150)]
LEG = {"leg_r": (-16, -225), "shin_r": (-16, -112), "leg_l": (36, -225), "shin_l": (36, -112)}
bones = [{"name": n, "parent": p, "x": (LEG[n][0] if n in LEG else x - 5 + (38 if n in ("head", "hair_back", "hair_mid", "hair_tip") else 0) if n != "root" else 0), "y": (LEG[n][1] if n in LEG else y - 57 if n != "root" else 0)} for n, p, x, y in B]
S = {
 "tail": {"img": "tail", "bone": "tail", "s": 0.62, "px": 120, "py": 14, "mesh": {"cols": 3, "rows": 10, "chain": ["tail", "tail_mid", "tail_tip"], "splits": [0.4, 0.74], "blend": 0.16}},
 "scarf_a": {"img": "scarf_a", "bone": "scarf", "s": 0.62, "px": 160, "py": 46, "rot": 8},
 "scarf_b": {"img": "scarf_b", "bone": "scarf2", "s": 0.6, "px": 154, "py": 20, "rot": -10},
 "uarm_f": {"img": "uarm_f", "bone": "arm_l", "s": 0.44, "px": 50, "py": 38, "rot": 14},
 "leg_f": {"img": "leg_f", "bone": "leg_l", "s": 0.74, "px": 52, "py": 30, "mesh": {"cols": 2, "rows": 10, "chain": ["leg_l", "shin_l"], "splits": [0.48], "blend": 0.12}},
 "leg_n": {"img": "leg_n", "bone": "leg_r", "s": 0.74, "px": 62, "py": 30, "mesh": {"cols": 2, "rows": 10, "chain": ["leg_r", "shin_r"], "splits": [0.48], "blend": 0.12}},
 "hips": {"img": "hips", "bone": "hip", "s": 0.84, "px": 97, "py": 50},
 "torso": {"img": "torso", "bone": "torso", "s": 0.9, "px": 150, "py": 218},
 "head": {"img": "head", "bone": "head", "s": 1.05, "px": 196, "py": 262, "heads": True},
 "farm_f": {"img": "farm_f", "bone": "forearm_l", "s": 0.5, "px": 26, "py": 56, "rot": 76},
 "uarm_n": {"img": "uarm_n", "bone": "arm_r", "s": 0.46, "px": 96, "py": 38, "rot": -12},
 "farm_n": {"img": "farm_n", "bone": "forearm_r", "s": 0.52, "px": 26, "py": 50, "rot": 78},
}
order = ["tail", "scarf_b", "scarf_a", "uarm_f", "leg_f", "leg_n", "hips", "torso", "head", "CROSS", "farm_f", "uarm_n", "farm_n"]
ws = 0.78
rig = {"bones": bones, "front": {"slots": S, "order": order}, "back": {"slots": {}, "order": order},
 "arms": {"r": {"upper": "arm_r", "lower": "forearm_r", "hand": [0, 75], "bend": 1}, "l": {"upper": "arm_l", "lower": "forearm_l", "hand": [0, 75], "bend": 1}},
 "legs": {"r": {"upper": "leg_r", "lower": "shin_r", "foot": [0, 112], "bend": 1, "rest": [-50, 0]}, "l": {"upper": "leg_l", "lower": "shin_l", "foot": [0, 112], "bend": 1, "rest": [46, -3]}},
 "hands": {"open": {"img": "none", "s": 0.1, "px": 0, "py": 0, "ang": 90}},
 "cross": {"img": "saw", "s": ws, "px": 110, "py": 110, "grips": {g: {"r": [-58, 14], "l": [22, -65]} for g in ("guard", "hammer", "top")}, "head": -300},
 "height": 640, "eyes": [], "heads": {"neutral": "head", "closed": "head_closed", "blink": "head_closed"}, "trail": [[255, 244, 232], [255, 154, 104], [206, 55, 45], [80, 14, 22]]}
json.dump(rig, open("art/unneko2/u_rig.json", "w"))
