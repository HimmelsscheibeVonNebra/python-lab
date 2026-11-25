"""Practice 1 solution: sum the even integers from 1 through 10."""
total = 0
for n in range(1, 11):
    if n % 2 == 0:
        total += n
print(total)  # 30
