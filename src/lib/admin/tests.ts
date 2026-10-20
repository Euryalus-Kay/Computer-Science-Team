"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  answers,
  attempts,
  contestItems,
  contests,
  integrityEvents,
  users,
  type ContestResource,
  type IntegrityConfig,
} from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { newCode, newId } from "@/lib/ids";
import { slugify } from "@/lib/problems";
import { codeFractions, getAnswers, getContest, getItems, loadAttempt, recomputeScore } from "@/lib/tests/attempts";
import { gradeItem, needsReview } from "@/lib/items/engine";
import { closeAttempt } from "@/lib/tests/close";
import { attemptDeadline, isPaused } from "@/lib/tests/timing";
import { analyzeContest, summarizeAttempt } from "@/lib/integrity/analyze";
import { gradeOneWithAi, gradePendingWithAi } from "@/lib/ai/grade";
import { askJson } from "@/lib/ai/client";
import { EVENT_LABEL } from "@/lib/integrity/events";
import { WIDGETS } from "@/lib/items/widgets";
import { renderMarkdown } from "@/lib/markdown";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export type ItemInput = {
  id?: string | null;
  section: string | null;
  type: string;
  title: string;
  prompt: string;
  points: number;
  config: Record<string, unknown>;
  grading: "auto" | "ai" | "manual";
  rubric: string | null;
  problemId: string | null;
};

export type TestSettings = {
  title: string;
  slug: string;
  description: string;
  status: "draft" | "published" | "archived";
  durationMin: number | null;
  opensAt: string | null;
  closesAt: string | null;
  startMode: "open" | "live";
  visibility: "everyone" | "assigned" | "code";
  accessCode: string | null;
  assignees: { groups: string[]; users: string[] };
  showResults: "never" | "after_submit" | "after_close";
  resultsDetail: "score" | "full";
  leaderboard: "off" | "live" | "after_close";
  integrity: IntegrityConfig;
  shuffleItems: boolean;
  resources: ContestResource[];
  maxAttempts: number;
  tag: string | null;
};

const TYPES = new Set(["mcq", "multi", "short", "numeric", "order", "match", "text", "code", "widget"]);

function checkItem(it: ItemInput, n: number): string | null {
  const where = `Question ${n}`;
  if (!TYPES.has(it.type)) return `${where}: unknown type.`;
  if (!(it.points >= 0 && it.points <= 1000)) return `${where}: points must be between 0 and 1000.`;
  const c = it.config as Record<string, unknown>;
  const variants = Array.isArray(c.variants) ? (c.variants as Record<string, unknown>[]) : null;
  const has = (k: string) => c[k] !== undefined || Boolean(variants?.length && variants.every((v) => v[k] !== undefined));
  switch (it.type) {
    case "mcq": {
      const opts = (c.options as unknown[]) ?? [];
      if (opts.length < 2) return `${where}: add at least two choices.`;
      if (!has("answer")) return `${where}: mark the correct choice.`;
      break;
    }
    case "multi": {
      const opts = (c.options as unknown[]) ?? [];
      if (opts.length < 2) return `${where}: add at least two choices.`;
      if (!Array.isArray(c.answers) || !(c.answers as unknown[]).length) return `${where}: mark at least one correct choice.`;
      break;
    }
    case "short":
      if (it.grading === "auto" && !has("accept") && !((c.accept as unknown[]) ?? []).length) return `${where}: add an accepted answer.`;
      break;
    case "numeric":
      if (!has("answer")) return `${where}: enter the answer.`;
      break;
    case "order":
      if (((c.items as unknown[]) ?? []).length < 2) return `${where}: add at least two items to order.`;
      break;
    case "match":
      if (((c.left as unknown[]) ?? []).length < 2) return `${where}: add at least two pairs.`;
      break;
    case "text":
      if (it.grading === "auto") return `${where}: written answers are graded by Claude or by hand.`;
      break;
    case "code":
      if (!it.problemId) return `${where}: pick a problem.`;
      break;
    case "widget":
      if (!WIDGETS[String(c.widget)]) return `${where}: pick an interactive question.`;
      break;
  }
  return null;
}

