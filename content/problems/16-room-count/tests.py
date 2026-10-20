import random
def tests():
    r = random.Random(16)
    t = [("4\n0 30\n5 10\n15 20\n30 40\n", True, "Two rooms: one for 0 to 30 then 30 to 40, another for 5 to 10 then 15 to 20.")]
    t.append(("1\n0 1\n", False))
    t.append(("3\n1 2\n2 3\n3 4\n", False))
    for n, span in [(10, 50), (1000, 10000), (60000, 10**9), (60000, 1000)]:
        rows = []
        for _ in range(n):
            s = r.randint(0, span - 1); e = r.randint(s + 1, min(span, s + max(2, span // 10)))
            rows.append(f"{s} {e}")
        t.append((f"{n}\n" + "\n".join(rows) + "\n", False))
    return t
