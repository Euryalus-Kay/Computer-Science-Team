/**
 * Fairness audit for the Intro Logic Test, plus the generic question types the starter tests use.
 *
 * Every item is built as a row shaped like the ones src/content/tests.ts inserts, then generated and
 * graded with the real engine (generateItem, gradeItem, interactItem, describeAnswer) for 300
 * attempt seeds. For each item the suite checks that:
 *   1. the puzzle is determined by the public data the student sees, and the key agrees with it;
 *   2. every reasonable way of typing the right answer gets full credit;
 *   3. wrong, empty and partial answers get nothing (or the item's documented partial credit);
 *   4. interactive puzzles can be solved through interactItem using only what the student sees.
 *
 * A check written as it.fails(...) documents a known defect: it passes while the defect is there.
 * After fixing the defect, change it.fails back to it so the check guards the fix.
 */
import { describe, expect, it } from "vitest";
import { INTRO_ITEMS, PRACTICE_ITEMS, type SeedItem } from "@/content/test-items";
import { describeAnswer, fillVars, generateItem, gradeItem, interactItem, needsReview, type ItemRow } from "@/lib/items/engine";
import type { Generated } from "@/lib/items/types";
import { countPaths, evalCircuit, figureDots, type CircuitPub, type FigurePattern, type PathsPub } from "@/lib/items/widgets/visual";
import {
  BUILD_LEVELS,
  blockCount,
  pathCost,
  press,
  scaleReplay,
  simulate,
  type Block,
  type BuildLevel,
  type NetPub,
  type RobotWorld,
} from "@/lib/items/widgets/machines";
import { runCommand, type Shell, type TerminalEnv } from "@/lib/items/widgets/terminal";
import { runTock } from "@/lib/tock";
import { runGlyph } from "@/lib/items/widgets/glyph";
import { doorStep, type DoorState } from "@/lib/items/widgets/door";

/* ------------------------------------------------------------------ setup */

/** 300 different attempt seeds, spread out like real ones (real seeds are random ints). */
const SEEDS = Array.from({ length: 300 }, (_, i) => 1 + i * 7919);

/** The heavier checks get extra time so a slow CI machine does not trip the 5 second default. */
const SLOW = { timeout: 30_000 };

/** Same shape as the rows src/content/tests.ts inserts into contest_items. */
function toRow(it: SeedItem, ord: number, contestId: string): ItemRow {
  return {
    id: `${contestId}-${ord}`,
    contestId,
    ord,
    section: it.section ?? null,
    type: it.type,
    title: it.title,
    prompt: it.prompt,
    points: it.points,
    config: it.config ?? {},
    grading: it.grading ?? "auto",
    rubric: it.rubric ?? null,
    problemId: null,
  };
}

const INTRO = INTRO_ITEMS.map((it, i) => toRow(it, i, "intro-logic"));
const PRACTICE = PRACTICE_ITEMS.map((it, i) => toRow(it, i, "practice-round-1"));

function pick(rows: ItemRow[], title: string): ItemRow {
  const row = rows.find((r) => r.title === title);
  if (!row) throw new Error(`No item titled ${title}`);
  return row;
}
const intro = (title: string) => pick(INTRO, title);

const generated = new Map<string, Generated>();
/** generateItem is deterministic, so the public data and key are cached per (item, seed). */
function gen<P, K>(row: ItemRow, seed: number): Generated<P, K> {
  const k = `${row.id}:${seed}`;
  let g = generated.get(k);
  if (!g) {
    g = generateItem(row, seed);
    generated.set(k, g);
  }
  return g as Generated<P, K>;
}

const frac = (row: ItemRow, seed: number, response: unknown, state: unknown = null) => gradeItem(row, seed, response, state).fraction;

function expectFractions(row: ItemRow, seed: number, forms: Record<string, unknown>, want: number) {
  for (const [name, response] of Object.entries(forms)) {
    expect(frac(row, seed, response), `${row.title}, seed ${seed}, ${name}: ${JSON.stringify(response)}`).toBe(want);
  }
}

const wrapForms = (forms: Record<string, string>, field: string) =>
  Object.fromEntries(Object.entries(forms).map(([k, v]) => [k, { [field]: v }]));

/** Ways a careful student might type a whole number. All of them mean the same number. */
function numberForms(n: number): Record<string, string> {
  const s = String(n);
  return {
    plain: s,
    "surrounding spaces": `  ${s}  `,
    "surrounding newlines": `\n${s}\n`,
    tab: `\t${s}`,
    "leading zero": `0${s}`,
    "plus sign": `+${s}`,
    "trailing .0": `${s}.0`,
    "thousands separator": n.toLocaleString("en-US"),
  };
}

/** Text a program prints: only whitespace around it may change. */
function printedNumberForms(n: number): Record<string, string> {
  const s = String(n);
  return { plain: s, "surrounding spaces": `  ${s}  `, "surrounding newlines": `\n${s}\n`, tab: `\t${s}` };
}

/** Ways a careful student might type a list of numbers. */
function listForms(xs: number[]): Record<string, string> {
  return {
    spaces: xs.join(" "),
    "brackets and commas": `[${xs.join(", ")}]`,
    "commas and spaces": xs.join(", "),
    "commas only": xs.join(","),
    "tight brackets": `[${xs.join(",")}]`,
    "extra spaces": `  ${xs.join("   ")}  `,
    "trailing comma": `${xs.join(", ")},`,
    "trailing comma in brackets": `[${xs.join(", ")},]`,
    "surrounding newlines": `\n${xs.join(" ")}\n`,
    "one per line": xs.join("\n"),
    "spaced brackets": `[ ${xs.join(" , ")} ]`,
    tabs: xs.join("\t"),
  };
}

/** Ways a careful student might type a word or name. */
function wordForms(w: string): Record<string, string> {
  const lower = w.toLowerCase();
  return {
    upper: w.toUpperCase(),
    lower,
    capitalized: lower[0].toUpperCase() + lower.slice(1),
    "mixed case": [...lower].map((c, i) => (i % 2 ? c.toUpperCase() : c)).join(""),
    "surrounding spaces": `  ${lower}  `,
    "surrounding newlines": `\n${w}\n`,
    tab: `\t${w}`,
  };
}

function perms(n: number): number[][] {
  if (n === 1) return [[0]];
  const out: number[][] = [];
  for (const p of perms(n - 1)) for (let i = 0; i <= p.length; i++) out.push([...p.slice(0, i), n - 1, ...p.slice(i)]);
  return out;
}
const P4 = perms(4);

/* --------------------------------------------------------------- coverage */

const CHECKED_TITLES = [
  "Dot figures",
  "Gear train",
  "One liar",
  "Lamp circuit",
  "Unknown function",
  "Tock: totals",
  "Tock: positions",
  "Tock: pipes",
  "Failed logins",
  "Door code",
  "Robot trace",
  "Rail yard",
  "Cipher",
  "Light coin",
  "Fastest route",
  "Lockers",
  "Tock: find the input",
  "Code lock",
  "Robot program",
  "Hidden word",
  "Grid paths",
  "Lights",
  "Tock: write it",
  "Explain a strategy",
  "Ten rounds",
  "Poisoned bottle",
  "Neighbor swaps",
  "Counting calls",
  "Glyph",
  "Open the door",
];

