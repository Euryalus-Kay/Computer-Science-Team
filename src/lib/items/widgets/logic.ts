import type { Rng } from "../rng";
import type { WidgetModule } from "../types";
import { normalizeText } from "../generic";
import { normalizeListAnswer, range } from "@/lib/tock";

/* --------------------------------------------------------------- liars */

type Claim =
  | { kind: "honest"; j: number }
  | { kind: "liar"; j: number }
  | { kind: "both"; j: number; k: number }
  | { kind: "oneOf"; j: number; k: number };

function claimTrue(c: Claim, liar: number) {
  switch (c.kind) {
    case "honest":
      return c.j !== liar;
    case "liar":
      return c.j === liar;
    case "both":
      return c.j !== liar && c.k !== liar;
    case "oneOf":
      return c.j === liar || c.k === liar;
  }
}

export function consistentLiars(claims: Claim[]): number[] {
  const out: number[] = [];
  for (let L = 0; L < claims.length; L++) if (claims.every((c, s) => claimTrue(c, L) === (s !== L))) out.push(L);
  return out;
}

function claimText(c: Claim, names: string[]) {
  const n = (i: number) => `\`${names[i]}\``;
  switch (c.kind) {
    case "honest":
      return `${n(c.j)} is honest.`;
    case "liar":
      return `${n(c.j)} is the compromised one.`;
    case "both":
      return `${n(c.j)} and ${n(c.k)} are both honest.`;
    case "oneOf":
      return `The compromised one is ${n(c.j)} or ${n(c.k)}.`;
  }
}

const NODE_NAMES = ["atlas", "bolt", "cinder", "delta", "echo", "flint", "gale", "halo", "ion", "jade"];

type LiarsPub = { names: string[]; claims: string[] };
export const liars: WidgetModule<object, LiarsPub, { liar: number }, { choice: number }> = {
  generate(rng) {
    const names = rng.shuffle(NODE_NAMES).slice(0, 4);
    for (;;) {
      const claims: Claim[] = [0, 1, 2, 3].map((s) => {
        const others = [0, 1, 2, 3].filter((x) => x !== s);
        const [j, k] = rng.shuffle(others);
        const kind = rng.pick(["honest", "liar", "both", "oneOf", "liar", "both"] as Claim["kind"][]);
        return kind === "both" || kind === "oneOf" ? { kind, j, k } : { kind, j };
      });
      const sols = consistentLiars(claims);
      if (sols.length !== 1) continue;
      // Require some reasoning: at least two compound claims.
      if (claims.filter((c) => c.kind === "both" || c.kind === "oneOf").length < 2) continue;
      return { pub: { names, claims: claims.map((c) => claimText(c, names)) }, key: { liar: sols[0] } };
    }
  },
  grade: (_p, key, r) => ({ fraction: r?.choice === key.liar ? 1 : 0 }),
  describeKey: (p, k) => p.names[k.liar],
};

/* ---------------------------------------------------------- logic grid */

type Sol = { lang: number[]; locker: number[] }; // indexed by person
type GridClue =
  | { t: "notLang"; p: number; l: number }
  | { t: "langLocker"; l: number; k: number }
  | { t: "higher"; l: number; p: number }
  | { t: "adjacent"; p: number; q: number }
  | { t: "notLocker"; p: number; k: number }
  | { t: "lowest"; l: number }
  | { t: "neither"; p: number; q: number; l: number }
  | { t: "direct"; p: number; l: number };

function perms(n: number): number[][] {
  if (n === 1) return [[0]];
  const out: number[][] = [];
  for (const p of perms(n - 1)) for (let i = 0; i <= p.length; i++) out.push([...p.slice(0, i), n - 1, ...p.slice(i)]);
  return out;
}
const P4 = perms(4);

