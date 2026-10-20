import random
def tests():
    r = random.Random(2)
    t = [("3\n9875\n0\n7\n", True, None)]
    nums = [str(r.randint(0, 10**r.randint(1, 18))) for _ in range(50)]
    nums += ["".join(r.choice("0123456789") for _ in range(100)).lstrip("0") or "0" for _ in range(50)]
    nums += ["9" * 100, "1" + "0" * 99, "10", "99999999999"]
    for part in _chunks(nums, 3):
        t.append((f"{len(part)}\n" + "\n".join(part) + "\n", False))
    big = ["".join(r.choice("0123456789") for _ in range(r.randint(1, 100))).lstrip("0") or "0" for _ in range(1000)]
    t.append((f"{len(big)}\n" + "\n".join(big) + "\n", False))
    return t

def _chunks(rows, k):
    size = max(1, -(-len(rows) // k))
    return [rows[i:i + size] for i in range(0, len(rows), size)]