describe("intro test coverage", () => {
  it("every Intro item has fairness checks in this file", () => {
    expect(INTRO.map((r) => r.title).sort()).toEqual([...CHECKED_TITLES].sort());
  });

  it("every prompt placeholder is filled in for every seed", SLOW, () => {
    for (const row of [...INTRO, ...PRACTICE.filter((r) => r.type !== "code")]) {
      for (const s of SEEDS) {
        const text = fillVars(row.prompt, gen(row, s).vars);
        expect(text, `${row.title}, seed ${s}`).not.toMatch(/\{\{/);
      }
    }
  });

  it("the admin answer key, typed as is, gets full credit", SLOW, () => {
    const typed: [string, string][] = [
      ["Dot figures", "value"],
      ["Grid paths", "value"],
      ["Unknown function", "text"],
      ["Cipher", "text"],
      ["Tock: totals", "text"],
      ["Tock: positions", "text"],
      ["Tock: pipes", "text"],
      ["Failed logins", "text"],
      ["Door code", "text"],
      ["Hidden word", "text"],
    ];
    for (const [title, field] of typed) {
      const row = intro(title);
      for (const s of SEEDS.slice(0, 100)) {
        const key = describeAnswer(row, s);
        expect(key, `${title}, seed ${s}`).toBeTruthy();
        expect(frac(row, s, { [field]: key }), `${title}, seed ${s}: ${key}`).toBe(1);
      }
    }
    const reverse = intro("Tock: find the input");
    for (const s of SEEDS.slice(0, 100)) {
      for (const a of describeAnswer(reverse, s)!.split(" or ")) expect(frac(reverse, s, { text: a })).toBe(1);
    }
  });
});

/* ---------------------------------------------------------------- warm-up */

type FiguresPub = { pattern: FigurePattern; shown: number[]; ask: number };

describe("Dot figures", () => {
  const row = intro("Dot figures");

  it("the drawn figures determine the asked count", () => {
    for (const s of SEEDS) {
      const { pub, key } = gen<FiguresPub, { answer: number }>(row, s);
      // What the student sees: the dots the UI draws for figures 1 to 4.
      const drawn = pub.shown.map((n) => figureDots(pub.pattern, n).length);
      const d1 = drawn.slice(1).map((v, i) => v - drawn[i]);
      const d2 = d1.slice(1).map((v, i) => v - d1[i]);
      expect(new Set(d2).size, `seed ${s}: second differences ${d2}`).toBe(1);
      let value = drawn[drawn.length - 1];
      let step = d1[d1.length - 1];
      for (let n = pub.shown[pub.shown.length - 1] + 1; n <= pub.ask; n++) {
        step += d2[0];
        value += step;
      }
      expect(value, `seed ${s}`).toBe(key.answer);
      expect(figureDots(pub.pattern, pub.ask).length).toBe(key.answer);
    }
  });

  it("accepts every reasonable way of typing the count", () => {
    for (const s of SEEDS) expectFractions(row, s, wrapForms(numberForms(gen<FiguresPub, { answer: number }>(row, s).key.answer), "value"), 1);
  });

  it("gives nothing for wrong or empty answers", () => {
    for (const s of SEEDS) {
      const n = gen<FiguresPub, { answer: number }>(row, s).key.answer;
      expectFractions(row, s, { "one more": { value: String(n + 1) }, "one less": { value: String(n - 1) }, empty: { value: "" }, blank: { value: "   " }, missing: {}, none: null }, 0);
    }
  });
});

type GearsPub = { teeth: number[]; turns: number; labels: string[] };
type GearsKey = { dir: "cw" | "ccw"; turns: number };

describe("Gear train", () => {
  const row = intro("Gear train");

  it("direction and turns follow from the gears shown", () => {
    for (const s of SEEDS) {
      const { pub, key, vars } = gen<GearsPub, GearsKey>(row, s);
      const k = pub.teeth.length;
      // Gears in a row: neighbours turn opposite ways, so gear k matches A when k is odd.
      expect(key.dir).toBe(k % 2 === 1 ? "cw" : "ccw");
      const turns = (pub.teeth[0] * pub.turns) / pub.teeth[k - 1];
      expect(Number.isInteger(turns)).toBe(true);
      expect(key.turns).toBe(turns);
      expect(vars).toMatchObject({ last: pub.labels[k - 1], turns: pub.turns });
    }
  });

  it("accepts every reasonable way of typing the turns with the right direction", () => {
    for (const s of SEEDS) {
      const { key } = gen<GearsPub, GearsKey>(row, s);
      const forms = Object.fromEntries(Object.entries(numberForms(key.turns)).map(([k, v]) => [k, { dir: key.dir, turns: v }]));
      expectFractions(row, s, forms, 1);
    }
  });

  it("gives half credit for the right turns alone and nothing for a direction guess", () => {
    for (const s of SEEDS) {
      const { key } = gen<GearsPub, GearsKey>(row, s);
      const other = key.dir === "cw" ? "ccw" : "cw";
      // The direction alone is a coin flip, so only the worked-out turns earn partial credit.
      expectFractions(row, s, { "turns only": { turns: String(key.turns) }, "wrong direction": { dir: other, turns: String(key.turns) } }, 0.5);
      expectFractions(
        row,
        s,
        { "direction only": { dir: key.dir }, "right direction, wrong turns": { dir: key.dir, turns: String(key.turns + 1) }, "both wrong": { dir: other, turns: String(key.turns + 1) }, empty: { turns: "" }, none: null },
        0,
      );
    }
  });
});

type LiarsPub = { names: string[]; claims: string[] };

describe("One liar", () => {
  const row = intro("One liar");

  it("exactly one server can be the liar given the statements shown", () => {
    for (const s of SEEDS) {
      const { pub, key } = gen<LiarsPub, { liar: number }>(row, s);
      const n = (i: number) => `\`${pub.names[i]}\``;
      // Every statement the generator can write, with what it means for liar L.
      const meaning = new Map<string, (L: number) => boolean>();
      for (let j = 0; j < 4; j++) {
        meaning.set(`${n(j)} is honest.`, (L) => L !== j);
        meaning.set(`${n(j)} is the compromised one.`, (L) => L === j);
        for (let k = 0; k < 4; k++) {
          if (k === j) continue;
          meaning.set(`${n(j)} and ${n(k)} are both honest.`, (L) => L !== j && L !== k);
          meaning.set(`The compromised one is ${n(j)} or ${n(k)}.`, (L) => L === j || L === k);
        }
      }
      const claims = pub.claims.map((c) => meaning.get(c));
      expect(claims.every(Boolean), `seed ${s}: unreadable statement in ${pub.claims}`).toBe(true);
      const consistent = [0, 1, 2, 3].filter((L) => claims.every((c, speaker) => c!(L) === (speaker !== L)));
      expect(consistent, `seed ${s}`).toEqual([key.liar]);
    }
  });

  it("only the liar gets credit", () => {
    for (const s of SEEDS) {
      const { key } = gen<LiarsPub, { liar: number }>(row, s);
      for (let c = 0; c < 4; c++) expect(frac(row, s, { choice: c })).toBe(c === key.liar ? 1 : 0);
      expectFractions(row, s, { none: null, missing: {} }, 0);
    }
  });
});

describe("Lamp circuit", () => {
  const row = intro("Lamp circuit");
  const allSettings = Array.from({ length: 16 }, (_, m) => [8, 4, 2, 1].map((b) => (m & b) !== 0));

  it("exactly one switch setting lights the lamp, and it is the key", () => {
    for (const s of SEEDS) {
      const { pub, key } = gen<CircuitPub, { solution: boolean[] }>(row, s);
      const lit = allSettings.filter((bits) => evalCircuit(pub, bits).out);
      expect(lit, `seed ${s}`).toEqual([key.solution]);
      const on = key.solution.filter(Boolean).length;
      expect(on > 0 && on < 4).toBe(true);
    }
  });

  it("only that setting gets credit", () => {
    for (const s of SEEDS) {
      const { key } = gen<CircuitPub, { solution: boolean[] }>(row, s);
      for (const bits of allSettings) expect(frac(row, s, { bits })).toBe(bits.join() === key.solution.join() ? 1 : 0);
      expectFractions(row, s, { untouched: null, "too short": { bits: key.solution.slice(0, 3) } }, 0);
    }
  });
});

type StridePub = { examples: { args: [number, number, number]; out: number[] }[]; ask: [number, number, number] };

describe("Unknown function", () => {
  const row = intro("Unknown function");
  type Rule = (a: number, b: number, s: number) => number[];
  const up = (a: number, b: number, s: number, incl: boolean) => {
    const o: number[] = [];
    for (let x = a; incl ? x <= b : x < b; x += s) o.push(x);
    return o;
  };
  const down = (a: number, b: number, s: number, incl: boolean) => {
    const o: number[] = [];
    for (let x = a; incl ? x >= b : x > b; x -= s) o.push(x);
    return o;
  };
  // Readings a student might try. The examples must rule out every reading that disagrees on the asked call.
  const RULES: Record<string, Rule> = {
    "inclusive both ways": (a, b, s) => (a <= b ? up(a, b, s, true) : down(a, b, s, true)),
    "end excluded": (a, b, s) => (a <= b ? up(a, b, s, false) : down(a, b, s, false)),
    "end included going up only": (a, b, s) => (a <= b ? up(a, b, s, true) : down(a, b, s, false)),
    "end included going down only": (a, b, s) => (a <= b ? up(a, b, s, false) : down(a, b, s, true)),
    "steps anchored at the end": (a, b, s) => (a <= b ? down(b, a, s, true).reverse() : up(b, a, s, true).reverse()),
    "always counts up": (a, b, s) => up(Math.min(a, b), Math.max(a, b), s, true),
    "third value is a count": (a, b, s) => (s <= 1 ? [a] : Array.from({ length: s }, (_, i) => a + ((b - a) * i) / (s - 1))),
  };

  it("the examples rule out every reading that would change the answer", () => {
    for (const s of SEEDS) {
      const { pub, key } = gen<StridePub, { answer: number[] }>(row, s);
      const fits = Object.entries(RULES).filter(([, r]) => pub.examples.every((e) => JSON.stringify(r(...e.args)) === JSON.stringify(e.out)));
      expect(fits.map(([n]) => n)).toContain("inclusive both ways");
      const answers = new Set(fits.map(([, r]) => JSON.stringify(r(...pub.ask))));
      expect([...answers], `seed ${s}: readings ${fits.map(([n]) => n)}`).toEqual([JSON.stringify(key.answer)]);
    }
  });

  it("accepts every reasonable way of writing the list", () => {
    for (const s of SEEDS) expectFractions(row, s, wrapForms(listForms(gen<StridePub, { answer: number[] }>(row, s).key.answer), "text"), 1);
  });

  it("gives nothing for partial, reordered, padded or empty lists", () => {
    for (const s of SEEDS) {
      const xs = gen<StridePub, { answer: number[] }>(row, s).key.answer;
      expectFractions(
        row,
        s,
        {
          "missing last": { text: xs.slice(0, -1).join(" ") },
          "missing first": { text: xs.slice(1).join(" ") },
          reversed: { text: [...xs].reverse().join(" ") },
          "extra value": { text: [...xs, 0].join(" ") },
          empty: { text: "" },
          "empty brackets": { text: "[]" },
          none: null,
        },
        0,
      );
    }
  });
});

/* ------------------------------------------------------------------- tock */

describe("Tock tracing", () => {
  it("the Tock reference's own examples behave as documented", () => {
    const claims: [string, string][] = [
      ["say range(1, 4)", "[1, 2, 3, 4]"],
      ["say range(5, 2)", "[5, 4, 3, 2]"],
      ["say range(1, 10, 4)", "[1, 5, 9]"],
      ["say range(9, 1, 3)", "[9, 6, 3]"],
      ["say 7 / 2, -7 / 2, 7 % 3", "3 -4 1"],
      ["xs <- [10, 20, 30, 40]\nsay xs[1], xs[-1]", "10 40"],
      ['say "tock"[2]', "o"],
      ["say range(1, 6) |> keep(x -> x % 2 = 1) |> map(x -> x * 10)", "[10, 30, 50]"],
      ["say [2, 0, 2, 6] |> fold(0, (acc, d) -> acc * 10 + d)", "2026"],
    ];
    for (const [src, want] of claims) {
      const r = runTock(src);
      expect(r.error, src).toBeNull();
      expect(r.output.trim(), src).toBe(want);
    }
  });

  for (const title of ["Tock: totals", "Tock: positions"]) {
    describe(title, () => {
      const row = intro(title);
      it("the key is what the shown program prints", () => {
        for (const s of SEEDS) {
          const { pub, key } = gen<{ code: string }, { output: string }>(row, s);
          const r = runTock(pub.code);
          expect(r.error).toBeNull();
          expect(r.output.trim()).toBe(key.output);
          expect(key.output).toMatch(/^\d+$/);
        }
      });
      it("accepts the printed number with any surrounding whitespace", () => {
        // Judgment: the question asks what the program prints, so +84, 084 or 84.0 are not required.
        for (const s of SEEDS) expectFractions(row, s, wrapForms(printedNumberForms(Number(gen<{ code: string }, { output: string }>(row, s).key.output)), "text"), 1);
      });
      it("gives nothing for wrong or empty answers", () => {
        for (const s of SEEDS) {
          const n = Number(gen<{ code: string }, { output: string }>(row, s).key.output);
          expectFractions(row, s, { "one more": { text: String(n + 1) }, "one less": { text: String(n - 1) }, empty: { text: "" }, blank: { text: " \n " }, none: null }, 0);
        }
      });
    });
  }

  describe("Tock: pipes", () => {
    const row = intro("Tock: pipes");
    const listOf = (out: string) => JSON.parse(out) as number[];
    it("the key is what the shown program prints, a non-empty list", () => {
      for (const s of SEEDS) {
        const { pub, key } = gen<{ code: string }, { output: string }>(row, s);
        const r = runTock(pub.code);
        expect(r.error).toBeNull();
        expect(r.output.trim()).toBe(key.output);
        expect(listOf(key.output).length).toBeGreaterThan(0);
      }
    });
    it("accepts the list written as the prompt suggests and in other common ways", () => {
      for (const s of SEEDS) expectFractions(row, s, wrapForms(listForms(listOf(gen<{ code: string }, { output: string }>(row, s).key.output)), "text"), 1);
    });
    it("gives nothing for partial, reordered or empty lists", () => {
      for (const s of SEEDS) {
        const xs = listOf(gen<{ code: string }, { output: string }>(row, s).key.output);
        expectFractions(
          row,
          s,
          {
            "missing last": { text: xs.slice(0, -1).join(" ") },
            reversed: { text: [...xs].reverse().join(" ") },
            "extra value": { text: [...xs, 99].join(" ") },
            empty: { text: "" },
            "empty brackets": { text: "[]" },
            "lone comma": { text: "," },
          },
          0,
        );
      }
    });
  });
});

/* --------------------------------------------------------------- terminal */

type TerminalPub = { env: TerminalEnv; ask: string };

/** Works out all three terminal answers the way a student would: only shell commands and reading. */
function solveTerminal(env: TerminalEnv) {
  const sh: Shell = { env, cwd: env.home, history: [] };
  const run = (cmd: string) => {
    const r = runCommand(sh, cmd);
    sh.cwd = r.cwd;
    return r.out ?? "";
  };
  const seen = {
    readme: run("cat readme.txt"),
    lsNotes: run("ls notes"),
    lsAllNotes: run("ls -a notes"),
    todo: run("cat notes/todo.txt"),
    hint: run("cat notes/.hint"),
  };
  const lines = run("cat /var/log/auth.log").split("\n").filter(Boolean);
  const log = lines.map((l) => {
    const m = l.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})\s+(OK|FAIL)\s+user=(\S+)/);
    if (!m) throw new Error(`Unreadable log line: ${l}`);
    return { day: m[1], time: m[2], ok: m[3] === "OK", user: m[4] };
  });
  const users = run("cat /etc/users")
    .split("\n")
    .filter((l) => l.startsWith("u-"))
    .map((l) => {
      const [id, name] = l.trim().split(/\s+/);
      return { id: id.slice(2), name };
    });
  // Most failed logins.
  const fails = new Map<string, number>();
  for (const e of log) if (!e.ok) fails.set(e.user, (fails.get(e.user) ?? 0) + 1);
  const ranked = [...fails].sort((a, b) => b[1] - a[1]);
  // First successful login after midnight on the 15th, by timestamp and by position in the file.
  const after = log.filter((e) => e.ok && e.day === "2026-03-15");
  const byTime = [...after].sort((a, b) => a.time.localeCompare(b.time));
  const idOf = (name: string) => users.find((u) => u.name === name)!.id;
  // Users who never logged in successfully, then shift the archive back by that many.
  const okUsers = new Set(log.filter((e) => e.ok).map((e) => e.user));
  const never = users.filter((u) => !okUsers.has(u.name)).length;
  const enc = run("cat ~/archive.enc").trim();
  const archive = [...enc].map((c) => String.fromCharCode(65 + ((c.charCodeAt(0) - 65 - never + 26) % 26))).join("");
  return {
    seen,
    users,
    mostFailed: ranked[0][0],
    mostFailedIsUnique: ranked[0][1] > ranked[1][1],
    doorCode: idOf(byTime[0].user).slice(-4),
    firstIsUnique: byTime.length === 1 || byTime[0].time < byTime[1].time,
    firstInFileOrder: after[0].user === byTime[0].user,
    archive,
  };
}