async function uniqueSlug(base: string, id: string | null) {
  const d = await db();
  let slug = slugify(base) || "test";
  for (let n = 2; ; n++) {
    const [clash] = await d
      .select({ id: contests.id })
      .from(contests)
      .where(id ? and(eq(contests.slug, slug), ne(contests.id, id)) : eq(contests.slug, slug))
      .limit(1);
    if (!clash) return slug;
    slug = `${slugify(base)}-${n}`;
  }
}

function refresh(id?: string) {
  revalidatePath("/tests", "layout");
  revalidatePath("/admin/tests", "layout");
  if (id) revalidatePath(`/admin/tests/${id}`, "layout");
}

const DEFAULT_INTEGRITY = (): IntegrityConfig => ({
  lockdown: "none",
  requireFullscreen: false,
  warnOnLeave: true,
  blockPaste: false,
  camera: false,
  exitCode: newCode(6),
  scanApps: true,
});

export async function createTest(title?: string): Promise<Result<{ id: string }>> {
  const s = await requireAdmin();
  const name = title?.trim() || "Untitled test";
  const id = newId();
  const d = await db();
  await d.insert(contests).values({
    id,
    slug: await uniqueSlug(name, null),
    title: name,
    status: "draft",
    durationMin: 30,
    integrity: DEFAULT_INTEGRITY(),
    createdBy: s.user.id,
  });
  refresh();
  return { ok: true, data: { id } };
}

export async function saveTest(id: string, settings: TestSettings, items: ItemInput[]): Promise<Result<{ ids: string[]; slug: string }>> {
  await requireAdmin();
  const title = settings.title.trim();
  if (!title) return { ok: false, error: "Give the test a title." };
  if (settings.durationMin !== null && !(settings.durationMin >= 1 && settings.durationMin <= 600)) {
    return { ok: false, error: "Time limit must be between 1 and 600 minutes." };
  }
  if (settings.startMode === "live" && !settings.durationMin) return { ok: false, error: "Live tests need a time limit." };
  if (settings.visibility === "code" && !settings.accessCode?.trim()) return { ok: false, error: "Set an access code." };
  if (settings.opensAt && settings.closesAt && Date.parse(settings.closesAt) <= Date.parse(settings.opensAt)) {
    return { ok: false, error: "The close time has to be after the open time." };
  }
  for (let i = 0; i < items.length; i++) {
    const err = checkItem(items[i], i + 1);
    if (err) return { ok: false, error: err };
  }
  const d = await db();
  const existing = await getContest(id);
  if (!existing) return { ok: false, error: "Test not found." };
  const slug = await uniqueSlug(settings.slug || title, id);
  await d
    .update(contests)
    .set({
      title,
      slug,
      description: settings.description,
      status: settings.status,
      durationMin: settings.durationMin,
      opensAt: settings.opensAt ? new Date(settings.opensAt) : null,
      closesAt: settings.closesAt ? new Date(settings.closesAt) : null,
      startMode: settings.startMode,
      visibility: settings.visibility,
      accessCode: settings.accessCode?.trim().toUpperCase() || null,
      assignees: settings.assignees,
      showResults: settings.showResults,
      resultsDetail: settings.resultsDetail,
      leaderboard: settings.leaderboard,
      integrity: { ...settings.integrity, exitCode: settings.integrity.exitCode?.trim() || newCode(6) },
      shuffleItems: settings.shuffleItems,
      resources: settings.resources.filter((r) => r.title.trim() || r.body.trim()).map((r) => ({ ...r, id: r.id || newId(8) })),
      maxAttempts: Math.max(1, Math.min(50, Math.round(settings.maxAttempts) || 1)),
      tag: settings.tag?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(contests.id, id));

  const current = await getItems(id);
  const keep = new Set(items.map((i) => i.id).filter(Boolean) as string[]);
  const drop = current.filter((c) => !keep.has(c.id)).map((c) => c.id);
  if (drop.length) await d.delete(contestItems).where(and(eq(contestItems.contestId, id), inArray(contestItems.id, drop)));
  const ids: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const row = {
      ord: i,
      section: it.section?.trim() || null,
      type: it.type,
      title: it.title.trim(),
      prompt: it.prompt,
      points: Number(it.points) || 0,
      config: it.config ?? {},
      grading: it.grading,
      rubric: it.rubric?.trim() || null,
      problemId: it.type === "code" ? it.problemId : null,
    };
    if (it.id && current.some((c) => c.id === it.id)) {
      await d.update(contestItems).set(row).where(eq(contestItems.id, it.id));
      ids.push(it.id);
    } else {
      const nid = newId();
      await d.insert(contestItems).values({ id: nid, contestId: id, ...row });
      ids.push(nid);
    }
  }
  // Keep max scores on open attempts in step with the questions.
  const total = items.reduce((s, i) => s + (Number(i.points) || 0), 0);
  await d.update(attempts).set({ maxScore: total }).where(and(eq(attempts.contestId, id), eq(attempts.status, "active")));
  refresh(id);
  return { ok: true, data: { ids, slug } };
}

