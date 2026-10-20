import sys
d = sys.stdin.read().split()
n = int(d[0])
s = 0
out = []
for x in d[1:1 + n]:
    s += int(x)
    out.append(str(s))
print(" ".join(out))