describe("Terminal (Failed logins, Door code, Hidden word)", () => {
  const rows = { most: intro("Failed logins"), door: intro("Door code"), word: intro("Hidden word") };

  it("all three questions share one machine per attempt", () => {
    for (const s of SEEDS) {
      const env = JSON.stringify(gen<TerminalPub, unknown>(rows.most, s).pub.env);
      expect(JSON.stringify(gen<TerminalPub, unknown>(rows.door, s).pub.env)).toBe(env);
      expect(JSON.stringify(gen<TerminalPub, unknown>(rows.word, s).pub.env)).toBe(env);
    }
  });

  it("the answers can be found with the shell alone, are unique, and get full credit", () => {
    for (const s of SEEDS) {
      const t = solveTerminal(gen<TerminalPub, unknown>(rows.most, s).pub.env);
      expect(t.seen.readme).toMatch(/notes\//);
      expect(t.seen.readme).toMatch(/hidden/i);
      expect(t.seen.lsNotes).not.toContain(".hint");
      expect(t.seen.lsAllNotes).toContain(".hint");
      expect(t.seen.todo).toMatch(/last 4 digits/);
      expect(t.seen.todo).toContain("/etc/users");
      expect(t.seen.hint).toMatch(/never logged in successfully/);
      expect(t.users.length).toBe(9);
      expect(t.mostFailedIsUnique, `seed ${s}`).toBe(true);
      expect(t.firstIsUnique, `seed ${s}`).toBe(true);
      expect(t.firstInFileOrder, `seed ${s}`).toBe(true);
      expect(frac(rows.most, s, { text: t.mostFailed }), `seed ${s}`).toBe(1);
      expect(frac(rows.door, s, { text: t.doorCode }), `seed ${s}`).toBe(1);
      expect(frac(rows.word, s, { text: t.archive }), `seed ${s}`).toBe(1);
    }
  });

  it("accepts names and words in any case and spacing, and the door code with or without u-", () => {
    for (const s of SEEDS) {
      const t = solveTerminal(gen<TerminalPub, unknown>(rows.most, s).pub.env);
      expectFractions(rows.most, s, wrapForms(wordForms(t.mostFailed), "text"), 1);
      expectFractions(rows.word, s, wrapForms(wordForms(t.archive), "text"), 1);
      expectFractions(rows.door, s, { plain: { text: t.doorCode }, spaced: { text: ` ${t.doorCode}\n` }, "u- prefix": { text: `u-${t.doorCode}` } }, 1);
    }
  });

  it("gives nothing for other users, other codes, the encoded text or blanks", () => {
    for (const s of SEEDS) {
      const t = solveTerminal(gen<TerminalPub, unknown>(rows.most, s).pub.env);
      const others = t.users.filter((u) => u.name !== t.mostFailed);
      expectFractions(rows.most, s, { "another user": { text: others[0].name }, empty: { text: "" }, none: null }, 0);
      const wrongCode = String((Number(t.doorCode) + 1) % 10000).padStart(4, "0");
      expectFractions(rows.door, s, { "another code": { text: wrongCode }, "whole id": { text: `u-${t.users.find((u) => u.id.endsWith(t.doorCode))!.id}` }, empty: { text: "" } }, 0);
      const enc = runCommand({ env: gen<TerminalPub, unknown>(rows.word, s).pub.env, cwd: "/home/guest", history: [] }, "cat archive.enc").out!.trim();
      expectFractions(rows.word, s, { "still encoded": { text: enc }, "missing a letter": { text: t.archive.slice(0, -1) }, empty: { text: " " } }, 0);
    }
  });
});

/* --------------------------------------------------------------- machines */

describe("Robot trace", () => {
  const row = intro("Robot trace");
  it("only the cell where the shown program ends gets credit", () => {
    for (const s of SEEDS) {
      const { pub, key } = gen<RobotWorld & { program: Block[] }, { x: number; y: number }>(row, s);
      const path = simulate(pub, pub.program);
      const end = path[path.length - 1];
      expect([end.x, end.y]).toEqual([key.x, key.y]);
      const walls = new Set(pub.walls.map(([x, y]) => `${x},${y}`));
      expect(walls.has(`${end.x},${end.y}`)).toBe(false);
      for (let y = 0; y < pub.h; y++)
        for (let x = 0; x < pub.w; x++) {
          if (walls.has(`${x},${y}`)) continue; // the UI does not let you pick a wall
          expect(frac(row, s, { cell: [x, y] })).toBe(x === key.x && y === key.y ? 1 : 0);
        }
      expect(frac(row, s, null)).toBe(0);
    }
  });
});

describe("Rail yard", () => {
  const row = intro("Rail yard");
  it("every train can be sorted with the three moves, and sorting it gets full credit", () => {
    for (const s of SEEDS) {
      const { pub } = gen<{ cars: number[] }, unknown>(row, s);
      const moves: string[] = [];
      const siding: number[] = [];
      let want = 1;
      for (const c of pub.cars) {
        if (c === want) {
          moves.push("pass");
          want++;
        } else {
          moves.push("in");
          siding.push(c);
        }
        while (siding[siding.length - 1] === want) {
          moves.push("out");
          siding.pop();
          want++;
        }
      }
      expect(siding.length, `seed ${s}`).toBe(0);
      expect(frac(row, s, { moves })).toBe(1);
      expect(frac(row, s, { moves: [] })).toBe(0);
      expect(frac(row, s, { moves: pub.cars.map(() => "pass") })).toBeLessThan(1);
    }
  });
});

type CipherPub = { examples: { plain: string; code: string }[]; code: string };

describe("Cipher", () => {
  const row = intro("Cipher");
  const shift = (w: string, f: (i: number) => number, dir: 1 | -1) =>
    [...w].map((ch, i) => String.fromCharCode(65 + ((((ch.charCodeAt(0) - 65 + dir * f(i)) % 26) + 26) % 26))).join("");
  // Rules a student might read off the examples.
  const RULES: Record<string, (i: number) => number> = {
    "shift by position": (i) => i + 1,
    "+1 +2 +3 repeating": (i) => (i % 3) + 1,
    "Fibonacci shifts": (i) => [1, 2, 3, 5, 8, 13, 21, 34][i],
  };

  it("the key decodes the shown code with the rule the examples show", () => {
    for (const s of SEEDS) {
      const { pub, key } = gen<CipherPub, { answer: string }>(row, s);
      for (const e of pub.examples) expect(shift(e.plain, RULES["shift by position"], 1)).toBe(e.code);
      expect(shift(pub.code, RULES["shift by position"], -1)).toBe(key.answer);
    }
  });

  // Ambiguity: every example word has 3 letters, so the examples only show the shifts for letters 1 to 3
  // (+1, +2, +3), while the coded word has 5 or 6 letters. "Shift by position" (+4, +5, +6) is the natural
  // reading and the only one that gives a real word, but other rules fit the examples just as well and
  // decode to something else. Fix: make one example at least as long as the coded word
  // (src/lib/items/widgets/logic.ts, cipher.generate).
  it("the examples pin down the shift for every letter of the coded word", () => {
    for (const s of SEEDS) {
      const { pub } = gen<CipherPub, { answer: string }>(row, s);
      const fits = Object.values(RULES).filter((f) => pub.examples.every((e) => shift(e.plain, f, 1) === e.code));
      expect(new Set(fits.map((f) => shift(pub.code, f, -1))).size, `seed ${s}`).toBe(1);
    }
  });

  it("accepts the word in any case and spacing", () => {
    for (const s of SEEDS) expectFractions(row, s, wrapForms(wordForms(gen<CipherPub, { answer: string }>(row, s).key.answer), "text"), 1);
  });

  it("gives nothing for the coded word, part of the word or a blank", () => {
    for (const s of SEEDS) {
      const { pub, key } = gen<CipherPub, { answer: string }>(row, s);
      expectFractions(row, s, { "coded word": { text: pub.code }, "missing a letter": { text: key.answer.slice(0, -1) }, empty: { text: "" }, none: null }, 0);
    }
  });
});

describe("Light coin", () => {
  const row = intro("Light coin");
  it("weighing 3 against 3, then 1 against 1, always finds the coin for full credit", () => {
    for (const s of SEEDS) {
      const { pub, vars } = gen<{ coins: number; weighings: number }, unknown>(row, s);
      expect(vars).toMatchObject({ coins: pub.coins, weighings: pub.weighings });
      const first = { left: [1, 2, 3], right: [4, 5, 6] };
      const group = scaleReplay(pub.coins, [first], pub.weighings).candidates;
      const second = { left: [group[0]], right: [group[1]] };
      const [coin] = scaleReplay(pub.coins, [first, second], pub.weighings).candidates;
      expect(frac(row, s, { weighings: [first, second], pick: coin })).toBe(1);
      const wrongPick = coin === 1 ? 2 : 1;
      expect(frac(row, s, { weighings: [first, second], pick: wrongPick })).toBe(0);
      expect(frac(row, s, { weighings: [first, second], pick: null })).toBe(0);
    }
  });
  it("any other first weighing leaves too many coins to finish, as the prompt warns", () => {
    for (let k = 1; k <= 4; k++) {
      const left = Array.from({ length: k }, (_, i) => i + 1);
      const right = Array.from({ length: k }, (_, i) => i + 1 + k);
      const left1 = scaleReplay(9, [{ left, right }], 2).candidates.length;
      // One weighing can cut n suspects to ceil(n / 3) at best, so only 3 or fewer can finish.
      expect(left1 <= 3).toBe(k === 3);
    }
  });
});

describe("Fastest route", () => {
  const row = intro("Fastest route");
  it("the key is the true shortest delay, and every fastest route gets full credit", () => {
    for (const s of SEEDS) {
      const { pub, key } = gen<NetPub, { best: number }>(row, s);
      const routes: string[][] = [];
      const walk = (p: string[]) => {
        const last = p[p.length - 1];
        if (last === pub.to) return void routes.push(p);
        for (const e of pub.edges) {
          const next = e.a === last ? e.b : e.b === last ? e.a : null;
          if (next && !p.includes(next)) walk([...p, next]);
        }
      };
      walk([pub.from]);
      const costs = routes.map((r) => pathCost(pub, r)!);
      const best = Math.min(...costs);
      expect(best).toBe(key.best);
      routes.forEach((r, i) => {
        if (costs[i] === best) expect(frac(row, s, { path: r })).toBe(1);
        else if (costs[i] > best + 2) expect(frac(row, s, { path: r })).toBe(0);
      });
      expectFractions(row, s, { "start only": { path: [pub.from] }, "skips a link": { path: [pub.from, pub.to] }, none: null }, 0);
    }
  });
});

type GridPub = { people: string[]; langs: string[]; lockers: number[]; clues: string[] };
type GridKey = { lang: number[]; locker: number[] };
type GridSol = { lang: number[]; locker: number[] };

/** Every clue sentence the generator can write for this grid, with its meaning. */
function clueMeanings(p: GridPub): Map<string, (s: GridSol) => boolean> {
  const { people, langs, lockers } = p;
  const m = new Map<string, (s: GridSol) => boolean>();
  const who = (s: GridSol, l: number) => s.lang.indexOf(l);
  for (let a = 0; a < 4; a++) {
    for (let l = 0; l < 4; l++) {
      m.set(`${people[a]} does not use ${langs[l]}.`, (s) => s.lang[a] !== l);
      m.set(`${people[a]} uses ${langs[l]}.`, (s) => s.lang[a] === l);
      m.set(`The ${langs[l]} user's locker number is higher than ${people[a]}'s.`, (s) => who(s, l) !== a && lockers[s.locker[who(s, l)]] > lockers[s.locker[a]]);
    }
    for (let k = 0; k < 4; k++) m.set(`${people[a]} does not have locker ${lockers[k]}.`, (s) => s.locker[a] !== k);
    for (let b = 0; b < 4; b++) {
      if (b === a) continue;
      // "Neighboring" means next to each other among the four lockers shown.
      m.set(`${people[a]} and ${people[b]} have neighboring lockers (no locker between them).`, (s) => Math.abs(s.locker[a] - s.locker[b]) === 1);
      for (let l = 0; l < 4; l++) m.set(`Neither ${people[a]} nor ${people[b]} uses ${langs[l]}.`, (s) => s.lang[a] !== l && s.lang[b] !== l);
    }
  }
  for (let l = 0; l < 4; l++) {
    for (let k = 0; k < 4; k++) m.set(`The ${langs[l]} user has locker ${lockers[k]}.`, (s) => s.locker[who(s, l)] === k);
    m.set(`The ${langs[l]} user has the lowest locker number.`, (s) => s.locker[who(s, l)] === 0);
  }
  return m;
}

describe("Lockers", () => {
  const row = intro("Lockers");
  it("the clues as written allow exactly one grid, and it is the key", () => {
    for (const s of SEEDS) {
      const { pub, key } = gen<GridPub, GridKey>(row, s);
      const meanings = clueMeanings(pub);
      const clues = pub.clues.map((c) => meanings.get(c));
      expect(clues.every(Boolean), `seed ${s}: unreadable clue in ${pub.clues}`).toBe(true);
      const sols: GridSol[] = [];
      for (const lang of P4) for (const locker of P4) if (clues.every((c) => c!({ lang, locker }))) sols.push({ lang, locker });
      expect(sols, `seed ${s}`).toEqual([{ lang: key.lang, locker: key.locker }]);
    }
  });
  it("the solved grid gets full credit and an empty or all-wrong grid gets nothing", SLOW, () => {
    for (const s of SEEDS) {
      const { key } = gen<GridPub, GridKey>(row, s);
      const shiftAll = (xs: number[]) => xs.map((x) => (x + 1) % 4);
      expect(frac(row, s, { lang: key.lang, locker: key.locker, marks: { "lang:0:0": "x" } })).toBe(1);
      expectFractions(row, s, { untouched: { lang: [-1, -1, -1, -1], locker: [-1, -1, -1, -1] }, "all wrong": { lang: shiftAll(key.lang), locker: shiftAll(key.locker) }, none: null }, 0);
    }
  });
});

describe("Tock: find the input", () => {
  const row = intro("Tock: find the input");
  type RevPub = { code: string; lo: number; hi: number };
  it("the inputs that print yes are exactly the key, and each one gets full credit", SLOW, () => {
    for (const s of SEEDS) {
      const { pub, key, vars } = gen<RevPub, { answers: number[] }>(row, s);
      expect(vars).toMatchObject({ lo: pub.lo, hi: pub.hi });
      const yes: number[] = [];
      for (let x = pub.lo; x <= pub.hi; x++) {
        const r = runTock(pub.code, `${x}\n`);
        expect(r.error).toBeNull();
        if (r.output.trim() === "yes") yes.push(x);
      }
      expect(yes.length).toBeGreaterThan(0);
      expect(yes).toEqual(key.answers);
      for (const a of yes) expect(frac(row, s, { text: String(a) })).toBe(1);
      const no = Array.from({ length: pub.hi - pub.lo + 1 }, (_, i) => pub.lo + i).find((x) => !yes.includes(x))!;
      expectFractions(row, s, { "prints no": { text: String(no) }, "below range": { text: String(pub.lo - 1) }, "above range": { text: String(pub.hi + 1) }, empty: { text: "" }, none: null }, 0);
    }
  });
  it("accepts every reasonable way of typing a valid input", SLOW, () => {
    for (const s of SEEDS.slice(0, 120)) {
      const { key } = gen<RevPub, { answers: number[] }>(row, s);
      const { "thousands separator": _unused, ...forms } = numberForms(key.answers[0]);
      expectFractions(row, s, wrapForms(forms, "text"), 1);
    }
  });
});

/* ------------------------------------------------------------- code lock */

const ALL_CODES: string[] = [];
for (let n = 0; n < 10000; n++) {
  const c = String(n).padStart(4, "0");
  if (new Set(c).size === 4) ALL_CODES.push(c);
}

/** Feedback as the prompt describes it: digits right and in the right place, digits in the code but elsewhere. */
function feedback(secret: string, guess: string): number {
  let exact = 0;
  let near = 0;
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === secret[i]) exact++;
    else if (secret.includes(guess[i])) near++;
  }
  return exact * 10 + near;
}