export async function setTestStatus(id: string, status: "draft" | "published" | "archived"): Promise<Result> {
  await requireAdmin();
  const d = await db();
  await d.update(contests).set({ status, updatedAt: new Date() }).where(eq(contests.id, id));
  refresh(id);
  return { ok: true };
}

export async function duplicateTest(id: string): Promise<Result<{ id: string }>> {
  const s = await requireAdmin();
  const c = await getContest(id);
  if (!c) return { ok: false, error: "Test not found." };
  const items = await getItems(id);
  const nid = newId();
  const d = await db();
  const { id: _id, slug: _slug, createdAt: _c, updatedAt: _u, ...rest } = c;
  await d.insert(contests).values({
    ...rest,
    id: nid,
    title: `${c.title} (copy)`,
    slug: await uniqueSlug(`${c.slug}-copy`, null),
    status: "draft",
    liveStartAt: null,
    liveEndAt: null,
    pauses: [],
    extraSeconds: 0,
    integrity: { ...c.integrity, exitCode: newCode(6) },
    createdBy: s.user.id,
  });
  if (items.length) {
    await d.insert(contestItems).values(items.map(({ id: _iid, contestId: _cid, ...it }) => ({ ...it, id: newId(), contestId: nid })));
  }
  refresh();
  return { ok: true, data: { id: nid } };
}

export async function deleteTest(id: string): Promise<Result> {
  await requireAdmin();
  const d = await db();
  await d.delete(contests).where(eq(contests.id, id));
  refresh();
  return { ok: true };
}

/* -------------------------------------------------------------- live control */

async function contestOr404(id: string) {
  const c = await getContest(id);
  if (!c) throw new Error("Test not found.");
  return c;
}

export async function liveStart(id: string, countdownSec = 5): Promise<Result> {
  await requireAdmin();
  const c = await contestOr404(id);
  if (!c.durationMin) return { ok: false, error: "Set a time limit first." };
  const start = new Date(Date.now() + Math.max(0, Math.min(60, countdownSec)) * 1000);
  const d = await db();
  await d
    .update(contests)
    .set({
      status: c.status === "archived" ? "archived" : "published",
      startMode: "live",
      liveStartAt: start,
      liveEndAt: new Date(start.getTime() + c.durationMin * 60_000),
      closesAt: null,
      pauses: [],
      extraSeconds: 0,
      updatedAt: new Date(),
    })
    .where(eq(contests.id, id));
  refresh(id);
  return { ok: true };
}

