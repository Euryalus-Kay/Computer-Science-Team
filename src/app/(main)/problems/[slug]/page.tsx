import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getProblemBySlug, getTests, userSubmissions } from "@/lib/problems";
import { renderMarkdown } from "@/lib/markdown";
import { Workspace } from "@/components/problems/workspace";
import { Difficulty } from "@/components/problems/difficulty";

export async function generateMetadata(props: PageProps<"/problems/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const p = await getProblemBySlug(slug);
  return { title: p?.title ?? "Problem" };
}

export default async function ProblemPage(props: PageProps<"/problems/[slug]">) {
  const { user } = await requireUser();
  const { slug } = await props.params;
  const problem = await getProblemBySlug(slug);
  if (!problem || (!problem.published && user.role !== "admin")) notFound();
  const [samples, subs, html] = await Promise.all([
    getTests(problem.id, true),
    userSubmissions(user.id, problem.id),
    renderMarkdown(problem.statement),
  ]);
  return (
    <Workspace
      storageKey={`problem:${problem.id}`}
      runUrl={`/api/problems/${problem.slug}/run`}
      submitUrl={`/api/problems/${problem.slug}/submit`}
      problem={{
        title: problem.title,
        statementHtml: html,
        samples: samples.map((s) => ({ input: s.input, output: s.output, explanation: s.explanation })),
        timeLimitMs: problem.timeLimitMs,
        memoryLimitMb: problem.memoryLimitMb,
        starter: problem.starter,
      }}
      initialSubmissions={subs.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }))}
      statementHeader={
        <div className="mb-5">
          <div className="mb-3 flex items-center justify-between">
            <Link href="/problems" className="inline-flex items-center gap-1 text-xs text-ink-3 hover:text-ink">
              <ChevronLeft className="size-3.5" /> Problems
            </Link>
            {user.role === "admin" && (
              <Link href={`/admin/problems/${problem.id}`} className="inline-flex items-center gap-1 text-xs text-ink-3 hover:text-ink">
                <Pencil className="size-3" /> Edit
              </Link>
            )}
          </div>
          <h1 className="text-xl font-semibold tracking-[-0.01em]">{problem.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Difficulty value={problem.difficulty} />
            {problem.tags.map((t) => (
              <span key={t} className="rounded bg-panel-3 px-1.5 py-0.5 text-xs text-ink-2">
                {t}
              </span>
            ))}
          </div>
        </div>
      }
    />
  );
}
