import type { Rng } from "../rng";
import type { WidgetModule } from "../types";
import { normalizeListAnswer, runTock } from "@/lib/tock";

/* ---------------------------------------------------------- tock-trace */

type TraceKind = "range-sum" | "index" | "pipe" | "while" | "fold";

function traceProgram(rng: Rng, kind: TraceKind): string {
  switch (kind) {
    case "range-sum": {
      const a = rng.int(1, 4);
      const s = rng.int(2, 4);
      const b = a + s * rng.int(3, 5) + rng.int(0, s - 1);
      return `total <- 0\nfor v in range(${a}, ${b}, ${s}) do\n  total <- total + v\nend\nsay total`;
    }
    case "index": {
      const xs = rng.shuffle(Array.from({ length: 60 }, (_, i) => i + 11)).slice(0, 6);
      const p = rng.int(2, 5);
      const q = rng.int(1, 3);
      return `xs <- [${xs.join(", ")}]\nsay xs[${p}] + xs[-${q}]`;
    }
    case "pipe": {
      const h = rng.int(14, 21);
      const m = rng.int(3, 4);
      const r = rng.int(0, m - 1);
      return `say range(${h}, 1) |> keep(n -> n % ${m} = ${r}) |> map(n -> n / 2)`;
    }
    case "while": {
      const n = rng.int(37, 90);
      return `n <- ${n}\nc <- 0\nwhile n > 1 do\n  if n % 2 = 0 then\n    n <- n / 2\n  else\n    n <- n - 1\n  end\n  c <- c + 1\nend\nsay c`;
    }
    case "fold": {
      const xs = Array.from({ length: 4 }, () => rng.int(1, 9));
      return `say [${xs.join(", ")}] |> fold(0, (acc, d) -> acc * 2 + d)`;
    }
  }
}

type TracePub = { code: string };
export const tockTrace: WidgetModule<{ kind: TraceKind }, TracePub, { output: string }, { text: string }> = {
  generate(rng, c) {
    const code = traceProgram(rng, c.kind);
    const r = runTock(code);
    if (r.error) throw new Error(`tock-trace generated a broken program: ${r.error.message}`);
    return { pub: { code }, key: { output: r.output.trim() } };
  },
  grade(_p, key, r) {
    if (!r?.text?.trim()) return { fraction: 0 };
    return { fraction: normalizeListAnswer(r.text) === normalizeListAnswer(key.output) ? 1 : 0 };
  },
  describeKey: (_p, k) => k.output,
};

/* -------------------------------------------------------- tock-reverse */

type ReversePub = { code: string; lo: number; hi: number };

function reverseVariant(rng: Rng): ReversePub | null {
  const kind = rng.pick(["divisors", "squares", "digits"] as const);
  let code = "";
  let lo = 10;
  let hi = 40;
  if (kind === "divisors") {
    code = `x <- read\nd <- range(1, x) |> keep(k -> x % k = 0)\nif len(d) = 3 then\n  say "yes"\nelse\n  say "no"\nend`;
    [lo, hi] = rng.pick([
      [10, 40],
      [30, 60],
      [100, 150],
    ]);
  } else if (kind === "squares") {
    const last = rng.pick([1, 4, 6, 9]);
    const want = rng.int(3, 4);
    code = `x <- read\nsq <- range(1, x) |> map(k -> k * k) |> keep(k -> k % 10 = ${last})\nif len(sq) = ${want} then\n  say "yes"\nelse\n  say "no"\nend`;
    lo = 1;
    hi = 40;
  } else {
    const t = rng.int(14, 19);
    const m = rng.pick([3, 4, 6, 7]);
    code = `x <- read\ns <- 0\ny <- x\nwhile y > 0 do\n  s <- s + y % 10\n  y <- y / 10\nend\nif s = ${t} and x % ${m} = 0 then\n  say "yes"\nelse\n  say "no"\nend`;
    lo = 100;
    hi = 199;
  }
  const answers = answersFor({ code, lo, hi });
  if (answers.length < 1 || answers.length > 3) return null;
  return { code, lo, hi };
}

