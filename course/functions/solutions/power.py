"""Practice 2 solution. Numeric base and nonnegative integer exponent.
Tests: power(3) -> 9; power(2,3) -> 8; power(5,exponent=0) -> 1.
"""
def power(base, exponent=2):
    return base ** exponent

print(power(3))
print(power(2, 3))
print(power(5, exponent=0))
