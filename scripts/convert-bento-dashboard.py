import json, sys, re
src = json.load(open(sys.argv[1]))
ORDER = ["Lights", "Scenes", "Climate", "Playing", "Doors & windows", "Motion", "Plugs & more", "Power"]
def rename(o):
    if isinstance(o, list): return [rename(x) for x in o]
    if isinstance(o, dict):
        o = {k: rename(v) for k, v in o.items()}
        if isinstance(o.get("type"), str) and o["type"].startswith("custom:bento-"): o["type"] = o["type"].replace("custom:bento-", "custom:nice-")
        if o.get("type") == "custom:nice-grid": o.pop("entity", None)
        for k in ("base_path", "back_path"):
            if isinstance(o.get(k), str): o[k] = o[k].replace("/house-bento", "/house-nice")
        return o
    return o
out = {"views": []}
for v in src["views"]:
    v = rename(v)
    if not v.get("path", "").startswith("room-"):
        out["views"].append(v); continue
    cards = [c for s in v["sections"] for c in s["cards"]]
    hero = next(c for c in cards if c["type"] == "custom:nice-room")
    area = hero["area"]
    sections, prev, seen = {}, None, set()
    untitled = 0
    for c in cards:
        if c["type"] != "custom:nice-controls": continue
        title = c.get("title", "")
        key = title or f"_{untitled}"
        if not title: untitled += 1
        o = {k: val for k, val in c.items() if k not in ("type", "grid_options", "strip", "room_tone", "title")}
        if not title: o["title"] = ""
        if key not in ORDER:
            if prev: o["after"] = prev
            else: o["before"] = next((t for t in ORDER if True), "Lights")
        if c.get("strip") is not None and c.get("strip") != [v["title"]]: o["strip"] = c["strip"]
        if "room_tone" not in c: o["room_tone"] = None
        sections[key] = o; seen.add(key)
        prev = title if title else prev
    for t in ORDER:
        if t not in seen: sections[t] = {"hide": True}
    page = {"type": "custom:nice-room-page", "area": area, "base_path": "/house-nice", "back": hero.get("back", "home"), "sections": sections}
    page["grid_options"] = {"columns": "full"}
    out["views"].append({"title": v["title"], "path": v["path"], "subview": True, "back_path": v.get("back_path"), "type": "sections", "max_columns": 3, "sections": [{"type": "grid", "column_span": 3, "cards": [page]}]})
json.dump(out, open(sys.argv[2], "w"), indent=1)
print(len(json.dumps(src)), "->", len(json.dumps(out)))
