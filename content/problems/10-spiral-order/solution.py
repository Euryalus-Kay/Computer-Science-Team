import sys
d = sys.stdin.read().split()
r, c = int(d[0]), int(d[1])
g = [d[2 + i * c: 2 + (i + 1) * c] for i in range(r)]
top, bot, left, right = 0, r - 1, 0, c - 1
out = []
while top <= bot and left <= right:
    for j in range(left, right + 1): out.append(g[top][j])
    for i in range(top + 1, bot + 1): out.append(g[i][right])
    if top < bot:
        for j in range(right - 1, left - 1, -1): out.append(g[bot][j])
    if left < right:
        for i in range(bot - 1, top, -1): out.append(g[i][left])
    top += 1; bot -= 1; left += 1; right -= 1
print(" ".join(out))
