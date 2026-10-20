import sys
d = sys.stdin.read().split()
t = int(d[0])
for s in d[1:1 + t]:
    h, m = map(int, s.split(":"))
    a = abs((h % 12) * 30 + m * 0.5 - m * 6)
    print(f"{min(a, 360 - a):.1f}")
