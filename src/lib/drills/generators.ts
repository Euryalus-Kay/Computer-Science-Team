/** Question generators for the drills. Pure functions, used in the browser. */

export type Drill = {
  /** Text with `code` spans in backticks. */
  prompt: string;
  /** Shown as a code block under the prompt, when there is one. */
  code?: string;
  answer: string;
  /** What the answer box asks for, e.g. "5 bits". */
  hint: string;
  steps: string[];
  check: (input: string) => boolean;
};

export type Topic = { id: string; title: string; blurb: string; make: (r: () => number) => Drill };

const int = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const pick = <T,>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
const squash = (s: string) => s.trim().replace(/\s+/g, "").toUpperCase();

/* ----------------------------------------------------------- number systems */

const BASES = [
  [2, "binary", "₂"],
  [8, "octal", "₈"],
  [16, "hexadecimal", "₁₆"],
] as const;

function stripZeros(s: string) {
  const t = squash(s).replace(/^0+(?=.)/, "");
  return t;
}

function numbers(r: () => number): Drill {
  const kind = int(r, 0, 3);
  if (kind === 3) {
    // Addition in base 8 or 16.
    const [base, name, sub] = pick(r, BASES.slice(1));
    const a = int(r, 20, 200);
    const b = int(r, 20, 200);
    const ans = (a + b).toString(base).toUpperCase();
    return {
      prompt: `Add these ${name} numbers. Give the answer in ${name}.`,
      code: `${a.toString(base).toUpperCase()}${sub} + ${b.toString(base).toUpperCase()}${sub}`,
      answer: ans,
      hint: `in base ${base}`,
      steps: [
        `${a.toString(base).toUpperCase()}${sub} = ${a} and ${b.toString(base).toUpperCase()}${sub} = ${b}`,
        `${a} + ${b} = ${a + b}`,
        `${a + b} = ${ans}${sub}`,
      ],
      check: (s) => stripZeros(s) === ans,
    };
  }
  const n = int(r, 20, 255);
  if (kind === 0) {
    const [base, name, sub] = pick(r, BASES);
    const ans = n.toString(base).toUpperCase();
    const steps: string[] = [];
    let x = n;
    while (x > 0) {
      steps.push(`${x} ÷ ${base} = ${Math.floor(x / base)} remainder ${(x % base).toString(base).toUpperCase()}`);
      x = Math.floor(x / base);
    }
    steps.push(`Read the remainders from the bottom up: ${ans}${sub}`);
    return { prompt: `Convert ${n} to ${name}.`, answer: ans, hint: `in base ${base}`, steps, check: (s) => stripZeros(s) === ans };
  }
  if (kind === 1) {
    const [base, name, sub] = pick(r, BASES);
    const digits = n.toString(base).toUpperCase();
    const parts = [...digits].map((d, i) => `${d}×${base}^${digits.length - 1 - i}`);
    return {
      prompt: `Convert this ${name} number to decimal.`,
      code: `${digits}${sub}`,
      answer: String(n),
      hint: "in base 10",
      steps: [parts.join(" + "), `= ${n}`],
      check: (s) => stripZeros(s) === String(n),
    };
  }
  // Between binary and octal or hex by grouping bits.
  const toBinary = r() < 0.5;
  const [base, name, sub] = pick(r, BASES.slice(1));
  const group = base === 8 ? 3 : 4;
  const bin = n.toString(2);
  const other = n.toString(base).toUpperCase();
  const padded = bin.padStart(Math.ceil(bin.length / group) * group, "0");
  const groups = padded.match(new RegExp(`.{${group}}`, "g"))!;
  if (toBinary) {
    return {
      prompt: `Convert this ${name} number to binary.`,
      code: `${other}${sub}`,
      answer: bin,
      hint: "in base 2",
      steps: [`Each ${name} digit is ${group} bits: ${[...other].map((d) => `${d} = ${parseInt(d, base).toString(2).padStart(group, "0")}`).join(", ")}`, `${groups.join(" ")} = ${bin}₂`],
      check: (s) => stripZeros(s) === bin,
    };
  }
  return {
    prompt: `Convert this binary number to ${name}.`,
    code: `${bin}₂`,
    answer: other,
    hint: `in base ${base}`,
    steps: [`Group bits in ${group}s from the right: ${groups.join(" ")}`, `${groups.map((g) => parseInt(g, 2).toString(base).toUpperCase()).join(" ")} = ${other}${sub}`],
    check: (s) => stripZeros(s) === other,
  };
}

/* -------------------------------------------------------------- bit strings */

const W = 5;
const bits = (n: number) => (n >>> 0).toString(2).padStart(W, "0").slice(-W);
const mask = (1 << W) - 1;
const randBits = (r: () => number) => int(r, 1, mask - 1);

