"""A small program with a bug, to practise reading a traceback."""


def average(scores):
    return sum(scores) / len(scores)


def report(name, scores):
    print(f"{name}: {average(scores):.1f}")


report("Mina", [90, 85, 77])
report("Joon", [])
report("Sora", [70, 80])
