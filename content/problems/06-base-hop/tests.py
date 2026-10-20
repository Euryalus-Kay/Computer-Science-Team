import random
DIG = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
def to(n, b):
    if n == 0: return "0"
    s = []
    while n: n, r = divmod(n, b); s.append(DIG[r])
    return "".join(reversed(s))
def tests():
    r = random.Random(6)
    t = [("3\n255 10 16\n1011 2 10\nZZ 36 2\n", True, None)]
    rows = ["0 10 2", "1 2 36", "FF 16 8", "777 8 2"]
    for _ in range(300):
        a, b = r.randint(2, 36), r.randint(2, 36)
        n = r.randint(0, 36 ** r.randint(1, 18))
        s = to(n, a)[:30]
        rows.append(f"{s} {a} {b}")
    for part in _chunks(rows, 4):
        t.append((f"{len(part)}\n" + "\n".join(part) + "\n", False))
    return t

def _chunks(rows, k):
    size = max(1, -(-len(rows) // k))
    return [rows[i:i + size] for i in range(0, len(rows), size)]
