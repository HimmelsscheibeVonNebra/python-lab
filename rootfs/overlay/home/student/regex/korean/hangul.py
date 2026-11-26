# Pick Korean text apart with Unicode ranges.
import re
from collections import Counter

HANGUL_WORD = re.compile(r"[가-힣]+")          # complete syllables 가 .. 힣
JAMO_RUN = re.compile(r"[ㄱ-ㅎㅏ-ㅣ]+")        # lone consonants/vowels: ㅋㅋ ㅠㅠ
ENGLISH = re.compile(r"[a-z]+", re.IGNORECASE)
RATING = re.compile(r"별점\s*(\d)점")

with open("reviews.txt", encoding="utf-8") as f:
    text = f.read()

words = HANGUL_WORD.findall(text)
print("Hangul words:", len(words))
print("Most common :", Counter(words).most_common(3))
print("Jamo runs   :", JAMO_RUN.findall(text))
print("English     :", [w.lower() for w in ENGLISH.findall(text)])

ratings = [int(r) for r in RATING.findall(text)]
print(f"Ratings     : {ratings}  average {sum(ratings) / len(ratings):.2f}")

# Clean-up: drop jamo runs and anything that is not Hangul, a letter,
# a digit or a space; then squeeze repeated spaces.
cleaned = JAMO_RUN.sub("", text)
cleaned = re.sub(r"[^가-힣A-Za-z0-9\s]", "", cleaned)
cleaned = re.sub(r"[ \t]+", " ", cleaned)
print("\nCleaned:")
for line in cleaned.splitlines():
    print("  " + line.strip())
