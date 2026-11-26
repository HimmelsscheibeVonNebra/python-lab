"""Lab 4 core solution. Assume integer-formatted input.
Tests: 1 -> '*'; 4 -> rows of 1, 2, 3, 4 stars;
0, 11 -> Invalid height. Optional shrinking triangle is in the guide.
"""
height = int(input("Height (1-10): "))
if 1 <= height <= 10:
    for row in range(1, height + 1):
        for col in range(row):
            print("*", end="")
        print()
else:
    print("Invalid height")
