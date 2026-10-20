import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { answers, attempts, contestItems, contests, groupMembers, submissions } from "@/lib/db/schema";
import { newId, randomSeed } from "@/lib/ids";
import { makeRng } from "@/lib/items/rng";
import { gradeItem, needsReview, type ItemRow } from "@/lib/items/engine";
import { availability, isExpired } from "./timing";
import type { Session } from "@/lib/auth/session";

export type ContestRow = typeof contests.$inferSelect;
export type AttemptRow = typeof attempts.$inferSelect;
export type AnswerRow = typeof answers.$inferSelect;

export async function getContest(idOrSlug: string): Promise<ContestRow | null> {
  const d = await db();
  const [c] = await d
    .select()
    .from(contests)
    .where(sql`${contests.id} = ${idOrSlug} or ${contests.slug} = ${idOrSlug}`)
    .limit(1);
  return c ?? null;
}

export async function getItems(contestId: string): Promise<ItemRow[]> {
  const d = await db();
  return d.select().from(contestItems).where(eq(contestItems.contestId, contestId)).orderBy(asc(contestItems.ord));
}

export async function userGroupIds(userId: string): Promise<string[]> {
  const d = await db();
  return (await d.select({ g: groupMembers.groupId }).from(groupMembers).where(eq(groupMembers.userId, userId))).map((r) => r.g);
}

/** Whether a member may see a test in their list at all. */
export function visibleTo(c: ContestRow, userId: string, groups: string[], isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (c.status !== "published") return false;
  if (c.visibility === "assigned") {
    return c.assignees.users.includes(userId) || c.assignees.groups.some((g) => groups.includes(g));
  }
  return true;
}

export type LockdownCheck = { ok: true } | { ok: false; need: "app" | "seb" | "any" };

export function lockdownOk(c: ContestRow, session: Session, preview: boolean): LockdownCheck {
  const mode = c.integrity?.lockdown ?? "none";
  if (mode === "none" || preview) return { ok: true };
  if (mode === "app" && session.kind === "desktop") return { ok: true };
  if (mode === "seb" && session.kind === "seb") return { ok: true };
  if (mode === "any" && (session.kind === "desktop" || session.kind === "seb")) return { ok: true };
  return { ok: false, need: mode };
}

function orderFor(items: ItemRow[], seed: number, shuffle: boolean): string[] {
  if (!shuffle) return items.map((i) => i.id);
  // Shuffle inside each section so the overall flow stays the same.
  const rng = makeRng(`order:${seed}`);
  const out: string[] = [];
  let group: ItemRow[] = [];
  const flush = () => {
    out.push(...rng.shuffle(group).map((i) => i.id));
    group = [];
  };
  for (const it of items) {
    if (group.length && group[0].section !== it.section) flush();
    group.push(it);
  }
  flush();
  return out;
}

export async function activeAttempt(contestId: string, userId: string, preview: boolean) {
  const d = await db();
  const [a] = await d
    .select()
    .from(attempts)
    .where(and(eq(attempts.contestId, contestId), eq(attempts.userId, userId), eq(attempts.status, "active"), eq(attempts.isPreview, preview)))
    .limit(1);
  return a ?? null;
}

export async function attemptsFor(contestId: string, userId: string) {
  const d = await db();
  return d
    .select()
    .from(attempts)
    .where(and(eq(attempts.contestId, contestId), eq(attempts.userId, userId)))
    .orderBy(asc(attempts.startedAt));
}

export type StartResult = { ok: true; attemptId: string } | { ok: false; error: string; need?: "app" | "seb" | "any" };

export async function startAttempt(
  c: ContestRow,
  session: Session,
  opts: { preview?: boolean; code?: string | null; client?: AttemptRow["client"] } = {},
): Promise<StartResult> {
  const user = session.user;
  const isAdmin = user.role === "admin";
  const preview = Boolean(opts.preview && isAdmin);
  const groups = await userGroupIds(user.id);
  if (!visibleTo(c, user.id, groups, isAdmin)) return { ok: false, error: "This test isn't available to you." };
  const existing = await activeAttempt(c.id, user.id, preview);
  if (existing && !isExpired(c, existing)) {
    const lock = lockdownOk(c, session, preview);
    if (!lock.ok) return { ok: false, error: "This test has to be taken in lockdown mode.", need: lock.need };
    return { ok: true, attemptId: existing.id };
  }
  if (existing) await finalizeAttempt(existing.id, "expired");
  if (!preview) {
    const av = availability(c);
    if (av.state !== "open") {
      const msg: Record<string, string> = {
        draft: "This test isn't published yet.",
        scheduled: "This test hasn't opened yet.",
        waiting: "Waiting for the start.",
        countdown: "Starting in a moment.",
        closed: "This test is closed.",
      };
      return { ok: false, error: msg[av.state] ?? "Not available." };
    }
    if (c.visibility === "code" && !isAdmin) {
      if (!opts.code || opts.code.trim().toUpperCase() !== (c.accessCode ?? "").toUpperCase()) {
        return { ok: false, error: "Enter the access code to start." };
      }
    }
    const lock = lockdownOk(c, session, preview);
    if (!lock.ok) return { ok: false, error: "This test has to be taken in lockdown mode.", need: lock.need };
    const past = (await attemptsFor(c.id, user.id)).filter((a) => !a.isPreview);
    if (past.length >= c.maxAttempts) return { ok: false, error: "You've used all your attempts." };
  }
  const items = await getItems(c.id);
  const seed = randomSeed();
  const d = await db();
  const id = newId();
  const prior = (await attemptsFor(c.id, user.id)).filter((a) => a.isPreview === preview).length;
  await d.insert(attempts).values({
    id,
    contestId: c.id,
    userId: user.id,
    attemptNo: prior + 1,
    isPreview: preview,
    seed,
    order: orderFor(items, seed, c.shuffleItems),
    startedAt: new Date(),
    maxScore: items.reduce((s, i) => s + i.points, 0),
    client: opts.client ?? { kind: session.kind },
    lastActiveAt: new Date(),
  });
  return { ok: true, attemptId: id };
}

