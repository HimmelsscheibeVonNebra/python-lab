"""A game save file: load progress from save.json, add one score, save it back.

    python3 save.py 120
"""
import json
import sys

SAVE = "save.json"


def new_game():
    return {"player": "민지", "plays": 0, "best": None, "history": [], "sound": True}


def load():
    try:
        with open(SAVE, encoding="utf-8") as f:
            return json.load(f)                  # JSON text -> dict
    except FileNotFoundError:
        print("no save file yet: new game")
    except json.JSONDecodeError as e:
        print(f"{SAVE} is broken ({e.msg}, line {e.lineno} column {e.colno}): new game")
    return new_game()


def save(data):
    with open(SAVE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)   # dict -> JSON text
        f.write("\n")


data = load()
score = int(sys.argv[1])
data["plays"] += 1
data["history"].append(score)
if data["best"] is None or score > data["best"]:
    data["best"] = score
save(data)
print(f"{data['player']}: play {data['plays']}, score {score}, best {data['best']}")
