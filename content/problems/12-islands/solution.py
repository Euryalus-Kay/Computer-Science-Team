import sys
from collections import deque
d = sys.stdin.read().split()
r, c = int(d[0]), int(d[1])
g = [list(row) for row in d[2:2 + r]]
count = 0
for i in range(r):
    for j in range(c):
        if g[i][j] == "#":
            count += 1
            g[i][j] = "."
            q = deque([(i, j)])
            while q:
                x, y = q.popleft()
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < r and 0 <= ny < c and g[nx][ny] == "#":
                        g[nx][ny] = "."
                        q.append((nx, ny))
print(count)
