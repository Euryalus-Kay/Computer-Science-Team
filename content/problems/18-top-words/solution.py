import sys, re
from collections import Counter
data = sys.stdin.read()
first, _, text = data.partition("\n")
k = int(first)
cnt = Counter(w.lower() for w in re.findall(r"[A-Za-z]+", text))
for w, c in sorted(cnt.items(), key=lambda p: (-p[1], p[0]))[:k]:
    print(w, c)
