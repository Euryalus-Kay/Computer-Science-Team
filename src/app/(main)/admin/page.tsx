import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { Plus, UserPlus, MonitorPlay, Megaphone, ArrowRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { answers, attempts, contests, problems, submissions, users } from "@/lib/db/schema";
import { testStatus } from "@/lib/tests/status";
import { getSettings } from "@/lib/settings";
import { relativeTime } from "@/lib/format";
import { VERDICT_LABEL } from "@/lib/runner";
import { Page, PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Overview" };

export default async function AdminOverview() {
  await requireAdmin();
  const d = await db();
  const week = new Date(Date.now() - 7 * 864e5);
  const toReview = and(eq(attempts.isPreview, false), eq(attempts.reviewed, false), sql`${attempts.integrity}->>'level' in ('medium','high')`);
  const [[m], [subs], allTests, flagged, [flaggedTotal], pending, recent, settings] = await Promise.all([
    d
      .select({
        total: sql<number>`count(*) filter (where ${users.role} = 'member' and not ${users.disabled})::int`,
        active: sql<number>`count(*) filter (where ${users.role} = 'member' and not ${users.disabled} and ${users.lastSeenAt} > ${week.toISOString()}::timestamptz)::int`,
      })
      .from(users),
    d
      .select({ n: sql<number>`count(*)::int`, solved: sql<number>`count(distinct (${submissions.userId}, ${submissions.problemId})) filter (where ${submissions.verdict} = 'AC')::int` })
      .from(submissions)
      .where(and(gt(submissions.createdAt, week), sql`${submissions.attemptId} is null`)),
    d.select().from(contests).where(sql`${contests.status} <> 'archived'`).orderBy(desc(contests.updatedAt)),
    d
      .select({ id: attempts.id, contestId: attempts.contestId, title: contests.title, name: users.name, integrity: attempts.integrity })
      .from(attempts)
      .innerJoin(contests, eq(contests.id, attempts.contestId))
      .innerJoin(users, eq(users.id, attempts.userId))
      .where(toReview)
      .orderBy(desc(attempts.startedAt))
      .limit(8),
    d.select({ n: sql<number>`count(*)::int` }).from(attempts).where(toReview),
    d
      .select({ contestId: attempts.contestId, title: contests.title, n: sql<number>`count(*)::int` })
      .from(answers)
      .innerJoin(attempts, eq(attempts.id, answers.attemptId))
      .innerJoin(contests, eq(contests.id, attempts.contestId))
      .where(and(eq(answers.status, "pending"), eq(attempts.isPreview, false)))
      .groupBy(attempts.contestId, contests.title),
    d
      .select({ id: submissions.id, at: submissions.createdAt, verdict: submissions.verdict, name: users.name, problem: problems.title, slug: problems.slug })
      .from(submissions)
      .innerJoin(users, eq(users.id, submissions.userId))
      .innerJoin(problems, eq(problems.id, submissions.problemId))
      .where(sql`${submissions.attemptId} is null`)
      .orderBy(desc(submissions.createdAt))
      .limit(8),
    getSettings(),
  ]);
  const running = allTests.filter((c) => {
    const st = testStatus(c);
    return st.live || st.label === "Open" || st.label === "Ready to start";
  });
  const working = running.length
    ? await d
        .select({ contestId: attempts.contestId, n: sql<number>`count(*)::int` })
        .from(attempts)
        .where(and(inArray(attempts.contestId, running.map((c) => c.id)), eq(attempts.status, "active"), eq(attempts.isPreview, false)))
        .groupBy(attempts.contestId)
    : [];
  const workingBy = new Map(working.map((w) => [w.contestId, w.n]));

  const toGrade = pending.reduce((t, p) => t + p.n, 0);
  const stats = [
    { label: "Members", value: m.total, sub: `${m.active} active this week` },
    { label: "Tests running", value: running.filter((c) => testStatus(c).live || testStatus(c).label === "Open").length, sub: `${allTests.length} in total` },
    { label: "Practice submissions", value: subs.n, sub: `${subs.solved} ${subs.solved === 1 ? "solve" : "solves"} this week` },
    { label: "To review", value: flaggedTotal.n, sub: toGrade ? `${toGrade} ${toGrade === 1 ? "answer" : "answers"} to grade` : "Nothing to grade" },
  ];

  return (
    <Page wide>
      <PageHeader
        title="Overview"
        meta={<span>{settings.siteName}</span>}
        actions={
          <>
            <LinkButton href="/admin/members" icon={<UserPlus className="size-4" />}>
              Members
            </LinkButton>
            <LinkButton href="/admin/posts" icon={<Megaphone className="size-4" />}>
              Post
            </LinkButton>
            <LinkButton href="/admin/board" icon={<MonitorPlay className="size-4" />}>
              Board
            </LinkButton>
            <LinkButton href="/admin/tests" variant="primary" icon={<Plus className="size-4" />}>
              Tests
            </LinkButton>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-panel px-5 py-4">
            <div className="text-xs text-ink-3">{s.label}</div>
            <div className="num mt-1 text-2xl font-semibold tracking-[-0.02em]">{s.value}</div>
            <div className="mt-0.5 text-xs text-ink-3">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-medium text-ink-3">Tests</h2>
          <div className="card divide-y divide-line">
            {running.length === 0 ? (
              <div className="px-4 py-6 text-sm text-ink-3">Nothing running.</div>
            ) : (
              running.map((c) => {
                const st = testStatus(c);
                return (
                  <Link key={c.id} href={`/admin/tests/${c.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-panel-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{c.title}</span>
                      <span className="text-xs text-ink-3">{workingBy.get(c.id) ? `${workingBy.get(c.id)} working` : "No one working"}</span>
                    </span>
                    <Badge tone={st.tone} dot={st.live}>
                      {st.label}
                    </Badge>
                  </Link>
                );
              })
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-medium text-ink-3">Needs a look</h2>
          <div className="card divide-y divide-line">
            {flagged.length === 0 && pending.length === 0 ? (
              <div className="px-4 py-6 text-sm text-ink-3">All clear.</div>
            ) : (
              <>
                {pending.map((p) => (
                  <Link key={p.contestId} href={`/admin/tests/${p.contestId}/results`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-panel-2">
                    <span className="min-w-0 truncate text-sm">
                      <span className="font-medium">{p.n}</span> written answer{p.n === 1 ? "" : "s"} to grade in {p.title}
                    </span>
                    <ArrowRight className="size-3.5 shrink-0 text-ink-4" />
                  </Link>
                ))}
                {flagged.map((f) => (
                  <Link key={f.id} href={`/admin/tests/${f.contestId}/attempts/${f.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-panel-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {f.name} <span className="font-normal text-ink-3">· {f.title}</span>
                      </span>
                      <span className="block truncate text-xs text-ink-3">{f.integrity?.flags[0]?.message}</span>
                    </span>
                    <Badge tone={f.integrity?.level === "high" ? "red" : "amber"}>{f.integrity?.level === "high" ? "High" : "Review"}</Badge>
                  </Link>
                ))}
              </>
            )}
          </div>
        </section>

        <section className="lg:col-span-2">
          <h2 className="mb-2 text-sm font-medium text-ink-3">Recent practice</h2>
          <div className="card divide-y divide-line">
            {recent.length === 0 ? (
              <div className="px-4 py-6 text-sm text-ink-3">No submissions yet.</div>
            ) : (
              recent.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{r.name}</span> <span className="text-ink-3">on</span>{" "}
                    <Link href={`/problems/${r.slug}`} className="hover:underline">
                      {r.problem}
                    </Link>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <Badge tone={r.verdict === "AC" ? "green" : "neutral"}>{r.verdict ? (VERDICT_LABEL[r.verdict as keyof typeof VERDICT_LABEL] ?? r.verdict) : "Running"}</Badge>
                    <span className="w-16 text-right text-xs text-ink-4">{relativeTime(r.at)}</span>
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </Page>
  );
}
