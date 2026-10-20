import type { Metadata } from "next";
import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { attempts, contestItems, contests } from "@/lib/db/schema";
import { testStatus } from "@/lib/tests/status";
import { getSettings } from "@/lib/settings";
import { formatDate } from "@/lib/format";
import { RowLink } from "@/components/ui/row-link";
import { Page, PageHeader, Empty } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { NewTestButton } from "@/components/admin/tests/new-test";

export const metadata: Metadata = { title: "Manage tests" };

export default async function AdminTests() {
  await requireAdmin();
  const d = await db();
  const [rows, items, taken, settings] = await Promise.all([
    d.select().from(contests).orderBy(desc(contests.updatedAt)),
    d
      .select({ id: contestItems.contestId, n: sql<number>`count(*)::int`, pts: sql<number>`coalesce(sum(${contestItems.points}),0)::float` })
      .from(contestItems)
      .groupBy(contestItems.contestId),
    d
      .select({
        id: attempts.contestId,
        done: sql<number>`count(*) filter (where ${attempts.status} <> 'active')::int`,
        active: sql<number>`count(*) filter (where ${attempts.status} = 'active')::int`,
        avg: sql<number | null>`avg(${attempts.score}) filter (where ${attempts.status} <> 'active')::float`,
        flagged: sql<number>`count(*) filter (where ${attempts.integrity}->>'level' in ('medium','high'))::int`,
      })
      .from(attempts)
      .where(sql`${attempts.isPreview} = false`)
      .groupBy(attempts.contestId),
    getSettings(),
  ]);
  const itemsBy = new Map(items.map((i) => [i.id, i]));
  const takenBy = new Map(taken.map((t) => [t.id, t]));
  return (
    <Page wide>
      <PageHeader title="Tests" meta={<span>{rows.length} tests</span>} actions={<NewTestButton />} />
      <div className="card overflow-x-auto">
        {rows.length === 0 ? (
          <Empty title="No tests yet" action={<NewTestButton label="Create a test" />} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th className="hidden md:table-cell">Format</th>
                <th className="text-right">Questions</th>
                <th className="text-right">Submitted</th>
                <th className="hidden text-right sm:table-cell">Average</th>
                <th className="hidden text-right lg:table-cell">Flagged</th>
                <th className="hidden lg:table-cell">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const st = testStatus(c);
                const it = itemsBy.get(c.id);
                const t = takenBy.get(c.id);
                return (
                  <RowLink key={c.id} href={`/admin/tests/${c.id}`}>
                    <td className="max-w-[320px]">
                      <Link href={`/admin/tests/${c.id}`} className="flex items-center gap-2 font-medium hover:underline">
                        <span className="truncate">{c.title}</span>
                        {c.tag && <Badge tone="outline">{c.tag}</Badge>}
                      </Link>
                    </td>
                    <td>
                      <Badge tone={st.tone} dot={st.live}>
                        {st.label}
                      </Badge>
                      {t?.active ? <span className="ml-2 text-xs text-ink-3">{t.active} taking it</span> : null}
                    </td>
                    <td className="hidden text-ink-2 md:table-cell">
                      {c.startMode === "live" ? "Starts together" : "Self-start"}
                      {c.durationMin ? ` · ${c.durationMin} min` : ""}
                      {c.integrity?.lockdown && c.integrity.lockdown !== "none" ? " · Lockdown" : ""}
                    </td>
                    <td className="num text-right text-ink-2">{it?.n ?? 0}</td>
                    <td className="num text-right text-ink-2">{t?.done ?? 0}</td>
                    <td className="num hidden text-right text-ink-2 sm:table-cell">
                      {t?.avg != null && it?.pts ? `${Math.round((t.avg / it.pts) * 100)}%` : "–"}
                    </td>
                    <td className="num hidden text-right lg:table-cell">
                      {t?.flagged ? <span className="text-amber">{t.flagged}</span> : <span className="text-ink-4">0</span>}
                    </td>
                    <td className="hidden text-ink-3 lg:table-cell">{formatDate(c.updatedAt, settings.timezone)}</td>
                  </RowLink>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Page>
  );
}