function answersFor(p: ReversePub): number[] {
  const out: number[] = [];
  for (let x = p.lo; x <= p.hi; x++) {
    const r = runTock(p.code, `${x}\n`);
    if (!r.error && r.output.trim() === "yes") out.push(x);
  }
  return out;
}

export const tockReverse: WidgetModule<object, ReversePub, { answers: number[] }, { text: string }> = {
  generate(rng) {
    for (;;) {
      const v = reverseVariant(rng);
      if (v) return { pub: v, key: { answers: answersFor(v) }, vars: { lo: v.lo, hi: v.hi } };
    }
  },
  grade(pub, _k, r) {
    const x = Number(String(r?.text ?? "").trim());
    if (!Number.isInteger(x) || x < pub.lo || x > pub.hi) return { fraction: 0 };
    const out = runTock(pub.code, `${x}\n`);
    return { fraction: !out.error && out.output.trim() === "yes" ? 1 : 0 };
  },
  describeKey: (_p, k) => k.answers.join(" or "),
};

/* ---------------------------------------------------------- tock-write */

type WriteTask = "has7" | "steps" | "pairs";

const REFERENCE: Record<WriteTask, { prompt: string; solve: (n: number) => string; sample: number; range: [number, number] }> = {
  has7: {
    prompt: "how many whole numbers from 1 to n contain the digit 7",
    solve: (n) => String(Array.from({ length: n }, (_, i) => i + 1).filter((x) => String(x).includes("7")).length),
    sample: 20,
    range: [1, 400],
  },
  steps: {
    prompt: "how many steps it takes to reach 1 if you repeatedly halve n when it is even and add 1 when it is odd",
    solve: (n) => {
      let c = 0;
      while (n > 1) {
        n = n % 2 === 0 ? n / 2 : n + 1;
        c++;
      }
      return String(c);
    },
    sample: 7,
    range: [1, 500],
  },
  pairs: {
    prompt: "how many pairs a < b with 1 ≤ a, b ≤ n have a sum divisible by 3",
    solve: (n) => {
      let c = 0;
      for (let a = 1; a <= n; a++) for (let b = a + 1; b <= n; b++) if ((a + b) % 3 === 0) c++;
      return String(c);
    },
    sample: 5,
    range: [1, 60],
  },
};

type WritePub = { task: WriteTask; sample: { input: string; output: string } };
type WriteKey = { tests: { input: string; output: string }[] };
export const tockWrite: WidgetModule<{ task?: WriteTask; tests?: number }, WritePub, WriteKey, { code: string }> = {
  generate(rng, c) {
    const task = c.task ?? "has7";
    const ref = REFERENCE[task];
    const ns = new Set<number>();
    while (ns.size < (c.tests ?? 5)) ns.add(rng.int(ref.range[0], ref.range[1]));
    return {
      pub: { task, sample: { input: `${ref.sample}\n`, output: ref.solve(ref.sample) } },
      key: { tests: [...ns].map((n) => ({ input: `${n}\n`, output: ref.solve(n) })) },
      vars: { task: ref.prompt, sampleIn: ref.sample, sampleOut: ref.solve(ref.sample) },
    };
  },
  grade(_p, key, r) {
    if (!r?.code?.trim()) return { fraction: 0 };
    let pass = 0;
    for (const t of key.tests) {
      const out = runTock(r.code, t.input, { maxSteps: 2_000_000 });
      if (!out.error && out.output.trim() === t.output.trim()) pass++;
    }
    return { fraction: pass / key.tests.length, detail: `${pass}/${key.tests.length} tests` };
  },
  describeKey: (_p, k) => k.tests.map((t) => `${t.input.trim()} → ${t.output}`).join(", "),
};
