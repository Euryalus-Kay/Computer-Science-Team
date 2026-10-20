import sys
lines = sys.stdin.read().split("\n")
t = int(lines[0])
for line in lines[1:1 + t]:
    s = [c.lower() for c in line if c.isalpha()]
    print("YES" if s == s[::-1] else "NO")
