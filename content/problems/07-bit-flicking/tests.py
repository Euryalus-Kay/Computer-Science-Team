import random
def gen(r, n, depth):
    if depth == 0 or r.random() < 0.25:
        return "".join(r.choice("01") for _ in range(n))
    op = r.choice(["NOT", "AND", "OR", "XOR", "LSHIFT", "RSHIFT", "LCIRC", "RCIRC"])
    if op == "NOT":
        return f"NOT {gen(r, n, depth - 1)}"
    if op in ("AND", "OR", "XOR"):
        return f"{op} {gen(r, n, depth - 1)} {gen(r, n, depth - 1)}"
    return f"{op}-{r.randint(1, n + 2)} {gen(r, n, depth - 1)}"
def tests():
    r = random.Random(7)
    t = [("3\nXOR LSHIFT-2 01101 RCIRC-1 10110\nNOT 1010\nLCIRC-3 00111\n", True, None)]
    rows = ["RSHIFT-5 10101", "AND 1 0", "OR NOT 0000 1111", "RCIRC-17 1000000000000001"]
    for _ in range(300):
        rows.append(gen(r, r.randint(1, 16), r.randint(1, 5)))
    for part in _chunks(rows, 4):
        t.append((f"{len(part)}\n" + "\n".join(part) + "\n", False))
    return t

def _chunks(rows, k):
    size = max(1, -(-len(rows) // k))
    return [rows[i:i + size] for i in range(0, len(rows), size)]