type Unary = { name: string; k?: number; f: (x: number) => number };
function unaryOps(r: () => number): Unary {
  const k = int(r, 1, 3);
  return pick(r, [
    { name: "NOT", f: (x: number) => ~x & mask },
    { name: `LSHIFT-${k}`, k, f: (x: number) => (x << k) & mask },
    { name: `RSHIFT-${k}`, k, f: (x: number) => x >>> k },
    { name: `LCIRC-${k}`, k, f: (x: number) => ((x << k) | (x >>> (W - k))) & mask },
    { name: `RCIRC-${k}`, k, f: (x: number) => ((x >>> k) | (x << (W - k))) & mask },
  ]);
}
const BIN: Record<string, (a: number, b: number) => number> = {
  AND: (a, b) => a & b,
  OR: (a, b) => a | b,
  XOR: (a, b) => a ^ b,
};

function bitstrings(r: () => number): Drill {
  const kind = int(r, 0, 2);
  const x = randBits(r);
  const y = randBits(r);
  if (kind === 0) {
    const u = unaryOps(r);
    const ans = bits(u.f(x));
    return { prompt: "Evaluate.", code: `${u.name} ${bits(x)}`, answer: ans, hint: "5 bits", steps: [`${u.name} ${bits(x)} = ${ans}`], check: (s) => squash(s) === ans };
  }
  if (kind === 1) {
    // A unary operator binds tighter than AND, XOR and OR.
    const u = unaryOps(r);
    const op = pick(r, Object.keys(BIN));
    const first = u.f(x);
    const ans = bits(BIN[op](first, y));
    return {
      prompt: "Evaluate.",
      code: `${u.name} ${bits(x)} ${op} ${bits(y)}`,
      answer: ans,
      hint: "5 bits",
      steps: [`${u.name} goes first: ${u.name} ${bits(x)} = ${bits(first)}`, `${bits(first)} ${op} ${bits(y)} = ${ans}`],
      check: (s) => squash(s) === ans,
    };
  }
  // Two binary operators: AND before XOR before OR.
  const z = randBits(r);
  const [o1, o2] = [pick(r, Object.keys(BIN)), pick(r, Object.keys(BIN))];
  const rank: Record<string, number> = { AND: 0, XOR: 1, OR: 2 };
  let steps: string[];
  let v: number;
  if (rank[o2] < rank[o1]) {
    const right = BIN[o2](y, z);
    v = BIN[o1](x, right);
    steps = [`${o2} goes first: ${bits(y)} ${o2} ${bits(z)} = ${bits(right)}`, `${bits(x)} ${o1} ${bits(right)} = ${bits(v)}`];
  } else {
    const left = BIN[o1](x, y);
    v = BIN[o2](left, z);
    steps = [`${o1} goes first${o1 === o2 ? " (left to right)" : ""}: ${bits(x)} ${o1} ${bits(y)} = ${bits(left)}`, `${bits(left)} ${o2} ${bits(z)} = ${bits(v)}`];
  }
  const ans = bits(v);
  return { prompt: "Evaluate. AND comes before XOR, and XOR before OR.", code: `${bits(x)} ${o1} ${bits(y)} ${o2} ${bits(z)}`, answer: ans, hint: "5 bits", steps, check: (s) => squash(s) === ans };
}

/* -------------------------------------------------------- prefix and postfix */

type Node = number | { op: "+" | "-" | "*"; l: Node; r: Node };
function tree(r: () => number, depth: number): Node {
  if (depth === 0 || (depth < 3 && r() < 0.3)) return int(r, 1, 9);
  return { op: pick(r, ["+", "-", "*"] as const), l: tree(r, depth - 1), r: tree(r, depth - 1) };
}
const evalNode = (n: Node): number => (typeof n === "number" ? n : n.op === "+" ? evalNode(n.l) + evalNode(n.r) : n.op === "-" ? evalNode(n.l) - evalNode(n.r) : evalNode(n.l) * evalNode(n.r));
const prefix = (n: Node): string => (typeof n === "number" ? String(n) : `${n.op} ${prefix(n.l)} ${prefix(n.r)}`);
const postfix = (n: Node): string => (typeof n === "number" ? String(n) : `${postfix(n.l)} ${postfix(n.r)} ${n.op}`);
const infix = (n: Node, top = true): string => (typeof n === "number" ? String(n) : `${top ? "" : "("}${infix(n.l, false)} ${n.op} ${infix(n.r, false)}${top ? "" : ")"}`);

function notation(r: () => number): Drill {
  let t: Node;
  do t = tree(r, 3);
  while (typeof t === "number" || Math.abs(evalNode(t)) > 400);
  const post = r() < 0.5;
  const ans = String(evalNode(t));
  return {
    prompt: `Evaluate this ${post ? "postfix" : "prefix"} expression.`,
    code: post ? postfix(t) : prefix(t),
    answer: ans,
    hint: "a whole number",
    steps: [`As infix: ${infix(t)}`, `= ${ans}`],
    check: (s) => s.trim().replace(/\s+/g, "") === ans,
  };
}

/* ------------------------------------------------------------ boolean algebra */

