import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { attempts, contests, submissions, users } from "@/lib/db/schema";
import { overForEveryone } from "@/lib/tests/timing";
import { getSettings } from "@/lib/settings";
import { pts } from "@/lib/format";
import { Page, PageHeader, Empty } from "@/components/ui/page";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Leaderboard" };

type Entry = { userId: string; name: string; value: string; sub?: string };

function Board({ rows, me, empty }: { rows: Entry[]; me: string; empty: string }) {
  if (!rows.length) return <Empty title={empty} icon={<Trophy className="size-6" />} />;
  let place = 0;
  let last = "";
  return (
    <ol className="divide-y divide-line">
      {rows.map((r, i) => {
        if (r.value !== last) place = i + 1;
        last = r.value;
        return (
          <li key={r.userId} className={cn("flex items-center gap-3 px-4 py-2.5", r.userId === me && "bg-accent-soft/50")}>
            <span className={cn("num w-6 text-right font-mono text-sm", place <= 3 ? "font-semibold text-ink" : "text-ink-4")}>{place}</span>
            <Avatar name={r.name} size={26} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {r.name}
              {r.userId === me && <span className="ml-1.5 text-xs font-normal text-ink-3">you</span>}
            </span>
            {r.sub && <span className="hidden text-xs text-ink-3 sm:inline">{r.sub}</span>}
            <span className="num w-16 text-right text-sm font-semibold">{r.value}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default async function LeaderboardPage(props: PageProps<"/leaderboard">) {
  const { user } = await requireUser();
  const sp = await props.searchParams;
  const tab = (Array.isArray(sp.t) ? sp.t[0] : sp.t) ?? "";
  const d = await db();
  const settings = await getSettings();

  const all = await d.select().from(contests).where(and(eq(contests.status, "published"), sql`${contests.leaderboard} <> 'off'`)).orderBy(desc(contests.updatedAt));
  const shown = all.filter((c) => c.leaderboard === "live" || overForEveryone(c));
  const current = tab ? shown.find((c) => c.id === tab) : null;
  const practiceOn = settings.practiceLeaderboard;
  const active = current ? current.id : practiceOn ? "practice" : (shown[0]?.id ?? "practice");
  const test = shown.find((c) => c.id === active) ?? null;

  let rows: Entry[] = [];
  if (active === "practice" && practiceOn) {
    const solved = await d
      .select({
        userId: submissions.userId,
        name: users.name,
        n: sql<number>`count(distinct ${submissions.problemId}) filter (where ${submissions.verdict} = 'AC')::int`,
        tries: sql<number>`count(*)::int`,
      })
      .from(submissions)
      .innerJoin(users, eq(users.id, submissions.userId))
      .where(and(sql`${submissions.attemptId} is null`, eq(users.disabled, false), eq(users.role, "member")))
      .groupBy(submissions.userId, users.name)
      .orderBy(sql`3 desc`, sql`4 asc`)
      .limit(100);
    rows = solved.filter((r) => r.n > 0).map((r) => ({ userId: r.userId, name: r.name, value: String(r.n), sub: `${r.tries} submissions` }));
  } else if (test) {
    const list = await d
      .select({ userId: attempts.userId, name: users.name, score: attempts.score, max: attempts.maxScore, started: attempts.startedAt, submitted: attempts.submittedAt })
      .from(attempts)
      .innerJoin(users, eq(users.id, attempts.userId))
      .where(and(eq(attempts.contestId, test.id), eq(attempts.isPreview, false), inArray(attempts.status, ["submitted", "expired"])))
      .orderBy(desc(attempts.score));
    // Best attempt per person.
    const best = new Map<string, (typeof list)[number]>();
    for (const r of list) if (!best.has(r.userId)) best.set(r.userId, r);
    rows = [...best.values()]
      .sort((a, b) => b.score - a.score || (a.submitted!.getTime() - a.started.getTime()) - (b.submitted!.getTime() - b.started.getTime()))
      .map((r) => ({ userId: r.userId, name: r.name, value: pts(r.score), sub: `${Math.round(((r.submitted ?? r.started).getTime() - r.started.getTime()) / 60000)} min` }));
  }

  const tabs = [...(practiceOn ? [{ id: "practice", label: "Practice" }] : []), ...shown.map((c) => ({ id: c.id, label: c.title }))];
  return (
    <Page className="max-w-[760px]">
      <PageHeader title="Leaderboard" />
      {tabs.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={t.id === "practice" ? "/leaderboard" : `/leaderboard?t=${t.id}`}
              className={cn("rounded-md border px-2.5 py-1 text-sm", active === t.id ? "border-ink bg-ink text-panel" : "border-line-2 text-ink-2 hover:border-ink-3")}
            >
              {t.label}
            </Link>
          ))}
        </div>
      )}
      <div className="card overflow-hidden">
        {active === "practice" && practiceOn && <div className="border-b border-line px-4 py-2.5 text-xs text-ink-3">Problems solved</div>}
        {test && <div className="border-b border-line px-4 py-2.5 text-xs text-ink-3">{test.title}</div>}
        <Board rows={rows} me={user.id} empty={tabs.length ? "No scores yet" : "No leaderboards yet"} />
      </div>
    </Page>
  );
}