const lockPlan = new Map<string, string>();
/** Picks the guess that leaves the fewest codes in the worst case, preferring codes that could be right. */
function nextGuess(candidates: string[], history: string): string {
  if (!history) return "0123";
  if (candidates.length <= 2) return candidates[0];
  const known = lockPlan.get(history);
  if (known) return known;
  const pool = candidates.length > 300 ? ALL_CODES : candidates;
  const possible = new Set(candidates);
  let best = candidates[0];
  let bestScore = Infinity;
  for (const g of pool) {
    const parts = new Map<number, number>();
    for (const c of candidates) {
      const k = feedback(c, g);
      parts.set(k, (parts.get(k) ?? 0) + 1);
    }
    const score = Math.max(...parts.values()) * 2 + (possible.has(g) ? 0 : 1);
    if (score < bestScore) {
      bestScore = score;
      best = g;
    }
  }
  lockPlan.set(history, best);
  return best;
}

/** Plays the lock using only the feedback for each try. Returns the tries used, or null if it never opened. */
function playLock(tryCode: (guess: string) => { exact: number; near: number; solved: boolean }, maxGuesses: number): number | null {
  let candidates = ALL_CODES;
  let history = "";
  for (let n = 1; n <= maxGuesses; n++) {
    const guess = nextGuess(candidates, history);
    const r = tryCode(guess);
    if (r.solved) return n;
    const k = r.exact * 10 + r.near;
    history += `${guess}=${k};`;
    candidates = candidates.filter((c) => feedback(c, guess) === k);
  }
  return null;
}

