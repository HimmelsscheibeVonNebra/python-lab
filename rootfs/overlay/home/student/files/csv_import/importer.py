"""Import a scores CSV robustly: keep the good rows, report the bad ones.

    python3 importer.py scores.csv

Good rows go to clean.csv; every bad row is reported with its line number.
"""
import csv
import sys

FIELDS = ["name", "subject", "score"]


class BadRow(Exception):
    """A row we cannot use; the message says why."""


def parse(row):
    """Check one DictReader row and return a clean dict, or raise BadRow."""
    if None in row:                       # more fields than the header
        raise BadRow(f"extra fields {row[None]}")
    if row["score"] is None:              # fewer fields than the header
        raise BadRow("missing score column")
    name = row["name"].strip()
    if not name:
        raise BadRow("empty name")
    try:
        score = int(row["score"])
    except ValueError:
        raise BadRow(f"score is not a whole number: {row['score']!r}") from None
    if not 0 <= score <= 100:
        raise BadRow(f"score {score} is outside 0-100")
    return {"name": name, "subject": row["subject"], "score": score}


def main(path):
    good = []
    bad = 0
    try:
        with open(path, encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    good.append(parse(row))
                except BadRow as e:
                    bad += 1
                    print(f"line {reader.line_num}: skipped, {e}")
    except FileNotFoundError:
        print(f"error: {path} not found")
        return 1

    with open("clean.csv", "w", encoding="utf-8", newline="") as out:
        writer = csv.DictWriter(out, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(good)

    print(f"{len(good)} rows saved to clean.csv, {bad} skipped")
    if good:
        average = sum(r["score"] for r in good) / len(good)
        print(f"average of the good rows: {average:.1f}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "scores.csv"))
