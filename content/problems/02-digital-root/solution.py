import sys
d = sys.stdin.read().split()
t = int(d[0])
out = []
for s in d[1:1 + t]:
    while len(s) > 1:
        s = str(sum(int(c) for c in s))
    out.append(s)
print("\n".join(out))
