import sys
d = sys.stdin.read().split()
n, x = int(d[0]), int(d[1])
coins = list(map(int, d[2:2 + n]))
M = 10**9 + 7
ways = [0] * (x + 1)
ways[0] = 1
for c in coins:
    for v in range(c, x + 1):
        ways[v] = (ways[v] + ways[v - c]) % M
print(ways[x])
