#!/usr/bin/env python3
"""Copies the course code into course/, which scripts/build-images.sh installs
under /home/student in the guest, rearranged into topic folders.

The course repository is organized by week (Codes/week03/starter/session1,
Sample/sample2 ...); the lab is organized by topic.  course-layout.json maps
each path of the repository (Codes/ and Sample/ seen as one tree:
week03/..., sample/...) to its place in the guest (loops/starter, web/sample2
...); the longest matching prefix wins.  Every copied file must be mapped.

sample3 (Naver news API) needs the network, which the guest does not have;
Sample/README.md and verify.py cover all four samples, so they stay out too.

    scripts/sync-course.py [path/to/2026_BasicProgrammingUsingPython]
"""

import json
import shutil
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
COURSE = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO.parent / "2026_BasicProgrammingUsingPython"
SKIP_NAMES = {".DS_Store", ".gitkeep"}
SKIP_SUFFIXES = {".zip", ".ipynb"}
SKIP_DIRS = {"__pycache__", ".venv", "instance"}
SAMPLES = ["sample1", "sample2", "sample4"]

layout = json.loads((REPO / "course-layout.json").read_text())


def target(rel):
    best = max((a for a, _ in layout if rel == a or rel.startswith(a + "/")), key=len, default=None)
    if best is None:
        sys.exit(f"sync-course: no place for {rel} in course-layout.json")
    return dict(layout)[best] + rel[len(best):]


def sources():
    codes = COURSE / "Codes"
    for f in sorted(codes.rglob("*")):
        yield f, f.relative_to(codes).as_posix()
    for s in SAMPLES:
        for f in sorted((COURSE / "Sample" / s).rglob("*")):
            yield f, f"sample/{s}/" + f.relative_to(COURSE / "Sample" / s).as_posix()


out = REPO / "course"
shutil.rmtree(out, ignore_errors=True)
count = 0
for f, rel in sources():
    parts = rel.split("/")
    if not f.is_file() or f.name in SKIP_NAMES or f.suffix in SKIP_SUFFIXES or SKIP_DIRS & set(parts):
        continue
    if parts[0] == "sample" and parts[1] not in SAMPLES:
        continue
    dst = out / target(rel)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(f, dst)
    count += 1
print(f"course/: {count} files from {COURSE}")
