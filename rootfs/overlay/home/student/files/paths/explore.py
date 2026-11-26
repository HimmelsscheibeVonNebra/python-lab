"""Look around the notes/ folder with pathlib.

    python3 explore.py
"""
from pathlib import Path

folder = Path("notes")
print("folder:", folder, "| exists:", folder.exists(), "| is_dir:", folder.is_dir())

# iterdir(): everything directly inside the folder (order is not fixed, so sort)
for p in sorted(folder.iterdir()):
    kind = "dir " if p.is_dir() else "file"
    print(" ", kind, p.name)

# glob(): only the names that match a pattern
print("*.txt in notes:")
for p in sorted(folder.glob("*.txt")):
    lines = p.read_text(encoding="utf-8").splitlines()
    print(f"  {p.name}: {len(lines)} lines, first line {lines[0]!r}")

# rglob(): the same pattern in every subfolder too
print("*.txt anywhere below notes:")
for p in sorted(folder.rglob("*.txt")):
    print("  ", p)
