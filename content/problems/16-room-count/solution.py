import sys
d = sys.stdin.read().split()
n = int(d[0])
ev = []
for i in range(n):
    s, e = int(d[1 + 2 * i]), int(d[2 + 2 * i])
    ev.append((s, 1))
    ev.append((e, -1))
ev.sort()
cur = best = 0
for _, delta in ev:
    cur += delta
    best = max(best, cur)
print(best)
