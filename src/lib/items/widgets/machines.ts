import type { Rng } from "../rng";
import type { WidgetModule } from "../types";

/* ---------------------------------------------------------------- robot */

export type Dir = 0 | 1 | 2 | 3; // N E S W
export type Block = { op: "F" | "L" | "R" } | { op: "repeat"; n: number; body: Block[] };
export type RobotWorld = { w: number; h: number; walls: [number, number][]; start: { x: number; y: number; dir: Dir } };
export type RobotPos = { x: number; y: number; dir: Dir };

const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

export function flatten(program: Block[], limit = 400): ("F" | "L" | "R")[] {
  const out: ("F" | "L" | "R")[] = [];
  const walk = (bs: Block[]) => {
    for (const b of bs) {
      if (out.length >= limit) return;
      if (b.op === "repeat") for (let i = 0; i < Math.min(20, Math.max(0, b.n)); i++) walk(b.body);
      else out.push(b.op);
    }
  };
  walk(program);
  return out;
}

export function blockCount(program: Block[]): number {
  return program.reduce((n, b) => n + (b.op === "repeat" ? 1 + blockCount(b.body) : 1), 0);
}

/** Every position the robot occupies, starting with the start. */
export function simulate(world: RobotWorld, program: Block[]): RobotPos[] {
  const walls = new Set(world.walls.map(([x, y]) => `${x},${y}`));
  let p: RobotPos = { ...world.start };
  const path: RobotPos[] = [p];
  for (const op of flatten(program)) {
    if (op === "L") p = { ...p, dir: ((p.dir + 3) % 4) as Dir };
    else if (op === "R") p = { ...p, dir: ((p.dir + 1) % 4) as Dir };
    else {
      const nx = p.x + DX[p.dir];
      const ny = p.y + DY[p.dir];
      if (nx >= 0 && ny >= 0 && nx < world.w && ny < world.h && !walls.has(`${nx},${ny}`)) p = { ...p, x: nx, y: ny };
    }
    path.push(p);
  }
  return path;
}

function randomOps(rng: Rng, n: number): Block[] {
  return Array.from({ length: n }, () => ({ op: rng.pick(["F", "F", "F", "L", "R"] as const) }));
}

type TracePub = RobotWorld & { program: Block[] };
export const robotTrace: WidgetModule<object, TracePub, { x: number; y: number }, { cell: [number, number] }> = {
  generate(rng) {
    for (;;) {
      const w = 7;
      const h = 7;
      const start = { x: rng.int(1, 5), y: rng.int(1, 5), dir: rng.int(0, 3) as Dir };
      const walls: [number, number][] = [];
      const taken = new Set([`${start.x},${start.y}`]);
      while (walls.length < 6) {
        const x = rng.int(0, 6);
        const y = rng.int(0, 6);
        if (taken.has(`${x},${y}`)) continue;
        taken.add(`${x},${y}`);
        walls.push([x, y]);
      }
      const inner = [...randomOps(rng, rng.int(2, 3)), { op: rng.pick(["L", "R"] as const) }] as Block[];
      const program: Block[] = [...randomOps(rng, rng.int(0, 2)), { op: "repeat", n: rng.int(2, 4), body: inner }, ...randomOps(rng, rng.int(1, 3))];
      const world = { w, h, walls, start };
      const path = simulate(world, program);
      const end = path[path.length - 1];
      const moves = new Set(path.map((p) => `${p.x},${p.y}`)).size;
      // A wall bump makes it interesting: at least one F that didn't move.
      let bumps = 0;
      const ops = flatten(program);
      for (let i = 0; i < ops.length; i++) if (ops[i] === "F" && path[i].x === path[i + 1].x && path[i].y === path[i + 1].y) bumps++;
      if (moves < 5 || bumps < 1 || bumps > 3 || (end.x === start.x && end.y === start.y)) continue;
      return { pub: { ...world, program }, key: { x: end.x, y: end.y } };
    }
  },
  grade: (_p, key, r) => ({ fraction: r?.cell && r.cell[0] === key.x && r.cell[1] === key.y ? 1 : 0 }),
  describeKey: (_p, k) => `column ${k.x + 1}, row ${k.y + 1}`,
};

