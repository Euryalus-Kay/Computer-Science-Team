import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { attempts, contests, users } from "@/lib/db/schema";
import { getSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/format";
import { Page, PageHeader, Empty } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { RowLink } from "@/components/ui/row-link";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Integrity" };

const LEVEL: Record<string, { label: string; tone: "neutral" | "outline" | "amber" | "red" }> = {
  clear: { label: "Clear", tone: "neutral" },
  low: { label: "Low", tone: "outline" },
  medium: { label: "Review", tone: "amber" },
  high: { label: "High", tone: "red" },
};
const VERDICT: Record<string, string> = { no_concern: "No concern", minor: "Minor", review: "Worth a look", likely: "Likely help" };

export default async function IntegrityPage(props: PageProps<"/admin/integrity">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const show = (Array.isArray(sp.show) ? sp.show[0] : sp.show) ?? "flagged";
  const test = (Array.isArray(sp.test) ? sp.test[0] : sp.test) ?? "";
  const d = await db();
  const where = [eq(attempts.isPreview, false), sql`${attempts.status} <> 'active'`];
  if (test) where.push(eq(attempts.contestId, test));
  if (show === "flagged") where.push(sql`${attempts.integrity}->>'level' in ('medium','high')`, eq(attempts.reviewed, false));
  if (show === "high") where.push(sql`${attempts.integrity}->>'level' = 'high'`);
  const [rows, tests, settings] = await Promise.all([
    d
      .select({ a: attempts, name: users.name, title: contests.title })
      .from(attempts)
      .innerJoin(users, eq(users.id, attempts.userId))
      .innerJoin(contests, eq(contests.id, attempts.contestId))
      .where(and(...where))
      .orderBy(sql`coalesce((${attempts.integrity}->>'risk')::int, 0) desc`, desc(attempts.startedAt))
      .limit(300),
    d.select({ id: contests.id, title: contests.title }).from(contests).orderBy(desc(contests.updatedAt)),
    getSettings(),
  ]);
  const href = (p: Record<string, string>) => {
    const q = new URLSearchParams({ show, ...(test ? { test } : {}), ...p });
    for (const [k, v] of [...q.entries()]) if (!v) q.delete(k);
    return `/admin/integrity?${q.toString()}`;
  };
  return (
    <Page wide>
      <PageHeader title="Integrity" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-md bg-panel-3 p-0.5 text-sm">
          {[
            ["flagged", "To review"],
            ["high", "High"],
            ["all", "All"],
          ].map(([k, label]) => (
            <Link key={k} href={href({ show: k })} className={cn("h-7 rounded-[5px] px-2.5 leading-7 text-ink-3", show === k && "bg-panel font-medium text-ink shadow-card")}>
              {label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Link href={href({ test: "" })} className={cn("rounded-md border px-2.5 py-1 text-xs", !test ? "border-ink bg-ink text-panel" : "border-line-2 text-ink-2 hover:border-ink-3")}>
            All tests
          </Link>
          {tests.slice(0, 8).map((t) => (
            <Link key={t.id} href={href({ test: t.id })} className={cn("rounded-md border px-2.5 py-1 text-xs", test === t.id ? "border-ink bg-ink text-panel" : "border-line-2 text-ink-2 hover:border-ink-3")}>
              {t.title}
            </Link>
          ))}
        </div>
      </div>
      <div className="card overflow-x-auto">
        {rows.length === 0 ? (
          <Empty title={show === "flagged" ? "Nothing to review" : "No attempts"} icon={<ShieldCheck className="size-6" />} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="hidden md:table-cell">Test</th>
                <th>Level</th>
                <th>Top flag</th>
                <th className="text-right">Left</th>
                <th className="text-right">Away</th>
                <th className="text-right">Pastes</th>
                <th className="hidden lg:table-cell">Claude</th>
                <th className="hidden lg:table-cell">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ a, name, title }) => {
                const s = a.integrity;
                const l = LEVEL[s?.level ?? "clear"];
                return (
                  <RowLink key={a.id} href={`/admin/tests/${a.contestId}/attempts/${a.id}`}>
                    <td className="font-medium">
                      {name}
                      {a.reviewed && <span className="ml-2 text-xs font-normal text-ink-4">reviewed</span>}
                    </td>
                    <td className="hidden max-w-[200px] truncate text-ink-2 md:table-cell">{title}</td>
                    <td>
                      <Badge tone={l.tone}>{l.label}</Badge>
                    </td>
                    <td className="max-w-[340px] truncate text-ink-2">{s?.flags[0]?.message ?? "–"}</td>
                    <td className="num text-right text-ink-2">{s?.stats.leaves ?? 0}</td>
                    <td className="num text-right text-ink-2">{s ? (s.stats.awayMs >= 60000 ? `${Math.round(s.stats.awayMs / 60000)}m` : `${Math.round(s.stats.awayMs / 1000)}s`) : "–"}</td>
                    <td className="num text-right text-ink-2">{s?.stats.pastes ?? 0}</td>
                    <td className="hidden text-ink-2 lg:table-cell">{a.aiReview ? VERDICT[a.aiReview.verdict] : "–"}</td>
                    <td className="hidden text-ink-3 lg:table-cell">{formatDateTime(a.submittedAt, settings.timezone)}</td>
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