type B = { s: string; f: (v: Record<string, number>) => number; atom: boolean };
function bexpr(r: () => number, depth: number): B {
  if (depth === 0 || r() < 0.25) {
    const v = pick(r, ["A", "B", "C"]);
    return { s: v, f: (x) => x[v], atom: true };
  }
  if (r() < 0.2) {
    const e = bexpr(r, depth - 1);
    return { s: `NOT ${e.atom ? e.s : `(${e.s})`}`, f: (x) => 1 - e.f(x), atom: true };
  }
  const op = pick(r, ["AND", "OR", "XOR"] as const);
  const a = bexpr(r, depth - 1);
  const b = bexpr(r, depth - 1);
  const wrap = (e: B) => (e.atom ? e.s : `(${e.s})`);
  return {
    s: `${wrap(a)} ${op} ${wrap(b)}`,
    f: (x) => (op === "AND" ? a.f(x) & b.f(x) : op === "OR" ? a.f(x) | b.f(x) : a.f(x) ^ b.f(x)),
    atom: false,
  };
}

function boolean(r: () => number): Drill {
  let e: B;
  do e = bexpr(r, 3);
  while (e.atom || e.s.length < 14);
  const rows: Record<string, number>[] = [];
  for (let i = 0; i < 8; i++) rows.push({ A: (i >> 2) & 1, B: (i >> 1) & 1, C: i & 1 });
  if (r() < 0.5) {
    const v = pick(r, rows);
    const ans = String(e.f(v));
    return {
      prompt: `Find the value when A = ${v.A}, B = ${v.B}, C = ${v.C}.`,
      code: e.s,
      answer: ans,
      hint: "0 or 1",
      steps: [`Substitute: ${e.s.replace(/\b[ABC]\b/g, (k) => String(v[k]))}`, `= ${ans}`],
      check: (s) => s.trim() === ans,
    };
  }
  const n = rows.filter((x) => e.f(x)).length;
  return {
    prompt: "How many of the 8 rows of the truth table make this true?",
    code: e.s,
    answer: String(n),
    hint: "0 to 8",
    steps: [`True for: ${rows.filter((x) => e.f(x)).map((x) => `${x.A}${x.B}${x.C}`).join(", ") || "none"} (ABC)`, `${n} rows`],
    check: (s) => s.trim() === String(n),
  };
}

/* --------------------------------------------------------------- recursion */

function recursion(r: () => number): Drill {
  const kind = int(r, 0, 1);
  if (kind === 0) {
    const a = int(r, 2, 4);
    const b = int(r, 1, 5);
    const c = int(r, 1, 4);
    const base = int(r, 1, 3);
    const n = c + a * int(r, 2, 5) + int(r, 0, a - 1);
    const f = (x: number): number => (x > c ? f(x - a) + b : x + base);
    const chain: string[] = [];
    let x = n;
    while (x > c) {
      chain.push(`f(${x}) = f(${x - a}) + ${b}`);
      x -= a;
    }
    chain.push(`f(${x}) = ${x} + ${base} = ${x + base}`);
    const ans = String(f(n));
    return {
      prompt: `Find f(${n}).`,
      code: `f(x) = f(x - ${a}) + ${b}   when x > ${c}\nf(x) = x + ${base}          otherwise`,
      answer: ans,
      hint: "a whole number",
      steps: [...chain, `Add back up: f(${n}) = ${ans}`],
      check: (s) => s.trim() === ans,
    };
  }
  const m = int(r, 2, 3);
  const n = int(r, 5, 8);
  const memo = new Map<number, number>();
  const f = (x: number): number => {
    if (x <= 1) return 1;
    if (memo.has(x)) return memo.get(x)!;
    const v = f(x - 1) + m * f(x - 2);
    memo.set(x, v);
    return v;
  };
  const ans = String(f(n));
  const table = Array.from({ length: n + 1 }, (_, i) => `f(${i}) = ${f(i)}`);
  return {
    prompt: `Find f(${n}).`,
    code: `f(x) = f(x - 1) + ${m} × f(x - 2)   when x > 1\nf(x) = 1                        otherwise`,
    answer: ans,
    hint: "a whole number",
    steps: ["Build up from the bottom:", table.join(", ")],
    check: (s) => s.trim().replace(/,/g, "") === ans,
  };
}

export const TOPICS: Topic[] = [
  { id: "numbers", title: "Number systems", blurb: "Binary, octal and hex", make: numbers },
  { id: "bits", title: "Bit strings", blurb: "Shifts, circulates and logic", make: bitstrings },
  { id: "notation", title: "Prefix and postfix", blurb: "Evaluate expressions", make: notation },
  { id: "boolean", title: "Boolean algebra", blurb: "Values and truth tables", make: boolean },
  { id: "recursion", title: "Recursive functions", blurb: "Trace the calls", make: recursion },
];

export const TOPIC_BY_ID = new Map(TOPICS.map((t) => [t.id, t]));
