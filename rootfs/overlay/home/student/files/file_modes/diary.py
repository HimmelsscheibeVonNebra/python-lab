"""Add one line to diary.txt, then print the whole diary with line numbers.

    python3 diary.py 오늘 파일을 배웠다
"""
import sys

entry = " ".join(sys.argv[1:]) or "(empty)"

# "a" = append: add to the end, create the file if it does not exist yet
with open("diary.txt", "a", encoding="utf-8") as f:
    f.write(entry + "\n")          # write() does not add a newline for you

# "r" (the default) = read.  A file object gives one line per loop.
with open("diary.txt", encoding="utf-8") as f:
    for number, line in enumerate(f, start=1):
        print(f"{number}: {line.rstrip()}")
