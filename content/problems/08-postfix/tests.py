import random
LIM = 10**12
def evaluate(tokens):
    st = []
    for tok in tokens:
        if tok in ("+", "-", "*", "/", "^"):
            b = st.pop(); a = st.pop()
            if tok == "/" and b == 0: return None
            if tok == "^" and (b < 0 or b > 12): return None
            if tok == "+": v = a + b
            elif tok == "-": v = a - b
            elif tok == "*": v = a * b
            elif tok == "^": v = a ** b
            else:
                q = abs(a) // abs(b); v = q if (a >= 0) == (b >= 0) else -q
            if abs(v) > LIM: return None
            st.append(v)
        else:
            st.append(int(tok))
    return st[0]
def gen(r, depth):
    if depth == 0 or r.random() < 0.3:
        return [str(r.randint(-20, 99) if r.random() < 0.2 else r.randint(0, 99))]
    op = r.choice("+-*/^+-*")
    if op == "^":
        return gen(r, depth - 1) + [str(r.randint(0, 4))] + ["^"]
    return gen(r, depth - 1) + gen(r, depth - 1) + [op]
def tests():
    r = random.Random(8)
    t = [("3\n3 4 + 2 *\n5 1 2 + 4 * + 3 -\n-7 2 /\n", True, None)]
    rows = ["2 10 ^", "0 5 /", "7"]
    while len(rows) < 400:
        e = gen(r, r.randint(1, 6))
        if evaluate(e) is not None:
            rows.append(" ".join(e))
    for part in _chunks(rows, 4):
        t.append((f"{len(part)}\n" + "\n".join(part) + "\n", False))
    return t

def _chunks(rows, k):
    size = max(1, -(-len(rows) // k))
    return [rows[i:i + size] for i in range(0, len(rows), size)]
