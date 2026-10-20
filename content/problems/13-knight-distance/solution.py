import sys
from collections import deque
d = sys.stdin.read().split()
t = int(d[0])
moves = [(1, 2), (2, 1), (-1, 2), (-2, 1), (1, -2), (2, -1), (-1, -2), (-2, -1)]
out = []
for k in range(t):
    n, r1, c1, r2, c2 = map(int, d[1 + 5 * k: 6 + 5 * k])
    dist = [[-1] * (n + 1) for _ in range(n + 1)]
    dist[r1][c1] = 0
    q = deque([(r1, c1)])
    while q and dist[r2][c2] < 0:
        x, y = q.popleft()
        for dx, dy in moves:
            nx, ny = x + dx, y + dy
            if 1 <= nx <= n and 1 <= ny <= n and dist[nx][ny] < 0:
                dist[nx][ny] = dist[x][y] + 1
                q.append((nx, ny))
    out.append(str(dist[r2][c2]))
print("\n".join(out))
