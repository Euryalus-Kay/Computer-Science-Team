import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { answers, attempts, users } from "@/lib/db/schema";
import { getItems, type ContestRow } from "@/lib/tests/attempts";
import type { ItemRow } from "@/lib/items/engine";

export type Cell = "right" | "partial" | "wrong" | "pending" | "blank";

export type ResultRow = {
  attemptId: string;
  userId: string;
  name: string;
  username: string;
  grade: string | null;
  status: "active" | "submitted" | "expired";
  score: number;
  maxScore: number;
  startedAt: number;
  submittedAt: number | null;
  usedMs: number;
  answered: number;
  reached: number;
  /** The question they were on when they submitted or time ran out, in their order. */
  endedOn: number | null;
  cells: Cell[];
  itemScores: (number | null)[];
  sections: { name: string; score: number; max: number }[];
  level: string;
  risk: number;
  flags: { severity: string; message: string }[];
  reviewed: boolean;
  aiVerdict: string | null;
  pending: number;
};

export type QuestionStat = {
  id: string;
  n: number;
  title: string;
  section: string | null;
  points: number;
  type: string;
  attempted: number;
  correct: number;
  avgScore: number;
  avgTimeMs: number;
};

export type Results = {
  items: { id: string; title: string; section: string | null; points: number }[];
  rows: ResultRow[];
  questions: QuestionStat[];
  summary: { count: number; mean: number; median: number; max: number; maxScore: number; answered: number };
};

function cellOf(item: ItemRow, a: typeof answers.$inferSelect | undefined): Cell {
  if (!a || a.status === "empty") return "blank";
  if (a.status === "pending") return "pending";
  if (a.score === null) return item.type === "code" ? "blank" : "pending";
  if (a.score >= item.points) return "right";
  if (a.score > 0) return "partial";
  return "wrong";
}

/** Everything the results page and the CSV export show. */
export async function loadResults(c: ContestRow, opts: { previews?: boolean } = {}): Promise<Results> {
  const d = await db();
  const items = await getItems(c.id);
  const rows = await d
    .select({ attempt: attempts, name: users.name, username: users.username, grade: users.grade })
    .from(attempts)
    .innerJoin(users, eq(users.id, attempts.userId))
    .where(and(eq(attempts.contestId, c.id), opts.previews ? undefined : eq(attempts.isPreview, false)));
  const ids = rows.map((r) => r.attempt.id);
  const ans = ids.length ? await d.select().from(answers).where(inArray(answers.attemptId, ids)) : [];
  const by = new Map<string, Map<string, (typeof ans)[number]>>();
  for (const a of ans) {
    if (!by.has(a.attemptId)) by.set(a.attemptId, new Map());
    by.get(a.attemptId)!.set(a.itemId, a);
  }
  const sectionNames = [...new Set(items.map((i) => i.section ?? ""))];
  const now = Date.now();

  const out: ResultRow[] = rows.map(({ attempt: a, name, username, grade }) => {
    const mine = by.get(a.id) ?? new Map();
    // Show questions in the order this person saw them.
    const order = a.order.length ? a.order.map((id) => items.find((i) => i.id === id)).filter((x): x is ItemRow => Boolean(x)) : items;
    for (const it of items) if (!order.includes(it)) order.push(it);
    const cells = items.map((it) => cellOf(it, mine.get(it.id)));
    const answered = cells.filter((x) => x !== "blank").length;
    // "Reached" is the furthest question answered, in the order shown to them.
    let reached = 0;
    order.forEach((it, i) => {
      const cell = cellOf(it, mine.get(it.id));
      if (cell !== "blank") reached = i + 1;
    });
    const sections = sectionNames.map((s) => {
      const its = items.filter((i) => (i.section ?? "") === s);
      return {
        name: s || "Questions",
        score: its.reduce((t, i) => t + (mine.get(i.id)?.score ?? 0), 0),
        max: its.reduce((t, i) => t + i.points, 0),
      };
    });
    return {
      attemptId: a.id,
      userId: a.userId,
      name,
      username,
      grade,
      status: a.status,
      score: a.score,
      maxScore: a.maxScore,
      startedAt: a.startedAt.getTime(),
      submittedAt: a.submittedAt?.getTime() ?? null,
      usedMs: (a.submittedAt?.getTime() ?? now) - a.startedAt.getTime(),
      answered,
      reached: Math.max(reached, a.frontier),
      endedOn: a.lastItemId && order.findIndex((it) => it.id === a.lastItemId) >= 0 ? order.findIndex((it) => it.id === a.lastItemId) + 1 : null,
      cells,
      itemScores: items.map((it) => mine.get(it.id)?.score ?? null),
      sections,
      level: a.integrity?.level ?? "clear",
      risk: a.integrity?.risk ?? 0,
      flags: (a.integrity?.flags ?? []).map((f) => ({ severity: f.severity, message: f.message })),
      reviewed: a.reviewed,
      aiVerdict: a.aiReview?.verdict ?? null,
      pending: cells.filter((x) => x === "pending").length,
    };
  });
  out.sort((x, y) => y.score - x.score || y.reached - x.reached || x.usedMs - y.usedMs);

  const questions: QuestionStat[] = items.map((it, i) => {
    const list = ids.map((id) => by.get(id)?.get(it.id)).filter((a): a is NonNullable<typeof a> => Boolean(a && a.status !== "empty"));
    const graded = list.filter((a) => a.score !== null);
    const timed = ids.map((id) => by.get(id)?.get(it.id)?.timeSpentMs ?? 0).filter((t) => t > 0);
    return {
      id: it.id,
      n: i + 1,
      title: it.title || `Question ${i + 1}`,
      section: it.section,
      points: it.points,
      type: it.type === "widget" ? String((it.config as { widget?: string }).widget) : it.type,
      attempted: list.length,
      correct: graded.filter((a) => (a.score ?? 0) >= it.points).length,
      avgScore: graded.length ? graded.reduce((t, a) => t + (a.score ?? 0), 0) / graded.length : 0,
      avgTimeMs: timed.length ? timed.reduce((t, x) => t + x, 0) / timed.length : 0,
    };
  });

  const done = out.filter((r) => r.status !== "active");
  const scores = done.map((r) => r.score).sort((a, b) => a - b);
  const total = items.reduce((t, i) => t + i.points, 0);
  return {
    items: items.map((i) => ({ id: i.id, title: i.title, section: i.section, points: i.points })),
    rows: out,
    questions,
    summary: {
      count: done.length,
      mean: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      median: scores.length ? (scores.length % 2 ? scores[(scores.length - 1) / 2] : (scores[scores.length / 2 - 1] + scores[scores.length / 2]) / 2) : 0,
      max: scores.length ? scores[scores.length - 1] : 0,
      maxScore: total,
      answered: done.length ? done.reduce((t, r) => t + r.answered, 0) / done.length : 0,
    },
  };
}
