import sys
d = sys.stdin.read().split()
n = int(d[0])
s = sorted(set(map(int, d[1:1 + n])), reverse=True)
print(s[1] if len(s) > 1 else "NONE")
