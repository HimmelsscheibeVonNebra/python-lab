"""Divide pairs of whole numbers, one pair "a b" per input line.

    printf '10 4\n7 0\n' | python3 calc.py

A bad line prints a message and the program goes on with the next line.
"""
import sys

done = 0
failed = 0
for number, line in enumerate(sys.stdin, start=1):   # sys.stdin is a file too
    try:
        a_text, b_text = line.split()      # ValueError if not exactly 2 parts
        a = int(a_text)                    # ValueError if not a whole number
        b = int(b_text)
        result = a / b                     # ZeroDivisionError if b == 0
    except ValueError as e:
        failed += 1
        print(f"line {number}: skipped, {e}")
    except ZeroDivisionError:
        failed += 1
        print(f"line {number}: skipped, cannot divide by zero")
    else:                                  # runs only when nothing was raised
        done += 1
        print(f"line {number}: {a} / {b} = {result:g}")

print(f"{done} done, {failed} skipped")
