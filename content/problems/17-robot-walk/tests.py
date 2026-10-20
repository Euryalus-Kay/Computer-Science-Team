import random
def tests():
    r = random.Random(17)
    t = [("2\nFFRFF\nFLFFBB\n", True, None)]
    rows = ["L", "F", "B", "RRRR", "FFFFLFFFFLFFFFLFFFF"]
    for n in (10, 100, 1000, 100000):
        rows.append("".join(r.choice("FFFBLR") for _ in range(n)))
    for part in _chunks(rows, 4):
        t.append((f"{len(part)}\n" + "\n".join(part) + "\n", False))
    return t

def _chunks(rows, k):
    size = max(1, -(-len(rows) // k))
    return [rows[i:i + size] for i in range(0, len(rows), size)]
