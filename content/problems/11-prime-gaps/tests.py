import random
def tests():
    r = random.Random(11)
    t = [("3\n10 30\n1 2\n24 28\n", True, None)]
    rows = ["1 1000000", "999000 1000000", "2 3", "1 1", "113 127", "1327 1361"]
    for _ in range(44):
        a = r.randint(1, 10**6); b = r.randint(a, min(10**6, a + r.choice([10, 1000, 100000, 10**6])))
        rows.append(f"{a} {b}")
    for part in _chunks(rows, 4):
        t.append((f"{len(part)}\n" + "\n".join(part) + "\n", False))
    return t

def _chunks(rows, k):
    size = max(1, -(-len(rows) // k))
    return [rows[i:i + size] for i in range(0, len(rows), size)]
