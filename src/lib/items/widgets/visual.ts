import type { WidgetModule } from "../types";
import { normalizeText } from "../generic";

/* -------------------------------------------------------------- figures */

export type FigurePattern = "rect" | "tri" | "diamond";

export function figureCount(p: FigurePattern, n: number): number {
  if (p === "rect") return n * (n + 1);
  if (p === "tri") return (n * (n + 1)) / 2;
  return n * n + (n - 1) * (n - 1);
}

/** Dot coordinates (grid units) for figure n. */
export function figureDots(p: FigurePattern, n: number): [number, number][] {
  const out: [number, number][] = [];
  if (p === "rect") {
    for (let r = 0; r < n; r++) for (let c = 0; c < n + 1; c++) out.push([c, r]);
  } else if (p === "tri") {
    for (let r = 0; r < n; r++) for (let c = 0; c <= r; c++) out.push([c, r]);
  } else {
    // centered square number drawn as a diamond
    for (let r = -(n - 1); r <= n - 1; r++) {
      const w = n - 1 - Math.abs(r);
      for (let c = -w; c <= w; c++) out.push([c + n - 1, r + n - 1]);
    }
  }
  return out;
}

type FiguresPub = { pattern: FigurePattern; shown: number[]; ask: number };
export const figures: WidgetModule<{ patterns?: FigurePattern[] }, FiguresPub, { answer: number }, { value: string }> = {
  generate(rng, c) {
    const pattern = rng.pick(c.patterns ?? (["rect", "tri", "diamond"] as FigurePattern[]));
    const ask = rng.int(6, 8);
    return { pub: { pattern, shown: [1, 2, 3, 4], ask }, key: { answer: figureCount(pattern, ask) }, vars: { ask } };
  },
  grade(_p, key, r) {
    return { fraction: r && Number(String(r.value).trim()) === key.answer ? 1 : 0 };
  },
  describeKey: (_p, k) => String(k.answer),
};

/* ---------------------------------------------------------------- gears */

const LETTERS = "ABCDEFG";
type GearsPub = { teeth: number[]; turns: number; labels: string[] };
type GearsKey = { dir: "cw" | "ccw"; turns: number };
export const gears: WidgetModule<object, GearsPub, GearsKey, { dir?: string; turns?: string }> = {
  generate(rng) {
    for (;;) {
      const k = rng.pick([4, 5, 6]);
      const first = rng.pick([24, 30, 36, 40, 48]);
      const last = rng.pick([8, 10, 12, 15, 16, 20]);
      const turns = rng.int(2, 5);
      if ((first * turns) % last !== 0) continue;
      const lastTurns = (first * turns) / last;
      if (lastTurns < 3 || lastTurns > 30) continue;
      const middle = Array.from({ length: k - 2 }, () => rng.pick([9, 11, 13, 14, 18, 21, 22, 27]));
      const teeth = [first, ...middle, last];
      const labels = LETTERS.slice(0, k).split("");
      return {
        pub: { teeth, turns, labels },
        key: { dir: k % 2 === 1 ? "cw" : "ccw", turns: lastTurns },
        vars: { turns, last: labels[k - 1] },
      };
    }
  },
  grade(_p, key, r) {
    if (!r) return { fraction: 0 };
    // The direction is a coin flip on its own, so only the worked-out turns earn partial credit.
    const turns = Number(String(r.turns ?? "").trim()) === key.turns;
    return { fraction: turns ? (r.dir === key.dir ? 1 : 0.5) : 0 };
  },
  describeKey: (_p, k) => `${k.dir === "cw" ? "Clockwise" : "Counterclockwise"}, ${k.turns} turns`,
};

/* -------------------------------------------------------------- circuit */

export type GateOp = "AND" | "OR" | "XOR";
export type CircuitPub = {
  ops: [GateOp, GateOp, GateOp];
  /** NOT bubbles on: inputs a b c d, gate outputs g1 g2, and the final output. */
  neg: { a: boolean; b: boolean; c: boolean; d: boolean; g1: boolean; g2: boolean; out: boolean };
};

const applyGate = (op: GateOp, x: boolean, y: boolean) => (op === "AND" ? x && y : op === "OR" ? x || y : x !== y);

