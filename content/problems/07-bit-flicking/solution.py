import sys

def ev(toks, i):
    tok = toks[i]
    if tok[0] in "01":
        return tok, i + 1
    if tok == "NOT":
        x, i = ev(toks, i + 1)
        return "".join("1" if c == "0" else "0" for c in x), i
    if tok in ("AND", "OR", "XOR"):
        x, i = ev(toks, i + 1)
        y, i = ev(toks, i)
        if tok == "AND":
            return "".join("1" if a == b == "1" else "0" for a, b in zip(x, y)), i
        if tok == "OR":
            return "".join("1" if "1" in (a, b) else "0" for a, b in zip(x, y)), i
        return "".join("1" if a != b else "0" for a, b in zip(x, y)), i
    op, k = tok.split("-")
    k = int(k)
    x, i = ev(toks, i + 1)
    n = len(x)
    if op == "LSHIFT":
        return (x[min(k, n):] + "0" * min(k, n)), i
    if op == "RSHIFT":
        return ("0" * min(k, n) + x[: n - min(k, n)]), i
    k %= n
    if op == "LCIRC":
        return x[k:] + x[:k], i
    return x[n - k:] + x[: n - k], i

lines = sys.stdin.read().split("\n")
t = int(lines[0])
for line in lines[1:1 + t]:
    print(ev(line.split(), 0)[0])
