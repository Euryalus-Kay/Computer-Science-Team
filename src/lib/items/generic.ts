import type { Rng } from "./rng";
import type {
  Generated,
  GradeResult,
  McqConfig,
  MultiConfig,
  ShortConfig,
  NumericConfig,
  OrderConfig,
  MatchConfig,
  TextConfig,
  McqResponse,
  MultiResponse,
  ShortResponse,
  NumericResponse,
  OrderResponse,
  MatchResponse,
} from "./types";
import { normalizeListAnswer } from "@/lib/tock";

const ids = "abcdefghijklmnopqrstuvwxyz";

function order(rng: Rng, n: number, shuffle: boolean | undefined) {
  const idx = Array.from({ length: n }, (_, i) => i);
  return shuffle === false ? idx : rng.shuffle(idx);
}

export function genMcq(rng: Rng, c: McqConfig): Generated<{ options: string[] }, { answer: number }> {
  const perm = order(rng, c.options.length, c.shuffle);
  return { pub: { options: perm.map((i) => c.options[i]) }, key: { answer: perm.indexOf(c.answer) } };
}
export function gradeMcq(_: unknown, key: { answer: number }, r: McqResponse | null): GradeResult {
  if (!r || typeof r.choice !== "number") return { fraction: 0 };
  return { fraction: r.choice === key.answer ? 1 : 0 };
}

export function genMulti(rng: Rng, c: MultiConfig): Generated<{ options: string[] }, { answers: number[]; partial: boolean }> {
  const perm = order(rng, c.options.length, c.shuffle);
  return {
    pub: { options: perm.map((i) => c.options[i]) },
    key: { answers: c.answers.map((a) => perm.indexOf(a)).sort((a, b) => a - b), partial: c.partial ?? true },
  };
}
export function gradeMulti(_: unknown, key: { answers: number[]; partial: boolean }, r: MultiResponse | null): GradeResult {
  const picked = new Set(r?.choices ?? []);
  const right = key.answers.filter((a) => picked.has(a)).length;
  const wrong = [...picked].filter((p) => !key.answers.includes(p)).length;
  if (right === key.answers.length && wrong === 0) return { fraction: 1 };
  if (!key.partial) return { fraction: 0 };
  return { fraction: Math.max(0, (right - wrong) / key.answers.length) };
}

export function normalizeText(s: string, caseSensitive = false) {
  const t = s.trim().replace(/\s+/g, " ");
  return caseSensitive ? t : t.toLowerCase();
}

export function genShort(_: Rng, c: ShortConfig): Generated<{ placeholder?: string; mode: string }, ShortConfig> {
  return { pub: { placeholder: c.placeholder, mode: c.mode ?? "text" }, key: c };
}
export function matchesShort(text: string, c: ShortConfig): boolean {
  const mode = c.mode ?? "text";
  for (const acc of c.accept) {
    if (mode === "regex") {
      try {
        if (new RegExp(`^(?:${acc})$`, c.caseSensitive ? "" : "i").test(text.trim())) return true;
      } catch {}
      continue;
    }
    if (mode === "list") {
      if (normalizeListAnswer(text) === normalizeListAnswer(acc)) return true;
      continue;
    }
    const a = normalizeText(text, c.caseSensitive);
    const b = normalizeText(acc, c.caseSensitive);
    if (a === b) return true;
    const na = parseNumber(a);
    const nb = parseNumber(b);
    if (na !== null && nb !== null && na === nb) return true;
  }
  return false;
}
export function gradeShort(_: unknown, key: ShortConfig, r: ShortResponse | null): GradeResult {
  if (!r?.text?.trim()) return { fraction: 0 };
  return { fraction: matchesShort(r.text, key) ? 1 : 0 };
}

export function genNumeric(_: Rng, c: NumericConfig): Generated<{ unit?: string }, NumericConfig> {
  return { pub: { unit: c.unit }, key: c };
}
export function parseNumber(s: string): number | null {
  const t = s.trim().replace(/,/g, "").replace(/\s+/g, "");
  if (!t) return null;
  if (/^[+-]?\d+\/\d+$/.test(t)) {
    const [a, b] = t.split("/").map(Number);
    return b ? a / b : null;
  }
  // Plain decimals only. Number() would also read 0x2F, 0b101 or 1e3, which would let
  // someone type the hex from a conversion question and get it right.
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
export function gradeNumeric(_: unknown, key: NumericConfig, r: NumericResponse | null): GradeResult {
  const v = r ? parseNumber(String(r.value ?? "")) : null;
  if (v === null) return { fraction: 0 };
  return { fraction: Math.abs(v - key.answer) <= (key.tolerance ?? 1e-9) ? 1 : 0 };
}

export function genOrder(rng: Rng, c: OrderConfig): Generated<{ items: { id: string; text: string }[] }, { order: string[]; partial: boolean }> {
  const items = c.items.map((text, i) => ({ id: ids[i], text }));
  let shuffled = rng.shuffle(items);
  if (shuffled.every((x, i) => x.id === items[i].id) && items.length > 1) shuffled = [...shuffled.slice(1), shuffled[0]];
  return { pub: { items: shuffled }, key: { order: items.map((x) => x.id), partial: c.partial ?? true } };
}
export function gradeOrder(_: unknown, key: { order: string[]; partial: boolean }, r: OrderResponse | null): GradeResult {
  const got = r?.order ?? [];
  if (got.length !== key.order.length) return { fraction: 0 };
  if (got.every((x, i) => x === key.order[i])) return { fraction: 1 };
  if (!key.partial) return { fraction: 0 };
  // Share of pairs in the right relative order.
  const pos = new Map(key.order.map((id, i) => [id, i]));
  let good = 0;
  let total = 0;
  for (let i = 0; i < got.length; i++)
    for (let j = i + 1; j < got.length; j++) {
      total++;
      if ((pos.get(got[i]) ?? 0) < (pos.get(got[j]) ?? 0)) good++;
    }
  const f = total ? good / total : 0;
  return { fraction: Math.round(Math.max(0, f * 2 - 1) * 100) / 100 };
}

export function genMatch(rng: Rng, c: MatchConfig): Generated<{ left: string[]; right: { id: number; text: string }[] }, { answer: number[] }> {
  const right = rng.shuffle(c.right.map((text, i) => ({ id: i, text })));
  return { pub: { left: c.left, right }, key: { answer: c.answer } };
}
export function gradeMatch(_: unknown, key: { answer: number[] }, r: MatchResponse | null): GradeResult {
  const pairs = r?.pairs ?? {};
  const right = key.answer.filter((a, i) => pairs[String(i)] === a).length;
  return { fraction: key.answer.length ? right / key.answer.length : 0 };
}

export function genText(_: Rng, c: TextConfig): Generated<{ placeholder?: string; maxChars: number }, { reference?: string }> {
  return { pub: { placeholder: c.placeholder, maxChars: c.maxChars ?? 3000 }, key: { reference: c.reference } };
}
