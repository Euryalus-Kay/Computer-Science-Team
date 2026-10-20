import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/items/rng";
import { WIDGETS } from "@/lib/items/widgets";
import { BUILD_LEVELS, simulate, blockCount, railReplay, scaleReplay, press, type Block } from "@/lib/items/widgets/machines";
import { consistentLiars } from "@/lib/items/widgets/logic";
import { buildTerminalEnv, runCommand, complete, type Shell } from "@/lib/items/widgets/terminal";
import { evalCircuit } from "@/lib/items/widgets/visual";
import { runTock } from "@/lib/tock";

const CONFIGS: Record<string, Record<string, unknown>> = {
  "tock-trace": { kind: "pipe" },
  terminal: { ask: "door-code" },
  "tock-write": { task: "has7" },
};

describe("widgets generate deterministically for every seed", () => {
  for (const [name, w] of Object.entries(WIDGETS)) {
    it(name, () => {
      for (let seed = 1; seed <= 40; seed++) {
        const a = w.generate(makeRng(seed), CONFIGS[name] ?? {});
        const b = w.generate(makeRng(seed), CONFIGS[name] ?? {});
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      }
    });
  }
});

describe("robot build levels", () => {
  const solutions: Block[][] = [
    [{ op: "repeat", n: 5, body: [{ op: "F" }, { op: "L" }, { op: "F" }, { op: "R" }] }],
    [{ op: "repeat", n: 3, body: [{ op: "F" }, { op: "F" }, { op: "R" }, { op: "F" }, { op: "F" }, { op: "L" }] }],
    [{ op: "repeat", n: 3, body: [{ op: "repeat", n: 6, body: [{ op: "F" }] }, { op: "R" }] }],
  ];
  BUILD_LEVELS.forEach((level, i) => {
    it(`level ${i} is solvable within its limit`, () => {
      const sol = solutions[i];
      const path = simulate(level, sol);
      const end = path[path.length - 1];
      expect([end.x, end.y]).toEqual(level.goal);
      expect(blockCount(sol)).toBeLessThanOrEqual(level.limit);
      expect(WIDGETS["robot-build"].grade(level, {}, { program: sol }, null).fraction).toBe(1);
      const walls = new Set(level.walls.map(([x, y]) => `${x},${y}`));
      for (const p of path) expect(walls.has(`${p.x},${p.y}`)).toBe(false);
    });
    it(`level ${i} can't be solved by going straight`, () => {
      const straight: Block[] = [
        { op: "repeat", n: 8, body: [{ op: "F" }] },
        { op: "L" },
        { op: "repeat", n: 8, body: [{ op: "F" }] },
      ];
      const straightR: Block[] = [
        { op: "repeat", n: 8, body: [{ op: "F" }] },
        { op: "R" },
        { op: "repeat", n: 8, body: [{ op: "F" }] },
      ];
      for (const p of [straight, straightR]) {
        const end = simulate(level, p).at(-1)!;
        expect([end.x, end.y]).not.toEqual(level.goal);
      }
    });
  });
});

describe("liars", () => {
  it("every generated puzzle has exactly one liar and grading matches", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const g = WIDGETS.liars.generate(makeRng(seed), {});
      expect(WIDGETS.liars.grade(g.pub, g.key, { choice: (g.key as { liar: number }).liar }, null).fraction).toBe(1);
    }
    expect(
      consistentLiars([
        { kind: "honest", j: 1 },
        { kind: "liar", j: 3 },
        { kind: "both", j: 0, k: 1 },
        { kind: "liar", j: 2 },
      ]),
    ).toEqual([3]);
  });
});

describe("logic grid", () => {
  it("key scores full and a wrong grid scores less", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = WIDGETS["logic-grid"].generate(makeRng(seed), {});
      const key = g.key as { lang: number[]; locker: number[] };
      expect(WIDGETS["logic-grid"].grade(g.pub, key, key, null).fraction).toBe(1);
      const wrong = { lang: [...key.lang].reverse(), locker: key.locker };
      expect(WIDGETS["logic-grid"].grade(g.pub, key, wrong, null).fraction!).toBeLessThan(1);
    }
  });
});

describe("circuit", () => {
  it("only the key lights the lamp", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const g = WIDGETS.circuit.generate(makeRng(seed), {});
      const pub = g.pub as Parameters<typeof evalCircuit>[0];
      const sol = (g.key as { solution: boolean[] }).solution;
      expect(evalCircuit(pub, sol).out).toBe(true);
      expect(WIDGETS.circuit.grade(pub, g.key, { bits: sol }, null).fraction).toBe(1);
      expect(WIDGETS.circuit.grade(pub, g.key, { bits: sol.map((b) => !b) }, null).fraction).toBe(0);
    }
  });
});

describe("rail", () => {
  it("the greedy strategy sorts every generated train", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const g = WIDGETS.rail.generate(makeRng(seed), {});
      const cars = (g.pub as { cars: number[] }).cars;
      const moves: ("in" | "out")[] = [];
      const st: number[] = [];
      let want = 1;
      for (const c of cars) {
        moves.push("in");
        st.push(c);
        while (st.at(-1) === want) {
          moves.push("out");
          st.pop();
          want++;
        }
      }
      expect(railReplay(cars, moves).output).toEqual(cars.map((_, i) => i + 1));
      expect(WIDGETS.rail.grade(g.pub, {}, { moves }, null).fraction).toBe(1);
    }
  });
});