export type BuildLevel = RobotWorld & { goal: [number, number]; limit: number };

export const BUILD_LEVELS: BuildLevel[] = [
  {
    // staircase up and to the right
    w: 6,
    h: 6,
    start: { x: 0, y: 5, dir: 1 },
    goal: [5, 0],
    limit: 6,
    walls: [
      [2, 5],
      [3, 4],
      [4, 3],
      [5, 2],
      [0, 3],
      [1, 2],
      [2, 1],
      [3, 0],
    ],
  },
  {
    // two-wide steps
    w: 7,
    h: 7,
    start: { x: 0, y: 6, dir: 0 },
    goal: [6, 0],
    limit: 7,
    walls: [
      [0, 3],
      [1, 3],
      [3, 4],
      [3, 5],
      [1, 1],
      [5, 2],
      [5, 3],
      [3, 0],
      [1, 6],
    ],
  },
  {
    // around the block: a ring corridor, solvable with nested repeats
    w: 7,
    h: 6,
    start: { x: 0, y: 0, dir: 1 },
    goal: [0, 5],
    limit: 5,
    walls: [[1, 1], [1, 2], [1, 3], [1, 4], [2, 1], [2, 2], [2, 3], [2, 4], [3, 1], [3, 2], [3, 3], [3, 4], [4, 1], [4, 2], [4, 3], [4, 4], [5, 1], [5, 2], [5, 3], [5, 4], [0, 1]] as [number, number][],
  },
];

type BuildPub = BuildLevel;
export const robotBuild: WidgetModule<{ level?: number }, BuildPub, object, { program: Block[] }> = {
  generate(rng, c) {
    const level = BUILD_LEVELS[c.level ?? rng.int(0, BUILD_LEVELS.length - 1)];
    return { pub: level, key: {}, vars: { limit: level.limit } };
  },
  grade(pub, _k, r) {
    if (!r?.program) return { fraction: 0 };
    const path = simulate(pub, r.program);
    const end = path[path.length - 1];
    const reached = end.x === pub.goal[0] && end.y === pub.goal[1];
    if (!reached) return { fraction: 0 };
    return { fraction: blockCount(r.program) <= pub.limit ? 1 : 0.5 };
  },
};

/* ----------------------------------------------------------------- rail */

export type RailMove = "in" | "out" | "pass";
export type RailState = { input: number[]; siding: number[]; output: number[]; error: string | null };

export function railStep(s: RailState, m: RailMove): RailState {
  if (s.error) return s;
  const input = [...s.input];
  const siding = [...s.siding];
  const output = [...s.output];
  if (m === "in") {
    if (!input.length) return { ...s, error: "No car left on the incoming track" };
    siding.push(input.shift()!);
  } else if (m === "pass") {
    if (!input.length) return { ...s, error: "No car left on the incoming track" };
    output.push(input.shift()!);
  } else {
    if (!siding.length) return { ...s, error: "The siding is empty" };
    output.push(siding.pop()!);
  }
  return { input, siding, output, error: null };
}

export function railReplay(cars: number[], moves: RailMove[]): RailState {
  let s: RailState = { input: [...cars], siding: [], output: [], error: null };
  for (const m of moves.slice(0, 200)) s = railStep(s, m);
  return s;
}

function stackSortable(p: number[]): { ok: boolean; depth: number } {
  const st: number[] = [];
  let want = 1;
  let depth = 0;
  for (const x of p) {
    st.push(x);
    depth = Math.max(depth, st.length);
    while (st.length && st[st.length - 1] === want) {
      st.pop();
      want++;
    }
  }
  return { ok: st.length === 0, depth };
}

export const rail: WidgetModule<{ cars?: number }, { cars: number[] }, object, { moves: RailMove[] }> = {
  generate(rng, c) {
    const n = c.cars ?? 6;
    for (;;) {
      const cars = rng.shuffle(Array.from({ length: n }, (_, i) => i + 1));
      const s = stackSortable(cars);
      if (s.ok && s.depth >= 3 && cars[0] !== 1) return { pub: { cars }, key: {} };
    }
  },
  grade(pub, _k, r) {
    const s = railReplay(pub.cars, r?.moves ?? []);
    const n = pub.cars.length;
    if (s.output.length === n && s.output.every((x, i) => x === i + 1)) return { fraction: 1 };
    let prefix = 0;
    while (prefix < s.output.length && s.output[prefix] === prefix + 1) prefix++;
    return { fraction: Math.round((prefix / n) * 0.5 * 100) / 100 };
  },
};

