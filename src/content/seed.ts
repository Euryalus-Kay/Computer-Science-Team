import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { problems, problemTests } from "@/lib/db/schema";
import { newId } from "@/lib/ids";

type SeedProblem = {
  slug: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  timeLimitMs: number;
  checker: "tokens" | "exact" | "float" | "lines";
  statement: string;
  starter: Record<string, string>;
  tests: { input: string; output: string; sample: boolean; explanation: string | null }[];
};

export async function seedProblems(adminId: string | null) {
  const data = (await import("./problems.json")).default as SeedProblem[];
  const d = await db();
  const ids: Record<string, string> = {};
  for (const p of data) {
    const [existing] = await d.select({ id: problems.id }).from(problems).where(eq(problems.slug, p.slug)).limit(1);
    if (existing) {
      ids[p.slug] = existing.id;
      continue;
    }
    const id = newId();
    ids[p.slug] = id;
    await d.insert(problems).values({
      id,
      slug: p.slug,
      title: p.title,
      statement: p.statement,
      difficulty: p.difficulty,
      tags: p.tags,
      timeLimitMs: p.timeLimitMs,
      checker: p.checker,
      starter: p.starter,
      published: true,
      authorId: adminId,
    });
    await d.insert(problemTests).values(
      p.tests.map((t, i) => ({ problemId: id, ord: i, input: t.input, output: t.output, sample: t.sample, explanation: t.explanation })),
    );
  }
  return ids;
}

export async function seedStarterContent(adminId: string) {
  const problemIds = await seedProblems(adminId);
  const { seedTests } = await import("./tests");
  await seedTests(adminId, problemIds);
  const { seedDecks } = await import("./decks");
  await seedDecks(adminId);
}
