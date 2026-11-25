# move the head and everything hanging from it by dx (rig units); used by the mk_*.py scripts before the rig is written
def shift_head(bones, dx, root="head"):
    kids = {root}
    changed = True
    while changed:
        changed = False
        for b in bones:
            if b["parent"] in kids and b["name"] not in kids: kids.add(b["name"]); changed = True
    for b in bones:
        if b["name"] in kids: b["x"] += dx
    return bones
