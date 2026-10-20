import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { listProblems } from "@/lib/problems";
import { db } from "@/lib/db";
import { problemTests } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { Page, PageHeader, Empty } from "@/components/ui/page";
import { LinkButton } from "@/components/ui/button";
import { Difficulty } from "@/components/problems/difficulty";
import { PublishToggle } from "@/components/admin/publish-toggle";
import { pluralize } from "@/lib/format";

export const metadata: Metadata = { title: "Manage problems" };

export default async function AdminProblems() {
  const { user } = await requireAdmin();
  const rows = await listProblems(user.id, true);
  const d = await db();
  const counts = await d
    .select({ problemId: problemTests.problemId, n: sql<number>`count(*)::int` })
    .from(problemTests)
    .groupBy(problemTests.problemId);
  const testCount = new Map(counts.map((c) => [c.problemId, c.n]));
  return (
    <Page wide>
      <PageHeader
        title="Problems"
        meta={<span>{pluralize(rows.length, "problem")}</span>}
        actions={
          <LinkButton href="/admin/problems/new" variant="primary" icon={<Plus className="size-4" />}>
            New problem
          </LinkButton>
        }
      />
      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <Empty title="No problems yet" action={<LinkButton href="/admin/problems/new">Create one</LinkButton>} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Difficulty</th>
                <th className="hidden md:table-cell">Topics</th>
                <th className="text-right">Tests</th>
                <th className="text-right">Solved by</th>
                <th className="text-right">Submissions</th>
                <th>Practice</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/admin/problems/${r.id}`} className="font-medium hover:underline">
                      {r.title}
                    </Link>
                  </td>
                  <td>
                    <Difficulty value={r.difficulty} />
                  </td>
                  <td className="hidden text-ink-2 md:table-cell">{r.tags.join(", ")}</td>
                  <td className="num text-right text-ink-2">{testCount.get(r.id) ?? 0}</td>
                  <td className="num text-right text-ink-2">{r.solvers}</td>
                  <td className="num text-right text-ink-2">{r.attempts}</td>
                  <td>
                    <PublishToggle id={r.id} published={r.published} kind="problem" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Page>
  );
}
