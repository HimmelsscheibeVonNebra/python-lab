# Try a regular expression on a text and see every match.
#   python3 try_pattern.py PATTERN TEXT
# Put both in single quotes so the shell leaves \d, *, $ ... alone.
import re
import sys

if len(sys.argv) != 3:
    print("usage: python3 try_pattern.py PATTERN TEXT")
    sys.exit(1)

pattern = sys.argv[1]
text = sys.argv[2]

matches = list(re.finditer(pattern, text))
# The text with every match wrapped in [ ]
marked = re.sub(pattern, lambda m: "[" + m.group() + "]", text)

print(f"pattern {pattern}")
print(f"  text   {text}")
print(f"  marked {marked}")
for m in matches:
    print(f"  {m.start():>3}-{m.end():<3} {m.group()!r}")
print(f"  {len(matches)} match(es)")