/* ---------------------------------------------------------------- scale */

export type Weighing = { left: number[]; right: number[] };
export type Tilt = "balance" | "left-up" | "right-up";

/**
 * The fake coin is not chosen in advance. Each weighing answers so that as many
 * coins as possible stay suspicious, so only a strategy that always works can win.
 */
export function weigh(candidates: number[], w: Weighing): { tilt: Tilt; candidates: number[] } {
  const L = candidates.filter((c) => w.left.includes(c));
  const R = candidates.filter((c) => w.right.includes(c));
  const O = candidates.filter((c) => !w.left.includes(c) && !w.right.includes(c));
  const options: [Tilt, number[]][] = [
    ["balance", O],
    ["left-up", L],
    ["right-up", R],
  ];
  options.sort((a, b) => b[1].length - a[1].length);
  return { tilt: options[0][0], candidates: options[0][1] };
}

export function validWeighing(w: Weighing, coins: number): string | null {
  const all = [...w.left, ...w.right];
  if (!w.left.length || !w.right.length) return "Put coins on both pans";
  if (w.left.length !== w.right.length) return "Both pans need the same number of coins";
  if (new Set(all).size !== all.length) return "A coin can only be on one pan";
  if (all.some((c) => c < 1 || c > coins)) return "Unknown coin";
  return null;
}

export function scaleReplay(coins: number, weighings: Weighing[], max: number) {
  let candidates = Array.from({ length: coins }, (_, i) => i + 1);
  const tilts: Tilt[] = [];
  for (const w of weighings.slice(0, max)) {
    if (validWeighing(w, coins)) break;
    const r = weigh(candidates, w);
    tilts.push(r.tilt);
    candidates = r.candidates;
  }
  return { candidates, tilts };
}

type ScalePub = { coins: number; weighings: number };
export const scale: WidgetModule<{ coins?: number; weighings?: number }, ScalePub, object, { weighings: Weighing[]; pick: number | null }> = {
  generate(_rng, c) {
    const coins = c.coins ?? 9;
    const weighings = c.weighings ?? 2;
    return { pub: { coins, weighings }, key: {}, vars: { coins, weighings } };
  },
  grade(pub, _k, r) {
    if (!r || r.pick == null) return { fraction: 0 };
    const { candidates } = scaleReplay(pub.coins, r.weighings ?? [], pub.weighings);
    if (!candidates.includes(r.pick)) return { fraction: 0 };
    return { fraction: Math.round((1 / candidates.length) * 100) / 100 };
  },
};

/* --------------------------------------------------------------- lights */

