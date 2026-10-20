import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { getProblemById, getTests } from "@/lib/problems";
import { aiConfigured, getSettings } from "@/lib/settings";
import { Page } from "@/components/ui/page";
import { ProblemEditor } from "@/components/admin/problem-editor";

export const metadata: Metadata = { title: "Edit problem" };

export default async function EditProblem(props: PageProps<"/admin/problems/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  const p = await getProblemById(id);
  if (!p) notFound();
  const [tests, s] = await Promise.all([getTests(p.id), getSettings()]);
  return (
    <Page wide>
      <ProblemEditor
        aiAvailable={aiConfigured() && s.aiEnabled}
        initial={{
          id: p.id,
          slug: p.slug,
          title: p.title,
          statement: p.statement,
          difficulty: p.difficulty,
          tags: p.tags,
          timeLimitMs: p.timeLimitMs,
          memoryLimitMb: p.memoryLimitMb,
          checker: p.checker,
          starter: p.starter,
          published: p.published,
          tests: tests
            .sort((a, b) => a.ord - b.ord)
            .map((t) => ({ input: t.input, output: t.output, sample: t.sample, explanation: t.explanation })),
        }}
      />
    </Page>
  );
}