export function evalCircuit(c: CircuitPub, bits: boolean[]): { g1: boolean; g2: boolean; out: boolean } {
  const [a, b, cc, d] = bits.map(Boolean);
  const n = c.neg;
  const g1 = applyGate(c.ops[0], a !== n.a, b !== n.b);
  const g2 = applyGate(c.ops[1], cc !== n.c, d !== n.d);
  const out = applyGate(c.ops[2], g1 !== n.g1, g2 !== n.g2) !== n.out;
  return { g1, g2, out };
}

function allAssignments(): boolean[][] {
  return Array.from({ length: 16 }, (_, m) => [8, 4, 2, 1].map((bit) => (m & bit) !== 0));
}

export const circuit: WidgetModule<object, CircuitPub, { solution: boolean[] }, { bits: boolean[] }> = {
  generate(rng) {
    for (;;) {
      const pub: CircuitPub = {
        ops: [rng.pick(["AND", "OR", "XOR"] as GateOp[]), rng.pick(["AND", "OR", "XOR"] as GateOp[]), rng.pick(["AND", "OR"] as GateOp[])],
        neg: {
          a: rng.chance(0.35),
          b: rng.chance(0.35),
          c: rng.chance(0.35),
          d: rng.chance(0.35),
          g1: rng.chance(0.3),
          g2: rng.chance(0.3),
          out: rng.chance(0.2),
        },
      };
      const sols = allAssignments().filter((bits) => evalCircuit(pub, bits).out);
      // Exactly one setting lights the lamp, and it isn't all-off or all-on.
      if (sols.length !== 1) continue;
      const ones = sols[0].filter(Boolean).length;
      if (ones === 0 || ones === 4) continue;
      // Make sure at least one XOR or NOT is involved so it isn't a plain AND chain.
      const n = pub.neg;
      const twists = pub.ops.filter((o) => o !== "AND").length + [n.a, n.b, n.c, n.d, n.g1, n.g2, n.out].filter(Boolean).length;
      if (twists < 2) continue;
      return { pub, key: { solution: sols[0] } };
    }
  },
  grade(pub, _key, r) {
    if (!r?.bits || r.bits.length !== 4) return { fraction: 0 };
    return { fraction: evalCircuit(pub, r.bits).out ? 1 : 0 };
  },
  describeKey: (_p, k) => k.solution.map((b, i) => `${"ABCD"[i]} ${b ? "on" : "off"}`).join(", "),
};

/* ---------------------------------------------------------------- paths */

export type PathsPub = { rows: number; cols: number; blocked: [number, number][] };

export function countPaths(p: PathsPub): number {
  const blocked = new Set(p.blocked.map(([r, c]) => `${r},${c}`));
  const ways: number[][] = Array.from({ length: p.rows }, () => Array(p.cols).fill(0));
  for (let r = 0; r < p.rows; r++)
    for (let c = 0; c < p.cols; c++) {
      if (blocked.has(`${r},${c}`)) continue;
      if (r === 0 && c === 0) ways[r][c] = 1;
      else ways[r][c] = (r > 0 ? ways[r - 1][c] : 0) + (c > 0 ? ways[r][c - 1] : 0);
    }
  return ways[p.rows - 1][p.cols - 1];
}

export const paths: WidgetModule<object, PathsPub, { answer: number }, { value: string }> = {
  generate(rng) {
    for (;;) {
      const rows = 5;
      const cols = 6;
      const n = rng.int(3, 5);
      const blocked: [number, number][] = [];
      const seen = new Set<string>();
      while (blocked.length < n) {
        const r = rng.int(0, rows - 1);
        const c = rng.int(0, cols - 1);
        const k = `${r},${c}`;
        if ((r === 0 && c === 0) || (r === rows - 1 && c === cols - 1) || seen.has(k)) continue;
        seen.add(k);
        blocked.push([r, c]);
      }
      const pub = { rows, cols, blocked };
      const answer = countPaths(pub);
      if (answer >= 12 && answer <= 90) return { pub, key: { answer } };
    }
  },
  grade(_p, key, r) {
    return { fraction: r && Number(normalizeText(String(r.value ?? ""))) === key.answer ? 1 : 0 };
  },
  describeKey: (_p, k) => String(k.answer),
};
