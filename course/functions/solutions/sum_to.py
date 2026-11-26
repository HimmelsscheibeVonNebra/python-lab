"""Lab 3 solution. Assume integer n. Negative n returns None.
Tests: 1 -> 1; 5 -> 15; 0 -> 0; -1 -> None; 3 -> 6.
"""
def sum_to(n):
    if n < 0:
        return None
    total = 0
    for value in range(1, n + 1):
        total += value
    return total

result = sum_to(5)
if result is None:
    print("Invalid input")
else:
    print("Total:", result)
