import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { integrityEvents, submissions, users } from "@/lib/db/schema";
import { getAnswers, getItems, loadAttempt } from "@/lib/tests/attempts";
import { describeAnswer, publicItem } from "@/lib/items/engine";
import { summarizeAttempt } from "@/lib/integrity/analyze";
import { eventLabel } from "@/lib/integrity/events";
import { remainingMs } from "@/lib/tests/timing";
import { aiConfigured, getSettings } from "@/lib/settings";
import { AttemptReview, type ReviewItem } from "@/components/admin/tests/attempt-review";

export const metadata: Metadata = { title: "Attempt" };

export default async function AttemptPage(props: PageProps<"/admin/tests/[id]/attempts/[attemptId]">) {
  await requireAdmin();
  const { id, attemptId } = await props.params;
  const loaded = await loadAttempt(attemptId);
  if (!loaded || loaded.contest.id !== id) notFound();
  const { attempt, contest } = loaded;
  const d = await db();
  const [user] = await d.select().from(users).where(eq(users.id, attempt.userId)).limit(1);
  const items = await getItems(contest.id);
  const ordered = attempt.order.map((iid) => items.find((i) => i.id === iid)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  for (const it of items) if (!ordered.includes(it)) ordered.push(it);
  const answers = new Map((await getAnswers(attempt.id)).map((a) => [a.itemId, a]));
  const summary = attempt.status === "active" || !attempt.integrity ? await summarizeAttempt(attempt.id) : attempt.integrity;
  const events = await d.select().from(integrityEvents).where(eq(integrityEvents.attemptId, attempt.id)).orderBy(asc(integrityEvents.at)).limit(2000);
  const subs = await d
    .select()
    .from(submissions)
    .where(and(eq(submissions.attemptId, attempt.id)))
    .orderBy(desc(submissions.passed), desc(submissions.createdAt));
  const settings = await getSettings();

  const reviewItems: ReviewItem[] = await Promise.all(
    ordered.map(async (it, i) => {
      const pub = await publicItem(it, attempt.seed);
      const a = answers.get(it.id);
      const best = subs.find((s) => s.itemId === it.id);
      return {
        id: it.id,
        n: i + 1,
        title: it.title || `Question ${i + 1}`,
        section: it.section,
        type: it.type,
        widget: it.type === "widget" ? String((it.config as { widget?: string }).widget) : undefined,
        points: it.points,
        grading: it.grading,
        promptHtml: pub.promptHtml,
        pub,
        key: describeAnswer(it, attempt.seed),
        rubric: it.rubric,
        answer: a
          ? {
              response: a.response,
              state: a.state,
              score: a.score,
              status: a.status,
              feedback: a.feedback,
              note: a.note,
              gradedBy: a.gradedBy,
              timeSpentMs: a.timeSpentMs,
              saves: a.saves,
              firstSavedAt: a.firstSavedAt?.getTime() ?? null,
            }
          : null,
        code: best
          ? { language: best.language, code: best.code, verdict: best.verdict, passed: best.passed, total: best.total, count: subs.filter((s) => s.itemId === it.id).length }
          : null,
      };
    }),
  );

  const titleOf = new Map(ordered.map((it, i) => [it.id, `${i + 1}. ${it.title || "Question"}`]));
  return (
    <AttemptReview
      testId={contest.id}
      timezone={settings.timezone}
      aiReady={aiConfigured() && settings.aiEnabled}
      attempt={{
        id: attempt.id,
        status: attempt.status,
        preview: attempt.isPreview,
        score: attempt.score,
        maxScore: attempt.maxScore,
        startedAt: attempt.startedAt.getTime(),
        submittedAt: attempt.submittedAt?.getTime() ?? null,
        remainingMs: attempt.status === "active" ? remainingMs(contest, attempt) : null,
        reached: attempt.frontier,
        endedOn: attempt.lastItemId && ordered.findIndex((it) => it.id === attempt.lastItemId) >= 0 ? ordered.findIndex((it) => it.id === attempt.lastItemId) + 1 : null,
        client: attempt.client ?? { kind: "web" },
        reviewed: attempt.reviewed,
        aiReview: attempt.aiReview ?? null,
        extraSeconds: attempt.extraSeconds,
      }}
      user={{ id: user.id, name: user.name, username: user.username, grade: user.grade }}
      summary={summary}
      items={reviewItems}
      events={events.map((e) => ({
        id: e.id,
        at: e.at.getTime(),
        type: e.type,
        label: eventLabel(e.type, e.data),
        severity: e.severity,
        item: e.itemId ? (titleOf.get(e.itemId) ?? null) : null,
        data: e.data ?? null,
      }))}
    />
  );
}