describe("Code lock", () => {
  const row = intro("Code lock");
  type LockPub = { digits: number; maxGuesses: number };
  type LockReply = { guesses: { guess: string; exact: number; near: number }[]; solved: boolean; error?: string };

  it("a deduction strategy opens every possible code within the allowed tries", SLOW, () => {
    const { pub } = gen<LockPub, unknown>(row, SEEDS[0]);
    expect(pub.digits).toBe(4);
    let worst = 0;
    for (const secret of ALL_CODES) {
      const used = playLock((g) => {
        const k = feedback(secret, g);
        return { exact: Math.floor(k / 10), near: k % 10, solved: g === secret };
      }, pub.maxGuesses);
      expect(used, `code ${secret}`).not.toBeNull();
      worst = Math.max(worst, used!);
    }
    expect(worst).toBeLessThanOrEqual(pub.maxGuesses);
  });

  it("a student can open it through interactItem using only the replies, for full credit", SLOW, () => {
    for (const s of SEEDS) {
      const { pub, key } = gen<LockPub, { secret: string }>(row, s);
      let state: unknown = null;
      const used = playLock((guess) => {
        const r = interactItem(row, s, state, { guess })!;
        state = r.state;
        const reply = r.reply as LockReply;
        expect(reply.error).toBeUndefined();
        const last = reply.guesses[reply.guesses.length - 1];
        // The server's feedback matches the rule the prompt states.
        expect(last.exact * 10 + last.near).toBe(feedback(key.secret, guess));
        return { exact: last.exact, near: last.near, solved: reply.solved };
      }, pub.maxGuesses);
      expect(used, `seed ${s}`).not.toBeNull();
      expect(frac(row, s, null, state)).toBe(1);
      expect(frac(row, s, null, null)).toBe(0);
    }
  });
});

