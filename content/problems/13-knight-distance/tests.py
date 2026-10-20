import random
def tests():
    r = random.Random(13)
    t = [("3\n8 1 1 8 8\n8 1 1 1 1\n3 1 1 2 2\n", True, "On a 3 × 3 board the center square is never reachable.")]
    rows = ["1 1 1 1 1", "2 1 1 2 2", "4 1 1 4 4", "300 1 1 300 300", "300 150 150 1 300"]
    for _ in range(15):
        n = r.randint(1, 300)
        rows.append(f"{n} {r.randint(1, n)} {r.randint(1, n)} {r.randint(1, n)} {r.randint(1, n)}")
    for part in _chunks(rows, 4):
        t.append((f"{len(part)}\n" + "\n".join(part) + "\n", False))
    return t

def _chunks(rows, k):
    size = max(1, -(-len(rows) // k))
    return [rows[i:i + size] for i in range(0, len(rows), size)]
