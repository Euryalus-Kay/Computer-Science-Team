import random
def grid(r, rows, cols, n=0):
    return f"{rows} {cols}\n" + "\n".join(" ".join(str(r.randint(-99, 999)) for _ in range(cols)) for _ in range(rows)) + "\n"
def tests():
    r = random.Random(10)
    t = [("3 4\n1 2 3 4\n5 6 7 8\n9 10 11 12\n", True, None)]
    for rows, cols in [(1, 1), (1, 7), (6, 1), (2, 2), (5, 5), (4, 9), (100, 100), (37, 81)]:
        t.append((grid(r, rows, cols), False))
    return t
