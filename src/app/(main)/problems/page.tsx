import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { listProblems } from "@/lib/problems";
import { Page, PageHeader } from "@/components/ui/page";
import { ProblemList } from "@/components/problems/problem-list";

export const metadata: Metadata = { title: "Problems" };

export default async function ProblemsPage() {
  const { user } = await requireUser();
  const rows = await listProblems(user.id);
  const solved = rows.filter((r) => r.solved).length;
  return (
    <Page>
      <PageHeader
        title="Problems"
        meta={
          <span className="num">
            {solved} of {rows.length} solved
          </span>
        }
      />
      <ProblemList
        rows={rows.map((r) => ({
          slug: r.slug,
          title: r.title,
          difficulty: r.difficulty,
          tags: r.tags,
          solvers: r.solvers,
          attempts: r.attempts,
          solved: r.solved,
          tried: r.tried,
        }))}
      />
    </Page>
  );
}
