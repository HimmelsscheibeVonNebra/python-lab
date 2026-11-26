# Summarize a web server access log.
#   python3 report.py LOGFILE [N]      (N: how many top entries, default 3)
import re
import sys
from collections import Counter

LINE = re.compile(r"""
    (?P<ip>\d{1,3}(?:\.\d{1,3}){3})       # 192.168.0.12
    \s-\s-\s
    \[(?P<day>[^:\]]+):(?P<hour>\d{2}):\d{2}:\d{2}[^\]]*\]\s
    "(?P<method>[A-Z]+)\s(?P<path>\S+)\s[^"]*"\s
    (?P<status>\d{3})\s
    (?P<size>\d+|-)
""", re.VERBOSE)


def print_top(title, counter, n, total):
    print(f"\nTop {n} {title}")
    print(f"  {'':<16} {'hits':>5} {'share':>7}")
    for key, hits in counter.most_common(n):
        print(f"  {key:<16} {hits:>5} {hits / total:>7.1%}")


filename = sys.argv[1] if len(sys.argv) > 1 else "access.log"
top_n = int(sys.argv[2]) if len(sys.argv) > 2 else 3

paths = Counter()
ips = Counter()
statuses = Counter()
hours = Counter()
total_bytes = 0
bad = []
errors = []

with open(filename, encoding="utf-8") as f:
    for number, line in enumerate(f, start=1):
        m = LINE.match(line)
        if not m:
            bad.append(number)
            continue
        paths[m["path"]] += 1
        ips[m["ip"]] += 1
        statuses[m["status"]] += 1
        hours[m["hour"]] += 1
        if m["size"] != "-":
            total_bytes += int(m["size"])
        if m["status"][0] in "45":
            errors.append(f"line {number:>2}: {m['status']} {m['method']} {m['path']}")

requests = sum(paths.values())
print(f"Requests : {requests}")
print(f"Skipped  : {len(bad)} line(s) {bad}")
print(f"Bytes    : {total_bytes:,}")
print("Status   : " + ", ".join(f"{s}x{c}" for s, c in sorted(statuses.items())))
print("Per hour : " + ", ".join(f"{h}h={c}" for h, c in sorted(hours.items())))

print_top("paths", paths, top_n, requests)
print_top("clients", ips, top_n, requests)

print(f"\nErrors (4xx/5xx): {len(errors)}")
for e in errors:
    print("  " + e)
