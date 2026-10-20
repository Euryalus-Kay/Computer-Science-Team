import random
def tests():
    r = random.Random(12)
    t = [("4 5\n##..#\n#...#\n..#..\n.#.##\n", True, "Five islands. Cells that touch only at a corner are separate.")]
    for rows, cols, p in [(1, 1, 1.0), (1, 1, 0.0), (3, 3, 0.5), (20, 30, 0.45), (400, 400, 0.5), (300, 300, 0.9), (300, 2, 0.6)]:
        g = "\n".join("".join("#" if r.random() < p else "." for _ in range(cols)) for _ in range(rows))
        t.append((f"{rows} {cols}\n{g}\n", False))
    return t
