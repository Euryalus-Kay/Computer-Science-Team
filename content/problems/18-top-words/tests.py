import random
WORDS = "the of and a to in is you that it he was for on are as with his they i at be this have from or one had by word but not what all were we when your can said there use an each which she do how their if will up other about out many then them these so some her would make like him into time has look two more write go see number no way could people my than first water been call who oil its now find long down day did get come made may part".split()
def tests():
    r = random.Random(18)
    t = [("3\nThe cat and the hat.\nThe CAT sat; a hat fell!\n", True, None)]
    for k, n in [(1, 20), (5, 300), (10, 3000), (50, 15000)]:
        text = " ".join(r.choice(WORDS[: r.randint(60, len(WORDS))]).capitalize() if r.random() < 0.1 else r.choice(WORDS) for _ in range(n))
        text = "".join(c if r.random() > 0.02 or c != " " else r.choice(".,;!?\n- ") for c in text)
        t.append((f"{k}\n{text}\n", False))
    return t
