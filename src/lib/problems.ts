import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { problems, problemTests, submissions, type SubmissionDetail } from "@/lib/db/schema";
import { runBatch, verdictOf, type Checker, type Verdict } from "@/lib/runner";
import { newId } from "@/lib/ids";

export type ProblemRow = typeof problems.$inferSelect;
export type TestRow = typeof problemTests.$inferSelect;

export async function getProblemBySlug(slug: string) {
  const d = await db();
  const [p] = await d.select().from(problems).where(eq(problems.slug, slug)).limit(1);
  return p ?? null;
}

export async function getProblemById(id: string) {
  const d = await db();
  const [p] = await d.select().from(problems).where(eq(problems.id, id)).limit(1);
  return p ?? null;
}

export async function getTests(problemId: string, onlySamples = false) {
  const d = await db();
  const where = onlySamples
    ? and(eq(problemTests.problemId, problemId), eq(problemTests.sample, true))
    : eq(problemTests.problemId, problemId);
  return d.select().from(problemTests).where(where).orderBy(desc(problemTests.sample), asc(problemTests.ord), asc(problemTests.id));
}

/** Published problems with per-user solved state and solver counts. */
export async function listProblems(userId: string, includeHidden = false) {
  const d = await db();
  const rows = await d
    .select({
      id: problems.id,
      slug: problems.slug,
      title: problems.title,
      difficulty: problems.difficulty,
      tags: problems.tags,
      published: problems.published,
      createdAt: problems.createdAt,
      solvers: sql<number>`(select count(distinct s.user_id)::int from submissions s where s.problem_id = ${problems.id} and s.verdict = 'AC')`,
      attempts: sql<number>`(select count(*)::int from submissions s where s.problem_id = ${problems.id})`,
      solved: sql<boolean>`exists(select 1 from submissions s where s.problem_id = ${problems.id} and s.user_id = ${userId} and s.verdict = 'AC')`,
      tried: sql<boolean>`exists(select 1 from submissions s where s.problem_id = ${problems.id} and s.user_id = ${userId})`,
    })
    .from(problems)
    .where(includeHidden ? undefined : eq(problems.published, true))
    .orderBy(
      sql`case ${problems.difficulty} when 'easy' then 0 when 'medium' then 1 else 2 end`,
      asc(problems.title),
    );
  return rows;
}

export type JudgeOutcome = {
  verdict: Verdict;
  passed: number;
  total: number;
  timeMs: number | null;
  memoryKb: number | null;
  details: SubmissionDetail[];
  compileOutput?: string;
};

/** Runs code against tests and computes verdicts. Hidden test IO never leaves the server. */
export async function judge(
  problem: Pick<ProblemRow, "timeLimitMs" | "memoryLimitMb" | "checker">,
  tests: Pick<TestRow, "input" | "output" | "sample">[],
  language: string,
  code: string,
): Promise<JudgeOutcome> {
  const results = await runBatch(
    language,
    code,
    tests.map((t) => t.input),
    { timeMs: problem.timeLimitMs, memoryMb: problem.memoryLimitMb },
  );
  let passed = 0;
  let verdict = "AC" as Verdict;
  let timeMs: number | null = null;
  let memoryKb: number | null = null;
  let compileOutput: string | undefined;
  const details: SubmissionDetail[] = results.map((r, i) => {
    const t = tests[i];
    const v = verdictOf(r, t.output, problem.checker as Checker);
    if (v === "AC") passed++;
    else if (verdict === "AC") verdict = v;
    if (r.timeMs !== null) timeMs = Math.max(timeMs ?? 0, r.timeMs);
    if (r.memoryKb !== null) memoryKb = Math.max(memoryKb ?? 0, r.memoryKb);
    if (v === "CE" && !compileOutput) compileOutput = r.compileOutput || r.stderr;
    const d: SubmissionDetail = { verdict: v, timeMs: r.timeMs, memoryKb: r.memoryKb, sample: t.sample };
    if (t.sample) {
      d.input = t.input.slice(0, 4000);
      d.expected = t.output.slice(0, 4000);
      d.output = r.stdout.slice(0, 4000);
      d.message = (r.compileOutput || r.stderr || (v !== "AC" && v !== "WA" ? r.message : "") || "").slice(0, 4000) || undefined;
    } else if (v === "RE" || v === "CE" || v === "IE") {
      d.message = (r.compileOutput || r.message || "").slice(0, 600) || undefined;
    }
    return d;
  });
  if (verdict === "CE") {
    // One compile error shows up on every test; report it once.
    for (const d of details) if (!d.sample) d.message = undefined;
  }
  return { verdict, passed, total: tests.length, timeMs, memoryKb, details, compileOutput };
}

export async function recordSubmission(input: {
  userId: string;
  problemId: string;
  language: string;
  code: string;
  outcome: JudgeOutcome;
  attemptId?: string | null;
  itemId?: string | null;
}) {
  const d = await db();
  const id = newId();
  await d.insert(submissions).values({
    id,
    userId: input.userId,
    problemId: input.problemId,
    attemptId: input.attemptId ?? null,
    itemId: input.itemId ?? null,
    language: input.language,
    code: input.code,
    status: "done",
    verdict: input.outcome.verdict,
    passed: input.outcome.passed,
    total: input.outcome.total,
    timeMs: input.outcome.timeMs,
    memoryKb: input.outcome.memoryKb,
    details: input.outcome.details,
  });
  return id;
}

export async function userSubmissions(userId: string, problemId: string, limit = 20) {
  const d = await db();
  return d
    .select({
      id: submissions.id,
      language: submissions.language,
      verdict: submissions.verdict,
      passed: submissions.passed,
      total: submissions.total,
      timeMs: submissions.timeMs,
      createdAt: submissions.createdAt,
      attemptId: submissions.attemptId,
    })
    .from(submissions)
    .where(and(eq(submissions.userId, userId), eq(submissions.problemId, problemId)))
    .orderBy(desc(submissions.createdAt))
    .limit(limit);
}

export function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "untitled"
  );
}