/* ---------------------------------------------------------- robot program */

describe("Robot program", () => {
  const row = intro("Robot program");
  // One solution per level, buildable in the UI: repeat counts 2 to 9, at most `limit` blocks.
  const SOLUTIONS: Block[][] = [
    [{ op: "repeat", n: 5, body: [{ op: "F" }, { op: "L" }, { op: "F" }, { op: "R" }] }],
    [{ op: "repeat", n: 3, body: [{ op: "F" }, { op: "F" }, { op: "R" }, { op: "F" }, { op: "F" }, { op: "L" }] }],
    [{ op: "repeat", n: 3, body: [{ op: "repeat", n: 6, body: [{ op: "F" }] }, { op: "R" }] }],
  ];
  const repeatsInRange = (bs: Block[]): boolean => bs.every((b) => b.op !== "repeat" || (b.n >= 2 && b.n <= 9 && repeatsInRange(b.body)));

  it("every level can be solved within its block limit with blocks the UI can build", () => {
    BUILD_LEVELS.forEach((level, i) => {
      expect(blockCount(SOLUTIONS[i])).toBeLessThanOrEqual(level.limit);
      expect(repeatsInRange(SOLUTIONS[i])).toBe(true);
      const end = simulate(level, SOLUTIONS[i]).at(-1)!;
      expect([end.x, end.y]).toEqual(level.goal);
    });
  });

  it("the solution for the level shown gets full credit and an empty program gets nothing", () => {
    for (const s of SEEDS) {
      const { pub, vars } = gen<BuildLevel, unknown>(row, s);
      const level = BUILD_LEVELS.findIndex((l) => JSON.stringify(l) === JSON.stringify(pub));
      expect(level).toBeGreaterThanOrEqual(0);
      expect(vars).toMatchObject({ limit: pub.limit });
      expect(frac(row, s, { program: SOLUTIONS[level] })).toBe(1);
      expectFractions(row, s, { empty: { program: [] }, none: null }, 0);
    }
  });
});

/* ------------------------------------------------------------- grid paths */

describe("Grid paths", () => {
  const row = intro("Grid paths");
  it("the key is the number of right/down paths around the blocked cells shown", () => {
    for (const s of SEEDS) {
      const { pub, key } = gen<PathsPub, { answer: number }>(row, s);
      expect(countPaths(pub)).toBe(key.answer);
      const blocked = new Set(pub.blocked.map(([r, c]) => `${r},${c}`));
      expect(blocked.has("0,0") || blocked.has(`${pub.rows - 1},${pub.cols - 1}`)).toBe(false);
    }
  });
  it("accepts every reasonable way of typing the count", () => {
    for (const s of SEEDS) expectFractions(row, s, wrapForms(numberForms(gen<PathsPub, { answer: number }>(row, s).key.answer), "value"), 1);
  });
  it("gives nothing for wrong or empty answers", () => {
    for (const s of SEEDS) {
      const n = gen<PathsPub, { answer: number }>(row, s).key.answer;
      expectFractions(row, s, { "one more": { value: String(n + 1) }, "one less": { value: String(n - 1) }, empty: { value: "" }, none: null }, 0);
    }
  });
});

/* ----------------------------------------------------------------- lights */

type LightsPub = { size: number; start: boolean[]; min: number };

function fewestPresses(pub: LightsPub): number[] | null {
  let best: number[] | null = null;
  const n = pub.size * pub.size;
  for (let m = 0; m < 1 << n; m++) {
    const ps = Array.from({ length: n }, (_, i) => i).filter((i) => m & (1 << i));
    if (best && ps.length >= best.length) continue;
    const board = ps.reduce((b, i) => press(b, pub.size, i), [...pub.start]);
    if (board.every((x) => !x)) best = ps;
  }
  return best;
}

describe("Lights", () => {
  const row = intro("Lights");
  const fewest = new Map<number, number[]>();
  const solve = (s: number) => {
    if (!fewest.has(s)) fewest.set(s, fewestPresses(gen<LightsPub, unknown>(row, s).pub)!);
    return fewest.get(s)!;
  };
  /** Two cancelling pairs first, so the board is never clear until the last press (so the UI allows it). */
  const longWay = (s: number) => [4, 4, 8, 8, ...solve(s)];
  /** 100 cancelling pairs on one light, then the fewest presses: 200+ presses in all. */
  const over200 = (s: number) => [...Array(200).fill(0), ...solve(s)];
  /** What the UI computes (src/components/items/widgets/machines.tsx:580): every press, in order. */
  const uiCleared = (pub: LightsPub, presses: number[]) => presses.reduce((b, i) => press(b, pub.size, i), [...pub.start]).every((x) => !x);
  /** True when no earlier prefix clears the board, so the UI keeps the board clickable until the last press. */
  const clearOnlyAtEnd = (pub: LightsPub, presses: number[]) => presses.every((_, i) => uiCleared(pub, presses.slice(0, i + 1)) === (i === presses.length - 1));

  it("the board can be cleared, the 'Best possible' shown is right, and clearing it that way gets full credit", () => {
    for (const s of SEEDS) {
      const { pub } = gen<LightsPub, unknown>(row, s);
      const sol = solve(s);
      expect(sol, `seed ${s}`).toBeTruthy();
      expect(sol.length).toBe(pub.min);
      expect(frac(row, s, { presses: sol })).toBe(1);
      expect(frac(row, s, { presses: [...sol, 4, 4] })).toBe(1); // min + 2 is still full credit
      expectFractions(row, s, { "no presses": { presses: [] }, "not cleared": { presses: sol.slice(1) }, none: null }, 0);
    }
  });

  it("the long press sequences used below clear the board in the UI and are reachable there", () => {
    for (const s of SEEDS) {
      const { pub } = gen<LightsPub, unknown>(row, s);
      expect(clearOnlyAtEnd(pub, longWay(s)), `seed ${s}`).toBe(true);
      if (s <= SEEDS[49]) expect(clearOnlyAtEnd(pub, over200(s)), `seed ${s}`).toBe(true);
    }
  });

  // Defect: clearing the board in more than min + 2 presses scores 0.6 (src/lib/items/widgets/machines.ts:328),
  // but the prompt only says "Turn every light off" and never mentions a press limit. The UI shows
  // "Best possible: N" but hides "Start over" and disables the board once it is clear
  // (src/components/items/widgets/machines.tsx:590 and 607-613), so a student who cleared it the long way
  // cannot redo it. Fair if extra presses are not penalised, or if the prompt states the limit ({{min}} is in vars).
  it("clearing the board the long way gets full credit, unless the prompt states the press limit", () => {
    for (const s of SEEDS) {
      expect(frac(row, s, { presses: longWay(s) }) === 1 || /\{\{\s*(min|limit)\s*\}\}/.test(row.prompt), `seed ${s}`).toBe(true);
    }
  });

  // Defect: the grader replays only the first 200 presses (src/lib/items/widgets/machines.ts:325) while the
  // UI replays all of them (src/components/items/widgets/machines.tsx:580), so a board the student sees as
  // cleared after more than 200 presses is graded 0. Fix: replay the same presses the UI does, or cap both.
  it("a board the UI shows as cleared is graded as cleared, however many presses it took", () => {
    for (const s of SEEDS.slice(0, 50)) {
      expect(frac(row, s, { presses: over200(s) }), `seed ${s}`).toBeGreaterThan(0);
    }
  });
});

