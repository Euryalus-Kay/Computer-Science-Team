import random
def tests():
    r = random.Random(15)
    t = [("8\n5 2 8 6 3 6 9 7\n", True, None), ("5\n4 4 4 4 4\n", False), ("1\n7\n", False)]
    for n, hi in [(10, 20), (1000, 10**9), (5000, 100), (60000, 10**9), (60000, 50)]:
        t.append((f"{n}\n{' '.join(str(r.randint(0, hi)) for _ in range(n))}\n", False))
    t.append((f"60000\n{' '.join(map(str, range(60000)))}\n", False))
    t.append((f"60000\n{' '.join(map(str, range(60000, 0, -1)))}\n", False))
    return t
