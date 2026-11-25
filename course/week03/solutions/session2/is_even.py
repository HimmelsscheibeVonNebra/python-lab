"""Practice 1 solution. Argument contract: an integer.
Tests: 4 -> True; 7 -> False; 0 -> True; -2 -> True.
"""
def is_even(number):
    return number % 2 == 0

print(is_even(4))
print(is_even(7))
print(is_even(0))
print(is_even(-2))