/* -------------------------------------------------------- tock: write it */

describe("Tock: write it", () => {
  const row = intro("Tock: write it");
  const solution = `n <- read\nsay range(1, n) |> count(x -> text(x) |> count(c -> c = "7") > 0)`;
  it("a correct program passes every hidden test and the sample in the prompt is right", () => {
    for (const s of SEEDS) {
      const { pub, vars } = gen<{ sample: { input: string; output: string } }, { tests: unknown[] }>(row, s);
      expect(runTock(solution, pub.sample.input).output.trim()).toBe(pub.sample.output);
      expect(vars).toMatchObject({ sampleIn: Number(pub.sample.input.trim()), sampleOut: pub.sample.output });
      expect(frac(row, s, { code: solution })).toBe(1);
      expect(frac(row, s, { code: "say 0" })).toBeLessThan(1);
      expectFractions(row, s, { empty: { code: "" }, blank: { code: "\n  \n" }, none: null }, 0);
    }
  });
});

describe("Explain a strategy", () => {
  it("is left for a person or Claude to grade, never auto-scored", () => {
    const row = intro("Explain a strategy");
    expect(needsReview(row)).toBe(true);
    for (const s of SEEDS.slice(0, 20)) expect(gradeItem(row, s, { text: "Weigh 9 against 9." }, null).fraction).toBeNull();
  });
});

/* -------------------------------------------- generic types (practice test) */

describe("Practice Round 1 (generic question types)", () => {
  const hex = pick(PRACTICE, "Hex to decimal");
  const prefix = pick(PRACTICE, "Prefix");
  const circulate = pick(PRACTICE, "Circulate");

  it("Hex to decimal: the key is the shown hex number in base 10", () => {
    for (const s of SEEDS) {
      const { key, vars } = gen<unknown, { answer: number }>(hex, s);
      expect(key.answer).toBe(parseInt(String(vars!.h), 16));
    }
  });

  it("Hex to decimal: accepts every reasonable way of typing the number, rejects wrong and blank", () => {
    for (const s of SEEDS) {
      const n = gen<unknown, { answer: number }>(hex, s).key.answer;
      expectFractions(hex, s, wrapForms(numberForms(n), "value"), 1);
      expectFractions(hex, s, { "one more": { value: String(n + 1) }, "hex digits": { value: String(gen(hex, s).vars!.h) }, empty: { value: "" }, none: null }, 0);
    }
  });

  // Defect: parseNumber (src/lib/items/generic.ts:91-100) uses Number(), which also reads JavaScript literals
  // such as 0x2F, 0o57 and 0b101111. Typing the hex number from the prompt with a 0x prefix gets full credit
  // on a question that asks to convert it to base 10. Fix: only accept decimal digits (with optional sign,
  // decimal point, commas or a/b) before calling Number().
  it("Hex to decimal: does not accept the prompt's hex number written as a 0x literal", () => {
    for (const s of SEEDS) {
      const h = String(gen(hex, s).vars!.h);
      expect(frac(hex, s, { value: `0x${h}` }), `seed ${s}: 0x${h}`).toBe(0);
    }
  });

  it("Prefix: the key is the value of the prefix expression in the prompt", () => {
    const tokens = prefix.prompt.match(/`([^`]+)`/)![1].split(/\s+/);
    let i = 0;
    const evalPrefix = (): number => {
      const t = tokens[i++];
      if (/^\d+$/.test(t)) return Number(t);
      const a = evalPrefix();
      const b = evalPrefix();
      return t === "+" ? a + b : t === "-" ? a - b : t === "*" ? a * b : a / b;
    };
    const value = evalPrefix();
    const { key } = gen<unknown, { accept: string[] }>(prefix, SEEDS[0]);
    expect(key.accept).toEqual([String(value)]);
  });

  it("Prefix: accepts every reasonable way of typing the number, rejects wrong and blank", () => {
    for (const s of SEEDS) {
      expectFractions(prefix, s, wrapForms(numberForms(28), "text"), 1);
      expectFractions(prefix, s, { "one less": { text: "27" }, empty: { text: "" }, blank: { text: "  " }, none: null }, 0);
    }
  });

  it("Circulate: the keyed option is LCIRC-2 of the shown bits, and only it gets credit", () => {
    const [, nStr, bits] = circulate.prompt.match(/LCIRC-(\d+) ([01]+)/)!;
    const n = Number(nStr);
    const rotated = bits.slice(n) + bits.slice(0, n);
    for (const s of SEEDS) {
      const { pub, key } = gen<{ options: string[] }, { answer: number }>(circulate, s);
      expect(pub.options[key.answer]).toBe(`\`${rotated}\``);
      pub.options.forEach((_, c) => expect(frac(circulate, s, { choice: c })).toBe(c === key.answer ? 1 : 0));
      expectFractions(circulate, s, { none: null, missing: {} }, 0);
    }
  });
});

/* ------------------------------------------------------------- quick fire */