export async function loadAttempt(attemptId: string) {
  const d = await db();
  const [row] = await d
    .select({ attempt: attempts, contest: contests })
    .from(attempts)
    .innerJoin(contests, eq(contests.id, attempts.contestId))
    .where(eq(attempts.id, attemptId))
    .limit(1);
  return row ?? null;
}

export async function getAnswers(attemptId: string): Promise<AnswerRow[]> {
  const d = await db();
  return d.select().from(answers).where(eq(answers.attemptId, attemptId));
}

/** Best code score for each code item in an attempt, as a 0..1 fraction. */
export async function codeFractions(attemptId: string, items: ItemRow[]): Promise<Map<string, number>> {
  const codeItems = items.filter((i) => i.type === "code");
  const out = new Map<string, number>();
  if (!codeItems.length) return out;
  const d = await db();
  const subs = await d
    .select({ itemId: submissions.itemId, passed: submissions.passed, total: submissions.total, verdict: submissions.verdict })
    .from(submissions)
    .where(and(eq(submissions.attemptId, attemptId), inArray(submissions.itemId, codeItems.map((i) => i.id))));
  for (const it of codeItems) {
    const partial = (it.config as { partial?: boolean }).partial !== false;
    let best = 0;
    for (const s of subs.filter((x) => x.itemId === it.id)) {
      const f = s.verdict === "AC" ? 1 : partial && s.total ? s.passed / s.total : 0;
      best = Math.max(best, f);
    }
    out.set(it.id, best);
  }
  return out;
}

export async function recomputeScore(attemptId: string) {
  const d = await db();
  const [{ total }] = await d
    .select({ total: sql<number>`coalesce(sum(${answers.score}), 0)::float` })
    .from(answers)
    .where(eq(answers.attemptId, attemptId));
  await d.update(attempts).set({ score: total }).where(eq(attempts.id, attemptId));
  return total;
}

/** Grades everything gradable, closes the attempt and returns ids of items waiting on review. */
export async function finalizeAttempt(attemptId: string, status: "submitted" | "expired") {
  const loaded = await loadAttempt(attemptId);
  if (!loaded) return null;
  const { attempt } = loaded;
  if (attempt.status !== "active") return { pending: [] as string[], already: true };
  const items = await getItems(attempt.contestId);
  const existing = new Map((await getAnswers(attemptId)).map((a) => [a.itemId, a]));
  const codes = await codeFractions(attemptId, items);
  const d = await db();
  const pending: string[] = [];
  for (const it of items) {
    const a = existing.get(it.id);
    if (it.type === "code") {
      const f = codes.get(it.id) ?? 0;
      await upsertAnswer(attemptId, it, {
        score: f * it.points,
        maxScore: it.points,
        status: "graded",
        correct: f === 1,
        gradedBy: "auto",
      });
      continue;
    }
    // Rows that only hold time on the question have nothing to grade.
    if (!a || (a.status === "empty" && a.state == null)) continue;
    if (needsReview(it)) {
      if (a.status !== "graded") pending.push(it.id);
      continue;
    }
    const g = gradeItem(it, attempt.seed, a.response, a.state);
    if (g.fraction !== null) {
      await d
        .update(answers)
        .set({ score: g.fraction * it.points, maxScore: it.points, status: "graded", correct: g.fraction === 1, gradedBy: "auto" })
        .where(and(eq(answers.attemptId, attemptId), eq(answers.itemId, it.id)));
    }
  }
  const score = await recomputeScore(attemptId);
  await d
    .update(attempts)
    .set({ status, submittedAt: new Date(), maxScore: items.reduce((s, i) => s + i.points, 0), score })
    .where(and(eq(attempts.id, attemptId), eq(attempts.status, "active")));
  return { pending, already: false };
}

export async function upsertAnswer(attemptId: string, item: ItemRow, patch: Partial<typeof answers.$inferInsert>) {
  const d = await db();
  await d
    .insert(answers)
    .values({ attemptId, itemId: item.id, maxScore: item.points, ...patch })
    .onConflictDoUpdate({ target: [answers.attemptId, answers.itemId], set: patch });
}