export async function livePause(id: string, pause: boolean): Promise<Result> {
  await requireAdmin();
  const c = await contestOr404(id);
  const now = new Date().toISOString();
  const pauses = [...c.pauses];
  if (pause && !isPaused(c)) pauses.push({ start: now, end: null });
  if (!pause && isPaused(c)) pauses[pauses.length - 1] = { ...pauses[pauses.length - 1], end: now };
  const d = await db();
  await d.update(contests).set({ pauses, updatedAt: new Date() }).where(eq(contests.id, id));
  refresh(id);
  return { ok: true };
}

/** Adds (or removes, with a negative value) time for everyone taking the test. */
export async function addTestTime(id: string, seconds: number): Promise<Result> {
  await requireAdmin();
  const c = await contestOr404(id);
  const next = Math.max(-c.extraSeconds - (c.durationMin ?? 0) * 60 + 60, Math.round(seconds));
  const d = await db();
  await d
    .update(contests)
    .set({ extraSeconds: sql`${contests.extraSeconds} + ${next}`, updatedAt: new Date() })
    .where(eq(contests.id, id));
  refresh(id);
  return { ok: true };
}

/** Stops the test now: closes it and submits every open attempt. */
export async function endTestNow(id: string): Promise<Result<{ closed: number }>> {
  await requireAdmin();
  const c = await contestOr404(id);
  const d = await db();
  const now = new Date();
  const pauses = isPaused(c) ? [...c.pauses.slice(0, -1), { ...c.pauses[c.pauses.length - 1], end: now.toISOString() }] : c.pauses;
  await d.update(contests).set({ closesAt: now, pauses, updatedAt: now }).where(eq(contests.id, id));
  const open = await d
    .select({ id: attempts.id })
    .from(attempts)
    .where(and(eq(attempts.contestId, id), eq(attempts.status, "active"), eq(attempts.isPreview, false)));
  for (const a of open) await closeAttempt(a.id, "expired");
  refresh(id);
  return { ok: true, data: { closed: open.length } };
}

/** Opens or closes a self-start test right away. */
export async function setOpenWindow(id: string, patch: { opensAt?: string | null; closesAt?: string | null }): Promise<Result> {
  await requireAdmin();
  const d = await db();
  const set: Partial<typeof contests.$inferInsert> = { updatedAt: new Date() };
  if (patch.opensAt !== undefined) set.opensAt = patch.opensAt ? new Date(patch.opensAt) : null;
  if (patch.closesAt !== undefined) set.closesAt = patch.closesAt ? new Date(patch.closesAt) : null;
  const c = await contestOr404(id);
  if (c.status === "draft") set.status = "published";
  await d.update(contests).set(set).where(eq(contests.id, id));
  refresh(id);
  return { ok: true };
}

/** Clears the live start so the test can be run again. Earlier attempts stay. */
export async function liveReset(id: string): Promise<Result> {
  await requireAdmin();
  const d = await db();
  await d
    .update(contests)
    .set({ liveStartAt: null, liveEndAt: null, closesAt: null, pauses: [], extraSeconds: 0, updatedAt: new Date() })
    .where(eq(contests.id, id));
  refresh(id);
  return { ok: true };
}

/* ----------------------------------------------------------- attempt control */

export async function addAttemptTime(attemptId: string, seconds: number): Promise<Result> {
  await requireAdmin();
  const d = await db();
  await d
    .update(attempts)
    .set({ extraSeconds: sql`greatest(${attempts.extraSeconds} + ${Math.round(seconds)}, -3600)` })
    .where(eq(attempts.id, attemptId));
  const l = await loadAttempt(attemptId);
  refresh(l?.contest.id);
  return { ok: true };
}

export async function forceSubmit(attemptId: string): Promise<Result> {
  await requireAdmin();
  await closeAttempt(attemptId, "submitted");
  const l = await loadAttempt(attemptId);
  refresh(l?.contest.id);
  return { ok: true };
}

