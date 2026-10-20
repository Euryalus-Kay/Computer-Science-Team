"""
Builds src/content/problems.json from the problem folders in content/problems.

Each folder has:
  problem.md      statement (front matter: title, difficulty, tags, time_ms, checker)
  solution.py     reference solution (reads stdin, writes stdout)
  tests.py        defines tests() -> list of (input_str, is_sample, explanation_or_None)

Expected outputs come from running solution.py, so the data is always consistent.
Run:  python3 content/problems/_gen.py
"""
import json, os, subprocess, sys, importlib.util

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "..", "..", "src", "content", "problems.json")

def front_matter(text):
    meta, body = {}, text
    if text.startswith("---"):
        _, fm, body = text.split("---", 2)
        for line in fm.strip().splitlines():
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip()
    return meta, body.strip() + "\n"

def load_tests(folder):
    spec = importlib.util.spec_from_file_location("t", os.path.join(folder, "tests.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.tests()

problems = []
for name in sorted(os.listdir(ROOT)):
    folder = os.path.join(ROOT, name)
    if not os.path.isdir(folder) or name.startswith("_"):
        continue
    meta, body = front_matter(open(os.path.join(folder, "problem.md")).read())
    tests = []
    for i, t in enumerate(load_tests(folder)):
        inp, sample = t[0], t[1]
        expl = t[2] if len(t) > 2 else None
        if not inp.endswith("\n"):
            inp += "\n"
        r = subprocess.run([sys.executable, os.path.join(folder, "solution.py")], input=inp,
                           capture_output=True, text=True, timeout=60)
        if r.returncode != 0:
            raise SystemExit(f"{name} test {i}: solution failed\n{r.stderr}")
        tests.append({"input": inp, "output": r.stdout, "sample": sample, "explanation": expl})
    starter = {}
    sp = os.path.join(folder, "starter.json")
    if os.path.exists(sp):
        starter = json.load(open(sp))
    problems.append({
        "slug": name.split("-", 1)[1] if name[:2].isdigit() else name,
        "order": name,
        "title": meta["title"],
        "difficulty": meta.get("difficulty", "easy"),
        "tags": [t.strip() for t in meta.get("tags", "").split(",") if t.strip()],
        "timeLimitMs": int(meta.get("time_ms", 2000)),
        "checker": meta.get("checker", "tokens"),
        "statement": body,
        "starter": starter,
        "tests": tests,
    })
    print(f"{name}: {len(tests)} tests")

os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(problems, open(OUT, "w"), separators=(",", ":"))
print(f"wrote {len(problems)} problems")
