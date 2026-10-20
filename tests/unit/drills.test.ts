import { describe, expect, it } from "vitest";
import { TOPICS } from "@/lib/drills/generators";

// A seeded generator so failures can be reproduced.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Reference bit-string operations on strings, written independently of the generator.
const ref = {
  NOT: (x: string) => [...x].map((c) => (c === "1" ? "0" : "1")).join(""),
  LSHIFT: (x: string, k: number) => x.slice(k) + "0".repeat(k),
  RSHIFT: (x: string, k: number) => "0".repeat(k) + x.slice(0, x.length - k),
  LCIRC: (x: string, k: number) => x.slice(k) + x.slice(0, k),
  RCIRC: (x: string, k: number) => x.slice(x.length - k) + x.slice(0, x.length - k),
  AND: (a: string, b: string) => [...a].map((c, i) => (c === "1" && b[i] === "1" ? "1" : "0")).join(""),
  OR: (a: string, b: string) => [...a].map((c, i) => (c === "1" || b[i] === "1" ? "1" : "0")).join(""),
  XOR: (a: string, b: string) => [...a].map((c, i) => (c !== b[i] ? "1" : "0")).join(""),
};

describe("drills", () => {
  it("every generated answer passes its own check", () => {
    for (const t of TOPICS) {
      for (let s = 1; s <= 400; s++) {
        const q = t.make(rng(s));
        expect(q.answer.length, `${t.id} ${s}`).toBeGreaterThan(0);
        expect(q.check(q.answer), `${t.id} seed ${s}: ${q.code}`).toBe(true);
        expect(q.check(q.answer + "9"), `${t.id} seed ${s}`).toBe(false);
      }
    }
  });

  it("bit strings match a string-based reference", () => {
    const bits = TOPICS.find((t) => t.id === "bits")!;
    let checked = 0;
    for (let s = 1; s <= 600; s++) {
      const q = bits.make(rng(s));
      const toks = q.code!.split(" ");
      let want: string | null = null;
      const un = /^(NOT|LSHIFT|RSHIFT|LCIRC|RCIRC)(?:-(\d))?$/;
      if (toks.length === 2) {
        const m = toks[0].match(un)!;
        want = m[1] === "NOT" ? ref.NOT(toks[1]) : ref[m[1] as "LSHIFT"](toks[1], Number(m[2]));
      } else if (toks.length === 4 && un.test(toks[0])) {
        const m = toks[0].match(un)!;
        const first = m[1] === "NOT" ? ref.NOT(toks[1]) : ref[m[1] as "LSHIFT"](toks[1], Number(m[2]));
        want = ref[toks[2] as "AND"](first, toks[3]);
      } else if (toks.length === 5) {
        const [x, o1, y, o2, z] = toks;
        const rank: Record<string, number> = { AND: 0, XOR: 1, OR: 2 };
        want = rank[o2] < rank[o1] ? ref[o1 as "AND"](x, ref[o2 as "AND"](y, z)) : ref[o2 as "AND"](ref[o1 as "AND"](x, y), z);
      }
      if (want !== null) {
        expect(q.answer, `seed ${s}: ${q.code}`).toBe(want);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(500);
  });

  it("number answers are right", () => {
    const nums = TOPICS.find((t) => t.id === "numbers")!;
    for (let s = 1; s <= 300; s++) {
      const q = nums.make(rng(s));
      const code = q.code ?? "";
      const m = q.prompt.match(/^Convert (\d+) to (binary|octal|hexadecimal)/);
      if (m) {
        const base = { binary: 2, octal: 8, hexadecimal: 16 }[m[2]]!;
        expect(parseInt(q.answer, base)).toBe(Number(m[1]));
      } else if (q.prompt.startsWith("Add")) {
        const base = code.includes("₈") ? 8 : 16;
        const [a, b] = code.split(" + ").map((x) => parseInt(x.replace(/[₈₁₆]/g, ""), base));
        expect(parseInt(q.answer, base)).toBe(a + b);
      }
    }
  });
});
