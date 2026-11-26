# Groups pull parts out of a match; re.sub rewrites every match.
import re

DATE = re.compile(r"(\d{4})-(\d{2})-(\d{2})")
PHONE = re.compile(r"(?P<head>01[0-9])-(?P<mid>\d{3,4})-(?P<last>\d{4})")

with open("schedule.txt", encoding="utf-8") as f:
    text = f.read()

print("== numbered groups ==")
m = DATE.search(text)
print("group(0):", m.group(0), " groups():", m.groups())
year, month, day = m.groups()
print(f"year={year} month={int(month)} day={int(day)}")

print("== named groups ==")
p = PHONE.search(text)
print("mid:", p["mid"], " last:", p.group("last"))
print(p.groupdict())

print("== sub with backreferences: YYYY-MM-DD -> DD.MM.YYYY ==")
print(DATE.sub(r"\3.\2.\1", text), end="")


def mask(m):
    """Keep the first and last part of a phone number, hide the middle."""
    return m["head"] + "-" + "*" * len(m["mid"]) + "-" + m["last"]


print("== sub with a function: mask phone numbers ==")
print(PHONE.sub(mask, text), end="")