function holds(c: GridClue, s: Sol): boolean {
  const who = (l: number) => s.lang.indexOf(l);
  switch (c.t) {
    case "notLang":
      return s.lang[c.p] !== c.l;
    case "langLocker":
      return s.locker[who(c.l)] === c.k;
    case "higher":
      return who(c.l) !== c.p && s.locker[who(c.l)] > s.locker[c.p];
    case "adjacent":
      return Math.abs(s.locker[c.p] - s.locker[c.q]) === 1;
    case "notLocker":
      return s.locker[c.p] !== c.k;
    case "lowest":
      return s.locker[who(c.l)] === 0;
    case "neither":
      return s.lang[c.p] !== c.l && s.lang[c.q] !== c.l;
    case "direct":
      return s.lang[c.p] === c.l;
  }
}

function solutionsFor(clues: GridClue[]): number {
  let n = 0;
  for (const lang of P4) {
    for (const locker of P4) {
      const s = { lang, locker };
      if (clues.every((c) => holds(c, s))) {
        n++;
        if (n > 1) return n;
      }
    }
  }
  return n;
}

function randomClue(rng: Rng): GridClue {
  const p = rng.int(0, 3);
  let q = rng.int(0, 3);
  while (q === p) q = rng.int(0, 3);
  const l = rng.int(0, 3);
  const k = rng.int(0, 3);
  return rng.pick<GridClue>([
    { t: "notLang", p, l },
    { t: "langLocker", l, k },
    { t: "higher", l, p },
    { t: "adjacent", p, q },
    { t: "notLocker", p, k },
    { t: "lowest", l },
    { t: "neither", p, q, l },
    { t: "higher", l, p },
    { t: "adjacent", p, q },
  ]);
}

function gridClueText(c: GridClue, people: string[], langs: string[], lockers: number[]) {
  switch (c.t) {
    case "notLang":
      return `${people[c.p]} does not use ${langs[c.l]}.`;
    case "langLocker":
      return `The ${langs[c.l]} user has locker ${lockers[c.k]}.`;
    case "higher":
      return `The ${langs[c.l]} user's locker number is higher than ${people[c.p]}'s.`;
    case "adjacent":
      return `${people[c.p]} and ${people[c.q]} have neighboring lockers (no locker between them).`;
    case "notLocker":
      return `${people[c.p]} does not have locker ${lockers[c.k]}.`;
    case "lowest":
      return `The ${langs[c.l]} user has the lowest locker number.`;
    case "neither":
      return `Neither ${people[c.p]} nor ${people[c.q]} uses ${langs[c.l]}.`;
    case "direct":
      return `${people[c.p]} uses ${langs[c.l]}.`;
  }
}

type GridPub = { people: string[]; langs: string[]; lockers: number[]; clues: string[] };
type GridResponse = { lang: number[]; locker: number[] };
export const logicGrid: WidgetModule<object, GridPub, Sol, GridResponse> = {
  generate(rng) {
    const people = rng.shuffle(["Ava", "Ben", "Cyrus", "Dina", "Eli", "Faye", "Gus", "Hana"]).slice(0, 4);
    const langs = rng.shuffle(["Python", "Java", "C++", "Rust", "Go", "Kotlin"]).slice(0, 4);
    const lockerSet = new Set<number>();
    while (lockerSet.size < 4) lockerSet.add(rng.int(10, 48));
    const lockers = [...lockerSet].sort((a, b) => a - b);
    for (;;) {
      const sol: Sol = { lang: rng.pick(P4), locker: rng.pick(P4) };
      const clues: GridClue[] = [];
      let count = 576;
      let guard = 0;
      while (count > 1 && guard++ < 500) {
        const c = randomClue(rng);
        if (!holds(c, sol)) continue;
        const n = countAll([...clues, c]);
        if (n < count) {
          clues.push(c);
          count = n;
        }
      }
      if (solutionsFor(clues) !== 1) continue;
      // Drop clues that are not needed.
      for (let i = clues.length - 1; i >= 0; i--) {
        const without = clues.filter((_, j) => j !== i);
        if (solutionsFor(without) === 1) clues.splice(i, 1);
      }
      if (clues.length < 4 || clues.length > 8) continue;
      return {
        pub: { people, langs, lockers, clues: rng.shuffle(clues).map((c) => gridClueText(c, people, langs, lockers)) },
        key: sol,
      };
    }
  },
  grade(_p, key, r) {
    if (!r) return { fraction: 0 };
    let right = 0;
    for (let i = 0; i < 4; i++) {
      if (r.lang?.[i] === key.lang[i]) right++;
      if (r.locker?.[i] === key.locker[i]) right++;
    }
    return { fraction: right / 8 };
  },
  describeKey: (p, k) => p.people.map((name, i) => `${name}: ${p.langs[k.lang[i]]}, ${p.lockers[k.locker[i]]}`).join("; "),
};

