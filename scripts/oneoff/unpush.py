# One-off: take the phone pushes out of the house alert automations; Nice pushes now.
# Keeps everything else (House alerts, waits, loops, comments, notes) as it was.
import sys
from ruamel.yaml import YAML

yaml = YAML()
yaml.preserve_quotes = True
yaml.width = 4096
yaml.indent(mapping=2, sequence=2, offset=0)

ALIASES = {"HVAC - AC fault alert", "Kitchen - Range left on alert", "Kitchen - Oven left on alert",
           "Litter Box - Drawer full alert", "Litter Box - Litter refill alert"}
NOTE = " Its phone push comes from Nice (custom_templates/nice/), the same rules as the dashboard tile."

def is_push(step):
    return isinstance(step, dict) and str(step.get("action", "")).startswith("notify.")

def clean(seq):
    """Remove pushes from a sequence in place; returns True if anything is left."""
    for i in reversed(range(len(seq))):
        step = seq[i]
        if is_push(step):
            del seq[i]; continue
        if not isinstance(step, dict):
            continue
        if "repeat" in step and not clean(step["repeat"]["sequence"]):
            del seq[i]; continue
        if "if" in step:
            has_then = clean(step["then"])
            has_else = clean(step["else"]) if "else" in step else False
            if "else" in step and not has_else: del step["else"]
            if not has_then and not has_else: del seq[i]; continue
            if not has_then: step["then"] = [{"stop": "Nothing to do here; its push comes from Nice"}]
        if "choose" in step:
            for opt in step["choose"]:
                if not clean(opt["sequence"]):
                    opt["sequence"].append({"stop": "Its push comes from Nice"})
            if "default" in step and not clean(step["default"]):
                del step["default"]
    return len(seq) > 0

for path in sys.argv[1:]:
    doc = yaml.load(open(path))
    for a in doc.get("automation", []):
        if a.get("alias") in ALIASES:
            clean(a["actions"])
            if NOTE.strip() not in a["description"]:
                a["description"] = a["description"].rstrip() + NOTE
            print(path, "→", a["alias"])
    yaml.dump(doc, open(path, "w"))
