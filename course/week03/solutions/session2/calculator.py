"""Lab 4 solution. Assume numeric a, b and string operator.
Tests: (8,2,'+') -> 10; (8,2,'-') -> 6; (8,2,'*') -> 16;
(8,2,'/') -> 4.0; (8,0,'/') -> None; (8,2,'%') -> None;
(2,2,'-') -> 0; (-3,2,'*') -> -6; (0,5,'/') -> 0.0.
"""
def calculate(a, b, operator):
    if operator == "+":
        return a + b
    elif operator == "-":
        return a - b
    elif operator == "*":
        return a * b
    elif operator == "/":
        if b == 0:
            return None
        return a / b
    else:
        return None

result = calculate(8, 2, "+")
if result is None:
    print("Invalid operation")
else:
    print("Result:", result)
