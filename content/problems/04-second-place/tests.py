import random
def tests():
    r = random.Random(4)
    t = [("5\n70 95 88 95 60\n", True, "95 is first. The next distinct score is 88."), ("3\n4 4 4\n", True, None), ("1\n10\n", False)]
    for n in (2, 50, 30000):
        xs = [r.randint(0, 10**9 if n > 50 else 20) for _ in range(n)]
        t.append((f"{n}\n{' '.join(map(str, xs))}\n", False))
    t.append(("6\n0 0 0 0 0 1\n", False))
    return t
