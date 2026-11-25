"""Lab 3 solution. Assume integer-formatted input.
Tests: 2, 9 -> 9 single-table equations each; 1, 10 -> Invalid table.
All cases also produce the 72-equation all-tables section.
"""
table = int(input("Table (2-9): "))
if 2 <= table <= 9:
    for factor in range(1, 10):
        print(f"{table} x {factor} = {table * factor}")
else:
    print("Invalid table")

print("All tables:")
for table in range(2, 10):
    for factor in range(1, 10):
        print(f"{table} x {factor} = {table * factor}")
    print()