describe("Quick fire multiple choice", () => {
  type McqPub = { options: string[] };
  type McqKey = { answer: number };
  /** The right answer for each question, worked out from the version's numbers. */
  const truth: Record<string, (vars: Record<string, string | number>) => string> = {
    "Ten rounds": (v) => {
      let x = Number(v.start);
      for (let i = 0; i < 10; i++) x = 2 * x - 1;
      return String(x);
    },
    "Poisoned bottle": (v) => {
      const n = Number(String(v.n).replace(/,/g, ""));
      let k = 0;
      while (2 ** k < n) k++;
      return String(k);
    },
    "Neighbor swaps": (v) => {
      const xs = String(v.list).split(" ").map(Number);
      let inv = 0;
      for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) if (xs[i] > xs[j]) inv++;
      return String(inv);
    },
    "Counting calls": (v) => {
      const calls = (n: number): number => (n < 2 ? 1 : 1 + calls(n - 1) + calls(n - 2));
      return String(calls(Number(v.n)));
    },
  };
  for (const title of Object.keys(truth)) {
    it(`${title}: every version keys the right answer, listed once, and only it scores`, () => {
      const row = intro(title);
      for (const s of SEEDS.slice(0, 120)) {
        const g = gen<McqPub, McqKey>(row, s);
        const want = truth[title](g.vars ?? {});
        expect(g.pub.options[g.key.answer], `${title} seed ${s}`).toBe(want);
        expect(g.pub.options.filter((o) => o === want).length).toBe(1);
        expect(fillVars(row.prompt, g.vars)).not.toMatch(/\{\{/);
        for (let i = 0; i < g.pub.options.length; i++) expect(frac(row, s, { choice: i })).toBe(i === g.key.answer ? 1 : 0);
      }
    });
  }
});

/* ------------------------------------------------------------------ glyph */

describe("Glyph", () => {
  const row = intro("Glyph");
  type GlyphPub = { code: string };
  type GlyphKey = { output: number[] };

  it("the key is what the program prints, and the program runs cleanly", () => {
    for (const s of SEEDS) {
      const { pub, key } = gen<GlyphPub, GlyphKey>(row, s);
      const r = runGlyph(pub.code);
      expect(r.error, `seed ${s}: ${pub.code}`).toBeUndefined();
      expect(r.out).toEqual(key.output);
    }
  });

  it("the manual's examples print what the manual says", () => {
    for (const [code, out] of [["2 3 + .", [5]], ["4 : * .", [16]], ["1 2 ~ - .", [1]], ["1 3( 2 * ) .", [8]], ["7 2 - .", [5]], ["1 2 3 ^ . . .", [1, 3, 2]]] as const)
      expect(runGlyph(code).out).toEqual(out);
  });

  it("accepts every reasonable way of writing the printed numbers, and nothing else", () => {
    for (const s of SEEDS) {
      const { key } = gen<GlyphPub, GlyphKey>(row, s);
      expectFractions(row, s, wrapForms(listForms(key.output), "text"), 1);
      expectFractions(row, s, { blank: { text: " " }, none: null, "off by one": { text: [...key.output.slice(0, -1), key.output[key.output.length - 1] + 1].join(" ") } }, 0);
    }
  });
});

/* -------------------------------------------------------------- the door */

describe("Open the door", () => {
  const row = intro("Open the door");
  type DoorKey = Parameters<typeof doorStep>[0];
  const play = (key: DoorKey, cmds: string[], now = 1_000_000) => {
    let state: DoorState | null = null;
    const outs: string[] = [];
    for (const c of cmds) {
      const r = doorStep(key, state, c, now);
      state = r.state;
      outs.push(r.reply.out);
    }
    return { state: state!, outs };
  };
  /** Works out the address and code the way a student would: only from what the commands print. */
  const solve = (key: DoorKey) => {
    const read = play(key, ["cat /etc/hosts", "cat /etc/door.conf", "date"]).outs;
    const hosts = read[0].split("\n").filter((l) => /^10\./.test(l)).map((l) => ({ ip: l.split(/\s+/)[0], name: l.split(/\s+/)[1] }));
    const net = read[1].match(/allow\s+(\d+\.\d+\.\d+)\.0\/24/)![1];
    const cams = hosts.filter((h) => h.name.startsWith("cam-") && h.ip.startsWith(net + "."));
    const hour = Number(read[2].match(/ (\d\d):\d\d:\d\d /)![1]);
    const code = /times the number of cameras/.test(read[1]) ? hour * cams.length : cams.reduce((t, h) => t + Number(h.ip.split(".")[3]), 0);
    const used = new Set(hosts.map((h) => h.ip));
    let free = 50;
    while (used.has(`${net}.${free}`)) free++;
    return { addr: `${net}.${free}`, code: String(code), net };
  };

  it("can be opened using only what the commands show, for full credit", () => {
    for (const s of SEEDS) {
      const { key } = gen<unknown, DoorKey>(row, s);
      const { addr, code } = solve(key);
      expect(code, `seed ${s}`).toBe(key.code);
      const { state, outs } = play(key, ["connect door", `ip set ${addr}`, "connect door", `unlock ${code}`]);
      expect(outs[0]).toMatch(/refused/);
      expect(state.opened, `seed ${s}: ${outs.join(" | ")}`).toBe(true);
      expect(frac(row, s, null, state)).toBe(1);
    }
  });

  it("refuses taken and outside addresses, early unlocks, and guessing", () => {
    for (const s of SEEDS.slice(0, 100)) {
      const { key } = gen<unknown, DoorKey>(row, s);
      const { addr, net } = solve(key);
      const cam = key.hosts.find((h) => h.ip.startsWith(net + ".") && h.name.startsWith("cam-"))!;
      expect(play(key, [`ip set ${cam.ip}`]).outs[0]).toMatch(/already used/);
      expect(play(key, ["ip set 192.168.1.5"]).outs[0]).toMatch(/10\.0\.x\.x/);
      expect(play(key, ["unlock 1234"]).state.opened).toBe(false);
      // Three wrong codes lock it, so even the right code fails until the lock runs out.
      const wrong = String(Number(key.code) + 1);
      const locked = play(key, [`ip set ${addr}`, "connect door", `unlock ${wrong}`, `unlock ${wrong}`, `unlock ${wrong}`, `unlock ${key.code}`]);
      expect(locked.state.opened).toBe(false);
      expect(locked.outs[5]).toMatch(/locked/);
      expect(doorStep(key, locked.state, `unlock ${key.code}`, 1_000_000 + 31_000).state.opened).toBe(true);
      // Getting through to the controller is worth part of it.
      expect(frac(row, s, null, play(key, [`ip set ${addr}`, "connect door"]).state)).toBe(0.3);
      expect(frac(row, s, null, null)).toBe(0);
    }
  });

  it("reset starts over without undoing an open door or a lockout", () => {
    for (const s of SEEDS.slice(0, 50)) {
      const { key } = gen<unknown, DoorKey>(row, s);
      const { addr, code } = solve(key);
      const moved = play(key, [`ip set ${addr}`, "cd /etc", "connect door"]);
      const r = doorStep(key, moved.state, "reset", 1_000_000);
      expect(r.reply.clear).toBe(true);
      expect([r.state.ip, r.state.cwd, r.state.connected], `seed ${s}`).toEqual([key.start, key.env.home, false]);
      const opened = play(key, [`ip set ${addr}`, "connect door", `unlock ${code}`]);
      expect(doorStep(key, opened.state, "reset", 1_000_000).state.opened).toBe(true);
      const wrong = String(Number(key.code) + 1);
      const locked = play(key, [`ip set ${addr}`, "connect door", `unlock ${wrong}`, `unlock ${wrong}`, `unlock ${wrong}`]);
      const after = doorStep(key, locked.state, "reset", 1_000_000).state;
      expect(after.lockedUntil).toBe(locked.state.lockedUntil);
      expect(play(key, ["help"]).outs[0]).toMatch(/cd \.\. goes back up/);
    }
  });

  it("gives one hint that follows the student's progress, and keeps it", () => {
    for (const s of SEEDS.slice(0, 50)) {
      const { key } = gen<unknown, DoorKey>(row, s);
      const { addr, code } = solve(key);
      const hintFor = (cmds: string[]) => {
        const st = cmds.length ? play(key, cmds).state : null;
        const r = interactItem(row, s, st, { hint: true })!;
        expect(r.counts).toBe(false);
        return { hint: (r.reply as DoorState).hint!, state: r.state as DoorState };
      };
      expect(hintFor([]).hint).toMatch(/connect door/);
      expect(hintFor(["connect door"]).hint).toMatch(/door\.conf/);
      expect(hintFor(["connect door", "cat /etc/door.conf"]).hint).toMatch(new RegExp(`only allows addresses on ${key.net.replace(/\./g, "\\.")}\\.x`));
      expect(hintFor(["connect door", "cat /etc/door.conf", `ip set ${addr}`]).hint).toMatch(/connect door` again/);
      const near = hintFor(["cat /etc/door.conf", `ip set ${addr}`, "connect door"]);
      expect(near.hint, `seed ${s}`).toMatch(/cam-/);
      expect(near.hint).not.toContain(code);
      // Asking again gives the same hint, and commands and reset keep it.
      const again = interactItem(row, s, near.state, { hint: true })!;
      expect((again.reply as DoorState).hint).toBe(near.hint);
      const after = doorStep(key, near.state, "reset", 1_000_000).state;
      expect(after.hint).toBe(near.hint);
      expect(doorStep(key, after, "ls", 1_000_000).state.hint).toBe(near.hint);
    }
  });

  it("the interact path the site uses works the same way", () => {
    const s = SEEDS[3];
    const { key } = gen<unknown, DoorKey>(row, s);
    const { addr, code } = solve(key);
    let state: unknown = null;
    for (const cmd of [`ip set ${addr}`, "connect door", `unlock ${code}`]) state = interactItem(row, s, state, { cmd })!.state;
    expect((state as DoorState).opened).toBe(true);
  });
});
