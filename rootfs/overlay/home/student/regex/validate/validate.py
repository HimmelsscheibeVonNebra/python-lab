# Validate phone numbers, emails and dates, one "kind value" per input line.
#   python3 validate.py < samples.txt
import re
import sys
from datetime import date

# Korean mobile numbers: 010, 011, 016-019; dashes optional
PHONE = re.compile(r"01[016-9]-?\d{3,4}-?\d{4}")

# A practical (not complete!) email shape, written with re.VERBOSE
EMAIL = re.compile(r"""
    [\w.+-]+        # local part: letters, digits, . + -
    @
    [\w-]+          # first domain label
    (\.[\w-]+)+     # one or more .labels: .com  .co.kr
""", re.VERBOSE)

DATE = re.compile(r"(\d{4})-(\d{2})-(\d{2})")


def check_phone(s):
    return "ok" if PHONE.fullmatch(s) else "invalid"


def check_email(s):
    return "ok" if EMAIL.fullmatch(s) else "invalid"


def check_date(s):
    m = DATE.fullmatch(s)
    if not m:
        return "invalid (shape)"
    year, month, day = (int(g) for g in m.groups())
    try:
        date(year, month, day)        # the regex only checks the shape
    except ValueError:
        return "invalid (no such date)"
    return "ok"


CHECKS = {"phone": check_phone, "email": check_email, "date": check_date}

for line in sys.stdin:
    line = line.strip()
    if not line or line.startswith("#"):
        continue
    kind, _, value = line.partition(" ")
    check = CHECKS.get(kind)
    result = check(value) if check else "unknown kind"
    print(f"{kind:<6} {value:<26} {result}")
