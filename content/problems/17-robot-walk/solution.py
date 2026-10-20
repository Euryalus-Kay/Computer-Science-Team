import sys
d = sys.stdin.read().split()
t = int(d[0])
DIRS = [(0, 1), (1, 0), (0, -1), (-1, 0)]
out = []
for s in d[1:1 + t]:
    x = y = 0
    h = 0
    far = 0
    for c in s:
        if c == "L": h = (h + 3) % 4
        elif c == "R": h = (h + 1) % 4
        else:
            dx, dy = DIRS[h]
            k = 1 if c == "F" else -1
            x += dx * k; y += dy * k
            far = max(far, abs(x) + abs(y))
    out.append(f"{x} {y} {far}")
print("\n".join(out))