/** Reopens a submitted attempt with at least `minutes` left on its clock. */
export async function reopenAttempt(attemptId: string, minutes: number): Promise<Result> {
  await requireAdmin();
  const l = await loadAttempt(attemptId);
  if (!l) return { ok: false, error: "Attempt not found." };
  const { attempt, contest } = l;
  const d = await db();
  const now = Date.now();
  const reopened = { ...attempt, status: "active" as const };
  const deadline = attemptDeadline(contest, reopened, now);
  let extra = attempt.extraSeconds;
  if (deadline !== null) {
    const want = now + Math.max(1, minutes) * 60_000;
    if (deadline < want) extra += Math.ceil((want - deadline) / 1000);
  }
  if (contest.closesAt && contest.closesAt.getTime() < now + minutes * 60_000) {
    return { ok: false, error: "The test is closed. Reopen the test first, then the attempt." };
  }
  await d.update(attempts).set({ status: "active", submittedAt: null, extraSeconds: extra }).where(eq(attempts.id, attemptId));
  refresh(contest.id);
  return { ok: true };
}

export async function deleteAttempt(attemptId: string): Promise<Result> {
  await requireAdmin();
  const l = await loadAttempt(attemptId);
  const d = await db();
  await d.delete(attempts).where(eq(attempts.id, attemptId));
  refresh(l?.contest.id);
  return { ok: true };
}

export async function setReviewed(attemptId: string, reviewed: boolean): Promise<Result> {
  await requireAdmin();
  const d = await db();
  await d.update(attempts).set({ reviewed }).where(eq(attempts.id, attemptId));
  const l = await loadAttempt(attemptId);
  refresh(l?.contest.id);
  return { ok: true };
}

/* ------------------------------------------------------------------- grading */

export async function setAnswerScore(attemptId: string, itemId: string, score: number, feedback?: string | null): Promise<Result> {
  await requireAdmin();
  const l = await loadAttempt(attemptId);
  if (!l) return { ok: false, error: "Attempt not found." };
  const item = (await getItems(l.contest.id)).find((i) => i.id === itemId);
  if (!item) return { ok: false, error: "Question not found." };
  const value = Math.max(0, Math.min(item.points, Number(score) || 0));
  const d = await db();
  await d
    .insert(answers)
    .values({ attemptId, itemId, maxScore: item.points, score: value, status: "graded", correct: value === item.points, gradedBy: "admin", feedback: feedback ?? null })
    .onConflictDoUpdate({
      target: [answers.attemptId, answers.itemId],
      set: { score: value, status: "graded", correct: value === item.points, gradedBy: "admin", ...(feedback !== undefined ? { feedback } : {}) },
    });
  await recomputeScore(attemptId);
  refresh(l.contest.id);
  return { ok: true };
}

