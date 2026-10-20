import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { attempts, groups, problems, users } from "@/lib/db/schema";
import { getContest, getItems } from "@/lib/tests/attempts";
import { aiConfigured, getSettings } from "@/lib/settings";
import { TestEditor } from "@/components/admin/tests/editor/test-editor";

export const metadata: Metadata = { title: "Edit test" };

export default async function EditTest(props: PageProps<"/admin/tests/[id]/edit">) {
  await requireAdmin();
  const { id } = await props.params;
  const c = await getContest(id);
  if (!c) notFound();
  const d = await db();
  const [items, probs, gs, people, [{ n }], settings] = await Promise.all([
    getItems(c.id),
    d.select({ id: problems.id, title: problems.title, difficulty: problems.difficulty }).from(problems).orderBy(asc(problems.title)),
    d.select({ id: groups.id, name: groups.name }).from(groups).orderBy(asc(groups.name)),
    d.select({ id: users.id, name: users.name, username: users.username }).from(users).where(eq(users.disabled, false)).orderBy(asc(users.name)),
    d
      .select({ n: sql<number>`count(*)::int` })
      .from(attempts)
      .where(and(eq(attempts.contestId, c.id), eq(attempts.isPreview, false))),
    getSettings(),
  ]);
  return (
    <TestEditor
      id={c.id}
      initial={{
        title: c.title,
        slug: c.slug,
        description: c.description,
        status: c.status,
        durationMin: c.durationMin,
        opensAt: c.opensAt?.toISOString() ?? null,
        closesAt: c.closesAt?.toISOString() ?? null,
        startMode: c.startMode,
        visibility: c.visibility,
        accessCode: c.accessCode,
        assignees: c.assignees,
        showResults: c.showResults,
        resultsDetail: c.resultsDetail,
        leaderboard: c.leaderboard,
        integrity: c.integrity,
        shuffleItems: c.shuffleItems,
        resources: c.resources,
        maxAttempts: c.maxAttempts,
        tag: c.tag,
      }}
      items={items.map((i) => ({
        id: i.id,
        section: i.section,
        type: i.type,
        title: i.title,
        prompt: i.prompt,
        points: i.points,
        config: i.config,
        grading: i.grading,
        rubric: i.rubric,
        problemId: i.problemId,
      }))}
      problems={probs}
      groups={gs}
      people={people}
      attemptCount={n}
      aiReady={aiConfigured() && settings.aiEnabled}
    />
  );
}
