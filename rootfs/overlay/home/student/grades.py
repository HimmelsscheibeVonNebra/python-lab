# 리스트, 딕셔너리, 함수, 파일 입출력 예제: python3 grades.py
import csv
from statistics import mean

scores = {"민수": [88, 92, 79], "지영": [95, 90, 98], "현우": [72, 85, 80]}


def grade(avg):
    if avg >= 90:
        return "A"
    if avg >= 80:
        return "B"
    return "C"


with open("grades.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["이름", "평균", "학점"])
    for name, values in scores.items():
        avg = mean(values)
        writer.writerow([name, f"{avg:.1f}", grade(avg)])
        print(f"{name:4} 평균 {avg:5.1f}  학점 {grade(avg)}")

print("grades.csv 파일을 만들었습니다. cat grades.csv 로 확인하세요.")
