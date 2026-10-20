import random
def tests():
    r = random.Random(14)
    t = [("3 9\n2 3 5\n", True, "The three ways are 3+3+3, 2+2+5 and 2+2+2+3."), ("1 7\n2\n", True, None)]
    for n, x in [(1, 1), (3, 100), (10, 1000), (100, 100000), (50, 99999)]:
        coins = r.sample(range(1, min(x, 1000) + 1), min(n, min(x, 1000)))
        t.append((f"{len(coins)} {x}\n{' '.join(map(str, coins))}\n", False))
    return t
