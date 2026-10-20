import random
def tests():
    r = random.Random(9)
    t = [("4\n([]){x}\n(]\n((a)\nf(x)=[1,2]}\n", True, "Line 2 fails at the `]`. Line 3 never closes the first `(`. Line 4 has an extra `}` at position 11.")]
    rows = ["()", ")", "(", "a", "{[()()]}", "{[(])}", "((((((", "x(y[z]{w})v"]
    for _ in range(80):
        n = r.randint(1, 60)
        s, st = [], []
        for _ in range(n):
            if st and r.random() < 0.45:
                s.append({"(": ")", "[": "]", "{": "}"}[st.pop()])
            elif r.random() < 0.2:
                s.append(r.choice("abc123=+"))
            else:
                o = r.choice("([{"); st.append(o); s.append(o)
        while st and r.random() < 0.8:
            s.append({"(": ")", "[": "]", "{": "}"}[st.pop()])
        if r.random() < 0.4:
            i = r.randrange(len(s)); s[i] = r.choice(")]}([{")
        rows.append("".join(s))
    deep = "(" * 50000 + ")" * 50000
    rows.append(deep)
    rows.append("[" * 99999 + "}")
    for part in _chunks(rows, 4):
        t.append((f"{len(part)}\n" + "\n".join(part) + "\n", False))
    return t

def _chunks(rows, k):
    size = max(1, -(-len(rows) // k))
    return [rows[i:i + size] for i in range(0, len(rows), size)]
