def tests():
    t = [("3\n03:00\n15:30\n12:00\n", True, None)]
    allt = [f"{h:02d}:{m:02d}" for h in range(24) for m in range(60)]
    for part in _chunks(allt, 6):
        t.append((f"{len(part)}\n" + "\n".join(part) + "\n", False))
    return t

def _chunks(rows, k):
    size = max(1, -(-len(rows) // k))
    return [rows[i:i + size] for i in range(0, len(rows), size)]
