import type { Rng } from "./rng";

export type ItemType = "mcq" | "multi" | "short" | "numeric" | "order" | "match" | "text" | "code" | "widget";
export type Grading = "auto" | "ai" | "manual";

/** What the browser receives for one question. Never contains answers. */
export type PublicItem = {
  id: string;
  type: ItemType;
  title: string;
  section: string | null;
  promptHtml: string;
  points: number;
  grading: Grading;
  data: unknown;
};

export type Generated<P = unknown, K = unknown> = {
  pub: P;
  key: K;
  /** Values substituted into {{placeholders}} in the prompt. */
  vars?: Record<string, string | number>;
};

export type GradeResult = {
  /** 0..1 share of the item's points. null means a person or Claude still has to grade it. */
  fraction: number | null;
  detail?: string;
};

export type WidgetModule<C = any, P = any, K = any, R = any, S = any> = {
  generate(rng: Rng, config: C): Generated<P, K>;
  grade(pub: P, key: K, response: R | null, state: S | null): GradeResult;
  /** Server-side moves for widgets that keep secrets (e.g. the lock). */
  interact?(pub: P, key: K, state: S | null, action: unknown): { state: S; reply: unknown };
  /** Human-readable correct answer for admin review. */
  describeKey?(pub: P, key: K): string;
};

/* ---- generic configs ---- */

export type McqConfig = { options: string[]; answer: number; shuffle?: boolean };
export type MultiConfig = { options: string[]; answers: number[]; shuffle?: boolean; partial?: boolean };
export type ShortConfig = { accept: string[]; mode?: "text" | "list" | "regex"; caseSensitive?: boolean; placeholder?: string };
export type NumericConfig = { answer: number; tolerance?: number; unit?: string };
export type OrderConfig = { items: string[]; partial?: boolean };
export type MatchConfig = { left: string[]; right: string[]; answer: number[] };
export type TextConfig = { placeholder?: string; maxChars?: number; reference?: string };
export type CodeConfig = { languages?: string[]; partial?: boolean };

export type AnyConfig = Record<string, unknown> & {
  variants?: Record<string, unknown>[];
  vars?: Record<string, string | number>;
  widget?: string;
};

/* ---- responses ---- */

export type McqResponse = { choice: number };
export type MultiResponse = { choices: number[] };
export type ShortResponse = { text: string };
export type NumericResponse = { value: string };
export type OrderResponse = { order: string[] };
export type MatchResponse = { pairs: Record<string, number> };
export type TextResponse = { text: string };
