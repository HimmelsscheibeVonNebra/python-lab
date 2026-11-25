"""Practice 2 solution. Assume integer-formatted input."""
total = 0
while True:
    number = int(input("Integer (0: stop): "))
    if number == 0:
        break
    total += number
print("Total:", total)
