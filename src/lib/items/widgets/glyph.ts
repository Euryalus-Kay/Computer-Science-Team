import type { Rng } from "../rng";
import type { WidgetModule } from "../types";
import { normalizeListAnswer } from "@/lib/tock";

/**
 * Glyph: a made-up stack language for the "read the manual" question. A program is
 * tokens separated by spaces. Numbers go on the stack, symbols act on it, and
 * `n( ... )` repeats its body n times.
 */
export function runGlyph(src: string, maxSteps = 5000): { out: number[]; stack: number[]; error?: string } {
  const toks = src.trim().split(/\s+/).filter(Boolean);
  const stack: number[] = [];
  const out: number[] = [];
  let steps = 0;
  const pop = () => {
    if (!stack.length) throw new Error("the stack is empty");
    return stack.pop()!;
  };
  const close = (from: number) => {
    let depth = 0;
    for (let i = from; i < toks.length; i++) {
      if (/^\d+\($/.test(toks[i])) depth++;
      else if (toks[i] === ")" && --depth === 0) return i;
    }
    throw new Error("a ( has no matching )");
  };
  const exec = (from: number, to: number) => {
    for (let i = from; i < to; i++) {
      if (++steps > maxSteps) throw new Error("the program runs too long");
      const t = toks[i];
      if (/^\d+\($/.test(t)) {
        const end = close(i);
        for (let k = 0; k < parseInt(t, 10); k++) exec(i + 1, end);
        i = end;
        continue;
      }
      if (/^-?\d+$/.test(t)) {
        stack.push(Number(t));
        continue;
      }
      switch (t) {
        case "+":
        case "-":
        case "*": {
          const b = pop();
          const a = pop();
          stack.push(t === "+" ? a + b : t === "-" ? a - b : a * b);
          break;
        }
        case ":": {
          const a = pop();
          stack.push(a, a);
          break;
        }
        case "~": {
          const b = pop();
          const a = pop();
          stack.push(b, a);
          break;
        }
        case "^": {
          const c = pop();
          const b = pop();
          const a = pop();
          stack.push(b, c, a);
          break;
        }
        case ".":
          out.push(pop());
          break;
        default:
          throw new Error(`unknown symbol ${t}`);
      }
    }
  };
  try {
    exec(0, toks.length);
    return { out, stack };
  } catch (e) {
    return { out, stack, error: (e as Error).message };
  }
}

/**
 * Each template leans on a different part of the manual (the order for -, swap, the
 * pull-up, copies, repeats), so a careful reader beats a quick guess.
 */
const TEMPLATES: ((r: Rng) => string)[] = [
  (r) => `${r.int(2, 5)} ${r.int(6, 9)} ~ - ${r.int(2, 4)} * .`,
  (r) => `${r.int(6, 9)} ${r.int(2, 5)} - ${r.int(1, 4)} ~ - .`,
  (r) => `${r.int(2, 6)} ${r.int(2, 6)} ${r.int(7, 9)} ^ - * .`,
  (r) => `${r.int(2, 5)} : ${r.int(2, 4)}( 2 * ) + .`,
  (r) => `${r.int(2, 6)} ${r.int(2, 6)} + : . ${r.int(2, 4)} * .`,
  (r) => `${r.int(2, 9)} ${r.int(2, 9)} ~ : ^ - - .`,
  (r) => `${r.int(2, 4)} ${r.int(2, 3)}( : + ) ${r.int(3, 9)} - .`,
  (r) => `${r.int(1, 4)} ${r.int(5, 9)} ${r.int(2, 4)}( ~ : + ) . .`,
];

type GlyphPub = { code: string };

export const glyph: WidgetModule<object, GlyphPub, { output: number[] }, { text: string }> = {
  generate(rng) {
    for (;;) {
      const code = rng.pick(TEMPLATES)(rng);
      const r = runGlyph(code);
      if (!r.error && r.out.length && r.out.every((n) => Math.abs(n) < 1000)) return { pub: { code }, key: { output: r.out } };
    }
  },
  grade: (_p, key, r) => ({ fraction: r?.text?.trim() && normalizeListAnswer(r.text) === key.output.join(" ") ? 1 : 0 }),
  describeKey: (_p, k) => k.output.join(" "),
};
