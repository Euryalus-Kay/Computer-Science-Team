import sys, bisect
N = 10**6
sieve = bytearray([1]) * (N + 1)
sieve[0] = sieve[1] = 0
for i in range(2, int(N ** 0.5) + 1):
    if sieve[i]:
        sieve[i * i::i] = bytearray(len(range(i * i, N + 1, i)))
primes = [i for i in range(N + 1) if sieve[i]]
d = sys.stdin.read().split()
q = int(d[0])
out = []
for k in range(q):
    a, b = int(d[1 + 2 * k]), int(d[2 + 2 * k])
    lo, hi = bisect.bisect_left(primes, a), bisect.bisect_right(primes, b)
    seg = primes[lo:hi]
    out.append(str(max((y - x for x, y in zip(seg, seg[1:])), default=0)))
print("\n".join(out))
