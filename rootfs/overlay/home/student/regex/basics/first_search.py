# Find every mobile number in a text: first by hand, then with a regex.
import re

text = """문의: 010-1234-5678 (평일), 주말에는 010-9876-5432.
사무실 02-123-4567. 주문번호 2026-1126-0001은 전화번호가 아니다."""

# 0) `in` only answers yes or no
print("in     :", "010-" in text)

# 1) Without regex: split into words and check each word by hand
found = []
for word in text.replace("(", " ").replace(",", " ").split():
    word = word.strip(".")
    parts = word.split("-")
    if (len(parts) == 3 and parts[0] == "010"
            and len(parts[1]) == 4 and len(parts[2]) == 4
            and parts[1].isdigit() and parts[2].isdigit()):
        found.append(word)
print("split  :", found)

# 2) With regex: describe the shape once, let re find it
pattern = r"010-\d{4}-\d{4}"
print("findall:", re.findall(pattern, text))

# 3) The first match as a Match object: what matched, and where
m = re.search(pattern, text)
print("search :", m.group(), "at", m.start(), "to", m.end())
