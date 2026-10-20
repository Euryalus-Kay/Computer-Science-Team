import sys, bisect
d = sys.stdin.read().split()
n = int(d[0])
tails = []
for v in map(int, d[1:1 + n]):
    i = bisect.bisect_left(tails, v)
    if i == len(tails):
        tails.append(v)
    else:
        tails[i] = v
print(len(tails))
