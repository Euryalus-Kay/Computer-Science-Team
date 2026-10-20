import { sessionFromRequest } from "@/lib/auth/session";
import { askJson, AiUnavailable } from "@/lib/ai/client";
import { runBatch } from "@/lib/runner";

export const maxDuration = 180;

type Draft = {
  title: string;
  statement: string;
  tags: string[];
  solution: string;
  tests: { input: string; sample: boolean; explanation: string }[];
};

const SYSTEM = `You write programming problems for a high school computer science club, in the style of a clean contest site.
Statements are short and precise markdown: a few sentences, then "## Input" and "## Output" sections with exact formats and constraints. Use backticks for variables and values. No story padding.
Write a correct, efficient Python 3 reference solution that reads standard input and prints to standard output.
Write test inputs that exactly follow the input format: 2 or 3 small samples, then edge cases, then a few larger cases that stress the constraints without being huge (each input under 20 KB).`;

/** Claude drafts a problem; the reference solution runs on the judge to produce the expected outputs. */
export async function POST(req: Request) {
  const s = await sessionFromRequest(req);
  if (!s || s.user.role !== "admin") return Response.json({ error: "Admins only." }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { idea?: string; difficulty?: string };
  const idea = String(body.idea ?? "").trim().slice(0, 2000);
  const difficulty = ["easy", "medium", "hard"].includes(String(body.difficulty)) ? String(body.difficulty) : "easy";
  if (!idea) return Response.json({ error: "Describe the problem first." }, { status: 400 });
  let draft: Draft;
  try {
    ({ data: draft } = await askJson<Draft>({
      system: SYSTEM,
      prompt: `Idea: ${idea}\nDifficulty: ${difficulty}\n\nWrite the problem.`,
      maxTokens: 16000,
      effort: "medium",
      schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          statement: { type: "string", description: "Markdown with ## Input and ## Output sections" },
          tags: { type: "array", items: { type: "string" } },
          solution: { type: "string", description: "Python 3 reference solution" },
          tests: {
            type: "array",
            items: {
              type: "object",
              properties: {
                input: { type: "string" },
                sample: { type: "boolean" },
                explanation: { type: "string", description: "One sentence for samples, empty otherwise" },
              },
              required: ["input", "sample", "explanation"],
              additionalProperties: false,
            },
          },
        },
        required: ["title", "statement", "tags", "solution", "tests"],
        additionalProperties: false,
      },
    }));
  } catch (e) {
    const status = e instanceof AiUnavailable ? 501 : 502;
    return Response.json({ error: (e as Error).message }, { status });
  }
  const inputs = draft.tests.slice(0, 30).map((t) => (t.input.endsWith("\n") ? t.input : t.input + "\n"));
  const results = await runBatch("python", draft.solution, inputs, { timeMs: 5000, memoryMb: 512 });
  const tests = draft.tests
    .slice(0, 30)
    .map((t, i) => ({ input: inputs[i], output: results[i]?.stdout ?? "", sample: t.sample, explanation: t.explanation || null, ok: results[i]?.status === "ok" }))
    .filter((t) => t.ok && t.output.trim())
    .map(({ ok: _ok, ...t }) => t);
  if (!tests.length) {
    const why = results.find((r) => r.status !== "ok");
    return Response.json({ error: `The reference solution didn't run: ${(why?.message || why?.stderr || why?.compileOutput || "no output").slice(0, 300)}` }, { status: 502 });
  }
  if (!tests.some((t) => t.sample)) tests[0].sample = true;
  return Response.json({
    title: draft.title.trim(),
    statement: draft.statement.trim(),
    difficulty,
    tags: draft.tags.map((t) => t.toLowerCase().trim()).filter(Boolean).slice(0, 5),
    tests,
    solution: draft.solution,
  });
}
