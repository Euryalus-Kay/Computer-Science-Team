"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { problems, problemTests } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { newId } from "@/lib/ids";
import { renderMarkdown } from "@/lib/markdown";
import { runBatch } from "@/lib/runner";
import { slugify } from "@/lib/problems";

export type ProblemInput = {
  id?: string | null;
  slug: string;
  title: string;
  statement: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  timeLimitMs: number;
  memoryLimitMb: number;
  checker: "tokens" | "exact" | "float" | "lines";
  starter: Record<string, string>;
  published: boolean;
  tests: { input: string; output: string; sample: boolean; explanation?: string | null }[];
};

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export async function saveProblem(input: ProblemInput): Promise<Result<{ id: string; slug: string }>> {
  const s = await requireAdmin();
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Give the problem a title." };
  const slug = slugify(input.slug || title);
  const d = await db();
  const [clash] = await d
    .select({ id: problems.id })
    .from(problems)
    .where(input.id ? and(eq(problems.slug, slug), ne(problems.id, input.id)) : eq(problems.slug, slug))
    .limit(1);
  if (clash) return { ok: false, error: `Another problem already uses the URL "${slug}".` };
  const values = {
    slug,
    title,
    statement: input.statement,
    difficulty: input.difficulty,
    tags: input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 8),
    timeLimitMs: Math.min(20000, Math.max(250, Math.round(input.timeLimitMs))),
    memoryLimitMb: Math.min(1024, Math.max(16, Math.round(input.memoryLimitMb))),
    checker: input.checker,
    starter: Object.fromEntries(Object.entries(input.starter).filter(([, v]) => v.trim())),
    published: input.published,
    updatedAt: new Date(),
  };
  const id = input.id ?? newId();
  await d.transaction(async (tx) => {
    if (input.id) await tx.update(problems).set(values).where(eq(problems.id, id));
    else await tx.insert(problems).values({ id, ...values, authorId: s.user.id });
    await tx.delete(problemTests).where(eq(problemTests.problemId, id));
    if (input.tests.length) {
      await tx.insert(problemTests).values(
        input.tests.map((t, i) => ({
          problemId: id,
          ord: i,
          input: t.input,
          output: t.output,
          sample: t.sample,
          explanation: t.explanation?.trim() || null,
        })),
      );
    }
  });
  revalidatePath("/admin/problems");
  revalidatePath("/problems");
  return { ok: true, data: { id, slug } };
}

export async function deleteProblem(id: string): Promise<Result> {
  await requireAdmin();
  const d = await db();
  await d.delete(problems).where(eq(problems.id, id));
  revalidatePath("/admin/problems");
  return { ok: true };
}

export async function setProblemPublished(id: string, published: boolean): Promise<Result> {
  await requireAdmin();
  const d = await db();
  await d.update(problems).set({ published, updatedAt: new Date() }).where(eq(problems.id, id));
  revalidatePath("/admin/problems");
  revalidatePath("/problems");
  return { ok: true };
}

export async function previewMarkdown(md: string): Promise<string> {
  await requireAdmin();
  return renderMarkdown(md);
}

/** Runs a reference solution on every test input and returns the outputs. */
export async function generateOutputs(
  language: string,
  code: string,
  inputs: string[],
  timeLimitMs: number,
): Promise<Result<{ outputs: string[]; errors: (string | null)[] }>> {
  await requireAdmin();
  if (!code.trim()) return { ok: false, error: "Paste a reference solution first." };
  const results = await runBatch(language, code, inputs, { timeMs: Math.max(2000, timeLimitMs), memoryMb: 512 });
  return {
    ok: true,
    data: {
      outputs: results.map((r) => r.stdout),
      errors: results.map((r) =>
        r.status === "ok" ? null : `${r.status.replace("_", " ")}: ${(r.compileOutput || r.stderr || r.message || "").slice(0, 300)}`,
      ),
    },
  };
}
