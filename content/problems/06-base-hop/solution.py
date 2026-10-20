import sys
DIG = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
d = sys.stdin.read().split()
t = int(d[0])
out = []
for i in range(t):
    v, a, b = d[1 + 3 * i], int(d[2 + 3 * i]), int(d[3 + 3 * i])
    n = int(v, a)
    if n == 0:
        out.append("0")
        continue
    s = []
    while n:
        n, r = divmod(n, b)
        s.append(DIG[r])
    out.append("".join(reversed(s)))
print("\n".join(out))