export async function regradeWithAi(attemptId: string, itemId?: string): Promise<Result> {
  await requireAdmin();
  const l = await loadAttempt(attemptId);
  if (!l) return { ok: false, error: "Attempt not found." };
  try {
    if (!itemId) {
      await gradePendingWithAi(attemptId);
    } else {
      const item = (await getItems(l.contest.id)).find((i) => i.id === itemId);
      if (!item) return { ok: false, error: "Question not found." };
      const d = await db();
      const [a] = await d
        .select()
        .from(answers)
        .where(and(eq(answers.attemptId, attemptId), eq(answers.itemId, itemId)))
        .limit(1);
      if (!a?.response) return { ok: false, error: "No answer to grade." };
      const v = await gradeOneWithAi(item, l.attempt.seed, a.response);
      await d
        .update(answers)
        .set({ score: v.score, status: "graded", correct: v.score === item.points, gradedBy: "ai", feedback: v.feedback, note: v.reasoning })
        .where(and(eq(answers.attemptId, attemptId), eq(answers.itemId, itemId)));
      await recomputeScore(attemptId);
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  refresh(l.contest.id);
  return { ok: true };
}

/**
 * Re-grades every saved answer against the current questions, for when an answer key
 * was fixed after people took the test. Hand and Claude grades are left alone.
 */
export async function regradeTest(contestId: string): Promise<Result<{ attempts: number }>> {
  await requireAdmin();
  const d = await db();
  const items = await getItems(contestId);
  const list = await d.select().from(attempts).where(eq(attempts.contestId, contestId));
  for (const a of list) {
    const ans = new Map((await getAnswers(a.id)).map((x) => [x.itemId, x]));
    const codes = await codeFractions(a.id, items);
    for (const it of items) {
      const prev = ans.get(it.id);
      if (it.type === "code") {
        if (a.status === "active" && !prev) continue;
        const f = codes.get(it.id) ?? 0;
        await d
          .insert(answers)
          .values({ attemptId: a.id, itemId: it.id, maxScore: it.points, score: f * it.points, status: "graded", correct: f === 1, gradedBy: "auto" })
          .onConflictDoUpdate({ target: [answers.attemptId, answers.itemId], set: { score: f * it.points, maxScore: it.points, correct: f === 1 } });
        continue;
      }
      if (!prev || prev.status === "empty" || needsReview(it) || prev.gradedBy === "admin" || prev.gradedBy === "ai") continue;
      const g = gradeItem(it, a.seed, prev.response, prev.state);
      if (g.fraction === null) continue;
      await d
        .update(answers)
        .set({ score: g.fraction * it.points, maxScore: it.points, correct: g.fraction === 1, status: "graded", gradedBy: "auto" })
        .where(and(eq(answers.attemptId, a.id), eq(answers.itemId, it.id)));
    }
    await recomputeScore(a.id);
    await d.update(attempts).set({ maxScore: items.reduce((t, i) => t + i.points, 0) }).where(eq(attempts.id, a.id));
  }
  refresh(contestId);
  return { ok: true, data: { attempts: list.length } };
}

/** Grades every answer in the test that is still waiting on Claude. */
export async function gradeAllPending(contestId: string): Promise<Result<{ graded: number }>> {
  await requireAdmin();
  const d = await db();
  const rows = await d
    .selectDistinct({ id: answers.attemptId })
    .from(answers)
    .innerJoin(attempts, eq(attempts.id, answers.attemptId))
    .where(and(eq(attempts.contestId, contestId), eq(answers.status, "pending"), ne(attempts.status, "active")));
  for (const r of rows) await gradePendingWithAi(r.id);
  refresh(contestId);
  return { ok: true, data: { graded: rows.length } };
}

/* ----------------------------------------------------------------- integrity */

export async function runIntegrityAnalysis(contestId: string): Promise<Result> {
  await requireAdmin();
  await analyzeContest(contestId);
  refresh(contestId);
  return { ok: true };
}

type Review = { verdict: "no_concern" | "minor" | "review" | "likely"; summary: string; evidence: string[] };

/** Asks Claude to read an attempt's event log and timing and say whether it looks like cheating. */
export async function aiReviewAttempt(attemptId: string): Promise<Result> {
  await requireAdmin();
  const l = await loadAttempt(attemptId);
  if (!l) return { ok: false, error: "Attempt not found." };
  const summary = await summarizeAttempt(attemptId);
  const d = await db();
  const items = await getItems(l.contest.id);
  const ans = await d.select().from(answers).where(eq(answers.attemptId, attemptId));
  const events = await d
    .select()
    .from(integrityEvents)
    .where(and(eq(integrityEvents.attemptId, attemptId), ne(integrityEvents.severity, "info")))
    .orderBy(integrityEvents.at)
    .limit(300);
  const t0 = l.attempt.startedAt.getTime();
  const mmss = (t: number) => {
    const s = Math.max(0, Math.round((t - t0) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const title = new Map(items.map((i, n) => [i.id, `Q${n + 1} ${i.title}`]));
  const answerLines = items
    .map((it, n) => {
      const a = ans.find((x) => x.itemId === it.id);
      if (!a || a.status === "empty") return `Q${n + 1} ${it.title} (${it.points} pts): not answered`;
      const saved = a.firstSavedAt ? ` first saved ${mmss(a.firstSavedAt.getTime())}` : "";
      return `Q${n + 1} ${it.title} (${it.points} pts): ${a.correct ? "correct" : a.score ? `partly right (${a.score})` : "wrong"}, ${Math.round(a.timeSpentMs / 1000)} s on it,${saved}`;
    })
    .join("\n");
  const eventLines = events
    .map((e) => `${mmss(e.at.getTime())} ${EVENT_LABEL[e.type] ?? e.type}${e.itemId ? ` on ${title.get(e.itemId) ?? "a question"}` : ""}${e.data ? ` ${JSON.stringify(e.data).slice(0, 160)}` : ""}`)
    .join("\n");
  const prompt = `Test: ${l.contest.title}, ${l.contest.durationMin ?? "untimed"} minutes, taken in ${l.attempt.client?.kind ?? "web"} mode.
Automatic flags:
${summary?.flags.map((f) => `- [${f.severity}] ${f.message}`).join("\n") || "- none"}

Answers, in test order:
${answerLines}

Events (minutes:seconds from the start):
${eventLines || "none"}

Decide how likely it is that this student got outside help. Leaving the page briefly or one stray paste is common and usually innocent. Look for patterns: correct answers right after time away, hard questions solved much faster than the rest, pasted answers, lockdown violations.`;
  try {
    const { data, model } = await askJson<Review>({
      system:
        "You review integrity logs from a high school club's online tests. Be fair and specific. Never accuse without evidence from the log; when the evidence is thin, say so. Write for the teacher in plain sentences.",
      prompt,
      effort: "medium",
      schema: {
        type: "object",
        properties: {
          verdict: { type: "string", enum: ["no_concern", "minor", "review", "likely"] },
          summary: { type: "string", description: "Two or three sentences." },
          evidence: { type: "array", items: { type: "string" }, description: "Specific moments from the log, at most five." },
        },
        required: ["verdict", "summary", "evidence"],
        additionalProperties: false,
      },
    });
    await d
      .update(attempts)
      .set({ aiReview: { ...data, evidence: data.evidence.slice(0, 5), model, at: new Date().toISOString() } })
      .where(eq(attempts.id, attemptId));
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  refresh(l.contest.id);
  return { ok: true };
}

/* --------------------------------------------------------------- authoring */

export async function previewTestMarkdown(md: string): Promise<string> {
  await requireAdmin();
  return renderMarkdown(md);
}

export async function draftRubric(prompt: string, points: number, reference?: string): Promise<Result<{ rubric: string; reference: string }>> {
  await requireAdmin();
  if (!prompt.trim()) return { ok: false, error: "Write the question first." };
  try {
    const { data } = await askJson<{ rubric: string; reference: string }>({
      system: "You write grading rubrics for a high school computer science club. Rubrics are short, concrete and list what earns each score.",
      prompt: `Question worth ${points} points:\n${prompt}\n${reference ? `\nThe teacher's reference answer:\n${reference}\n` : ""}\nWrite a rubric with one line per score from ${points} down to 0, starting each line with the score and a colon. Also write a model answer a strong student could give in a few sentences.`,
      schema: {
        type: "object",
        properties: { rubric: { type: "string" }, reference: { type: "string" } },
        required: ["rubric", "reference"],
        additionalProperties: false,
      },
    });
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Member names for the assignment picker. */
export async function memberOptions() {
  await requireAdmin();
  const d = await db();
  return d.select({ id: users.id, name: users.name, username: users.username }).from(users).where(eq(users.disabled, false)).orderBy(users.name);
}
