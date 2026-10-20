import random, string
def tests():
    r = random.Random(3)
    t = [("3\nWas it a car or a cat I saw?\nNever odd or even.\nHello, world\n", True, None)]
    rows = ["A man, a plan, a canal: Panama!", "No lemon, no melon", "Step on no pets", "abc", "a", "Ab", "Madam, I'm Adam.", "Red rum, sir, is murder", "12321 x", "Taco cat 9"]
    for _ in range(40):
        half = "".join(r.choice(string.ascii_letters) for _ in range(r.randint(1, 30)))
        pal = half + half[::-1] if r.random() < 0.5 else half + r.choice("ab") + half[::-1]
        if r.random() < 0.4:
            pal = list(pal); i = r.randrange(len(pal)); pal[i] = r.choice("xyz"); pal = "".join(pal)
        noisy = "".join(c + (r.choice(" ,.!?-'1") if r.random() < 0.3 else "") for c in pal)
        rows.append(noisy.swapcase() if r.random() < 0.5 else noisy)
    for part in _chunks(rows, 4):
        t.append((f"{len(part)}\n" + "\n".join(part) + "\n", False))
    return t

def _chunks(rows, k):
    size = max(1, -(-len(rows) // k))
    return [rows[i:i + size] for i in range(0, len(rows), size)]