export function press(bits: boolean[], size: number, i: number): boolean[] {
  const out = [...bits];
  const r = Math.floor(i / size);
  const c = i % size;
  for (const [dr, dc] of [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const rr = r + dr;
    const cc = c + dc;
    if (rr >= 0 && cc >= 0 && rr < size && cc < size) out[rr * size + cc] = !out[rr * size + cc];
  }
  return out;
}

export function minPresses(start: boolean[], size: number): number {
  const n = size * size;
  let best = Infinity;
  for (let m = 0; m < 1 << n; m++) {
    let b = [...start];
    let k = 0;
    for (let i = 0; i < n; i++)
      if (m & (1 << i)) {
        b = press(b, size, i);
        k++;
      }
    if (b.every((x) => !x)) best = Math.min(best, k);
  }
  return best;
}

type LightsPub = { size: number; start: boolean[]; min: number };
export const lights: WidgetModule<object, LightsPub, object, { presses: number[] }> = {
  generate(rng) {
    const size = 3;
    for (;;) {
      let start = Array(size * size).fill(false) as boolean[];
      const cells = rng.shuffle(Array.from({ length: size * size }, (_, i) => i)).slice(0, rng.int(4, 5));
      for (const c of cells) start = press(start, size, c);
      const min = minPresses(start, size);
      if (min >= 4 && start.some(Boolean)) return { pub: { size, start, min }, key: {}, vars: { min } };
    }
  },
  grade(pub, _k, r) {
    let b = [...pub.start];
    const presses = (r?.presses ?? []).slice(0, 200);
    for (const i of presses) b = press(b, pub.size, i);
    if (!b.every((x) => !x)) return { fraction: 0 };
    return { fraction: presses.length <= pub.min + 2 ? 1 : 0.6 };
  },
};

/* -------------------------------------------------------------- network */

export const NET_NODES: { id: string; x: number; y: number }[] = [
  { id: "A", x: 6, y: 50 },
  { id: "B", x: 27, y: 16 },
  { id: "C", x: 27, y: 84 },
  { id: "D", x: 50, y: 38 },
  { id: "E", x: 50, y: 70 },
  { id: "F", x: 73, y: 14 },
  { id: "G", x: 74, y: 84 },
  { id: "H", x: 94, y: 48 },
];
const NET_EDGES: [string, string][] = [
  ["A", "B"],
  ["A", "C"],
  ["A", "D"],
  ["B", "D"],
  ["B", "F"],
  ["C", "E"],
  ["C", "G"],
  ["D", "E"],
  ["D", "F"],
  ["D", "H"],
  ["E", "G"],
  ["E", "H"],
  ["F", "H"],
  ["G", "H"],
];

export type NetPub = { nodes: typeof NET_NODES; edges: { a: string; b: string; w: number }[]; from: string; to: string };

export function shortest(pub: NetPub): number {
  const dist = new Map(pub.nodes.map((n) => [n.id, Infinity]));
  dist.set(pub.from, 0);
  const done = new Set<string>();
  while (done.size < pub.nodes.length) {
    let u: string | null = null;
    for (const [k, v] of dist) if (!done.has(k) && (u === null || v < dist.get(u)!)) u = k;
    if (u === null) break;
    done.add(u);
    for (const e of pub.edges) {
      const v = e.a === u ? e.b : e.b === u ? e.a : null;
      if (v && dist.get(u)! + e.w < dist.get(v)!) dist.set(v, dist.get(u)! + e.w);
    }
  }
  return dist.get(pub.to)!;
}

export function pathCost(pub: NetPub, path: string[]): number | null {
  if (path[0] !== pub.from || path[path.length - 1] !== pub.to) return null;
  let total = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const e = pub.edges.find((x) => (x.a === path[i] && x.b === path[i + 1]) || (x.b === path[i] && x.a === path[i + 1]));
    if (!e) return null;
    total += e.w;
  }
  return total;
}

function greedyCost(pub: NetPub): number {
  let at = pub.from;
  const seen = new Set([at]);
  let total = 0;
  for (let i = 0; i < 10 && at !== pub.to; i++) {
    const opts = pub.edges
      .filter((e) => (e.a === at && !seen.has(e.b)) || (e.b === at && !seen.has(e.a)))
      .sort((x, y) => x.w - y.w);
    if (!opts.length) return Infinity;
    const e = opts[0];
    at = e.a === at ? e.b : e.a;
    seen.add(at);
    total += e.w;
  }
  return at === pub.to ? total : Infinity;
}

export const network: WidgetModule<object, NetPub, { best: number }, { path: string[] }> = {
  generate(rng) {
    for (;;) {
      const pub: NetPub = {
        nodes: NET_NODES,
        edges: NET_EDGES.map(([a, b]) => ({ a, b, w: rng.int(1, 9) })),
        from: "A",
        to: "H",
      };
      const best = shortest(pub);
      // The cheapest-next-hop route should be a trap.
      if (greedyCost(pub) > best && best >= 8) return { pub, key: { best }, vars: { from: "A", to: "H" } };
    }
  },
  grade(pub, key, r) {
    const cost = r?.path ? pathCost(pub, r.path) : null;
    if (cost === null) return { fraction: 0 };
    if (cost === key.best) return { fraction: 1 };
    return { fraction: cost <= key.best + 2 ? 0.4 : 0 };
  },
  describeKey: (_p, k) => `Total ${k.best}`,
};
