import sys
PAIR = {")": "(", "]": "[", "}": "{"}
lines = sys.stdin.read().split("\n")
t = int(lines[0])
out = []
for line in lines[1:1 + t]:
    st = []
    bad = None
    for i, c in enumerate(line, 1):
        if c in "([{":
            st.append((c, i))
        elif c in PAIR:
            if not st or st[-1][0] != PAIR[c]:
                bad = i
                break
            st.pop()
    if bad is None and st:
        bad = st[0][1]
    out.append("OK" if bad is None else str(bad))
print("\n".join(out))
