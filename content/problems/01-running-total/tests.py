import random
def tests():
    r = random.Random(1)
    t = [("4\n3 1 4 1\n", True, None), ("3\n5 -2 -3\n", True, "5, then 5 - 2 = 3, then 3 - 3 = 0.")]
    t.append(("1\n-7\n", False))
    for n in (10, 1000, 30000):
        xs = [r.randint(-10**9, 10**9) for _ in range(n)]
        t.append((f"{n}\n{' '.join(map(str, xs))}\n", False))
    return t
