# 첫 파이썬 프로그램: python3 hello.py
import platform

print("안녕하세요, Python!")
print("Python", platform.python_version(), "on", platform.machine())

name = input("이름을 입력하세요: ")
print(f"반갑습니다, {name}님!")
print("1부터 10까지의 합:", sum(range(1, 11)))