function countAll(clues: GridClue[]): number {
  let n = 0;
  for (const lang of P4) for (const locker of P4) if (clues.every((c) => holds(c, { lang, locker }))) n++;
  return n;
}

/* --------------------------------------------------------------- stride */

type StridePub = { examples: { args: [number, number, number]; out: number[] }[]; ask: [number, number, number] };
export const stride: WidgetModule<object, StridePub, { answer: number[] }, { text: string }> = {
  generate(rng) {
    const a1 = rng.int(1, 5);
    const s1 = rng.int(2, 4);
    const b1 = a1 + s1 * rng.int(3, 4);
    let a2: number, b2: number, s2: number;
    do {
      a2 = rng.int(12, 19);
      s2 = rng.int(3, 5);
      b2 = rng.int(1, 3);
    } while ((a2 - b2) % s2 === 0);
    const x = rng.int(2, 9);
    const s3 = rng.int(3, 6);
    let a: number, b: number, s: number;
    do {
      a = rng.int(23, 41);
      b = rng.int(0, 4);
      s = rng.int(4, 7);
    } while ((a - b) % s === 0);
    return {
      pub: {
        examples: [
          { args: [a1, b1, s1], out: range(a1, b1, s1) },
          { args: [a2, b2, s2], out: range(a2, b2, s2) },
          { args: [x, x + 1, s3], out: range(x, x + 1, s3) },
        ],
        ask: [a, b, s],
      },
      key: { answer: range(a, b, s) },
    };
  },
  grade(_p, key, r) {
    if (!r?.text) return { fraction: 0 };
    return { fraction: normalizeListAnswer(r.text) === key.answer.join(" ") ? 1 : 0 };
  },
  describeKey: (_p, k) => k.answer.join(" "),
};

/* --------------------------------------------------------------- cipher */

export function shiftByPosition(word: string, dir = 1): string {
  return word
    .toUpperCase()
    .split("")
    .map((ch, i) => {
      const c = ch.charCodeAt(0) - 65;
      if (c < 0 || c > 25) return ch;
      return String.fromCharCode(65 + ((((c + dir * (i + 1)) % 26) + 26) % 26));
    })
    .join("");
}

const SHORT_WORDS = ["CAT", "DOG", "SUN", "MAP", "KEY", "BOX", "ICE", "OWL", "FOX", "JAR"];
const LONG_WORDS = ["PUZZLE", "SIGNAL", "ORBIT", "VECTOR", "BINARY", "CASTLE", "MATRIX", "RIDDLE", "PLANET", "GALAXY", "TUNNEL", "SPIRAL"];

type CipherPub = { examples: { plain: string; code: string }[]; code: string };
export const cipher: WidgetModule<object, CipherPub, { answer: string }, { text: string }> = {
  generate(rng) {
    const [e1, e2, e3] = rng.shuffle(SHORT_WORDS);
    const word = rng.pick(LONG_WORDS);
    return {
      pub: {
        examples: [e1, e2, e3].map((w) => ({ plain: w, code: shiftByPosition(w) })),
        code: shiftByPosition(word),
      },
      key: { answer: word },
    };
  },
  grade: (_p, key, r) => ({ fraction: r?.text && normalizeText(r.text).toUpperCase() === key.answer ? 1 : 0 }),
  describeKey: (_p, k) => k.answer,
};