describe("scale", () => {
  it("3-3 then 1-1 always finds the coin", () => {
    const first = { left: [1, 2, 3], right: [4, 5, 6] };
    const r1 = scaleReplay(9, [first], 2);
    const group = r1.candidates;
    expect(group.length).toBe(3);
    const second = { left: [group[0]], right: [group[1]] };
    const r2 = scaleReplay(9, [first, second], 2);
    expect(r2.candidates.length).toBe(1);
    expect(WIDGETS.scale.grade({ coins: 9, weighings: 2 }, {}, { weighings: [first, second], pick: r2.candidates[0] }, null).fraction).toBe(1);
  });
  it("a 4-4 split leaves the adversary room", () => {
    const r = scaleReplay(9, [{ left: [1, 2, 3, 4], right: [5, 6, 7, 8] }], 2);
    expect(r.candidates.length).toBe(4);
  });
});

describe("lights", () => {
  it("pressing the generating cells solves the board", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = WIDGETS.lights.generate(makeRng(seed), {});
      const pub = g.pub as { size: number; start: boolean[]; min: number };
      // brute force a minimal solution and check the grader accepts it
      for (let m = 0; m < 512; m++) {
        const presses = Array.from({ length: 9 }, (_, i) => i).filter((i) => m & (1 << i));
        if (presses.length !== pub.min) continue;
        let b = [...pub.start];
        for (const i of presses) b = press(b, 3, i);
        if (b.every((x) => !x)) {
          expect(WIDGETS.lights.grade(pub, {}, { presses }, null).fraction).toBe(1);
          break;
        }
      }
    }
  });
});

describe("terminal", () => {
  it("answers can be found with the shell", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const { env, key } = buildTerminalEnv(makeRng(seed));
      const sh: Shell = { env, cwd: env.home, history: [] };
      const log = runCommand(sh, "cat /var/log/auth.log").out!;
      // most failed
      const counts = new Map<string, number>();
      for (const line of log.split("\n")) {
        const m = line.match(/FAIL\s+user=(\w+)/);
        if (m) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
      }
      const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      expect(sorted[0][0]).toBe(key.mostFailed);
      expect(sorted[0][1]).toBeGreaterThan(sorted[1][1]);
      // door code
      const first = log.split("\n").find((l) => l.startsWith("2026-03-15") && l.includes(" OK "))!;
      const user = first.match(/user=(\w+)/)![1];
      const users = runCommand(sh, "cat /etc/users").out!;
      const id = users.split("\n").find((l) => l.includes(` ${user} `))!.match(/u-(\d+)/)![1];
      expect(id.slice(-4)).toBe(key.doorCode);
      // archive: shift back by the number of users never logged in
      const names = users.split("\n").filter((l) => l.startsWith("u-")).map((l) => l.split(/\s+/)[1]);
      const never = names.filter((n) => !log.split("\n").some((l) => l.includes(" OK ") && l.includes(`user=${n} `)));
      const enc = runCommand(sh, "cat archive.enc").out!.trim();
      const dec = enc.split("").map((c) => String.fromCharCode(65 + ((c.charCodeAt(0) - 65 - never.length + 26) % 26))).join("");
      expect(dec).toBe(key.archive);
      // hidden hint needs ls -a
      expect(runCommand(sh, "ls notes").out).not.toContain(".hint");
      expect(runCommand(sh, "ls -a notes").out).toContain(".hint");
    }
  });
  it("shell basics", () => {
    const { env } = buildTerminalEnv(makeRng(3));
    const sh: Shell = { env, cwd: env.home, history: [] };
    expect(runCommand(sh, "pwd").out).toBe("/home/guest");
    expect(runCommand(sh, "cd ..").cwd).toBe("/home");
    expect(runCommand(sh, "cd /nope").out).toContain("No such file");
    expect(runCommand(sh, "grep -c OK /var/log/auth.log").out).toMatch(/^\d+$/);
    expect(complete(sh, "cat arc")).toBe("cat archive.enc");
    expect(complete(sh, "cd no")).toBe("cd notes/");
    expect(runCommand(sh, "rm archive.enc").out).toContain("read-only");
  });
});

describe("tock widgets", () => {
  it("trace answers match the interpreter", () => {
    for (const kind of ["range-sum", "index", "pipe", "while", "fold"]) {
      for (let seed = 1; seed <= 10; seed++) {
        const g = WIDGETS["tock-trace"].generate(makeRng(seed), { kind });
        const code = (g.pub as { code: string }).code;
        const out = runTock(code).output.trim();
        expect(WIDGETS["tock-trace"].grade(g.pub, g.key, { text: out }, null).fraction).toBe(1);
      }
    }
  });
  it("reverse accepts any valid input", () => {
    for (let seed = 1; seed <= 15; seed++) {
      const g = WIDGETS["tock-reverse"].generate(makeRng(seed), {});
      const ans = (g.key as { answers: number[] }).answers;
      expect(ans.length).toBeGreaterThan(0);
      for (const a of ans) expect(WIDGETS["tock-reverse"].grade(g.pub, g.key, { text: String(a) }, null).fraction).toBe(1);
    }
  });
  it("write grades a correct program fully", () => {
    const g = WIDGETS["tock-write"].generate(makeRng(9), { task: "has7" });
    const prog = `n <- read
count <- 0
for x in range(1, n) do
  if text(x) |> count(c -> c = "7") > 0 then
    count <- count + 1
  end
end
say count`;
    const r = WIDGETS["tock-write"].grade(g.pub, g.key, { code: prog }, null);
    expect(r.fraction).toBe(1);
    expect(WIDGETS["tock-write"].grade(g.pub, g.key, { code: "say 0" }, null).fraction).toBeLessThan(1);
  });
});
