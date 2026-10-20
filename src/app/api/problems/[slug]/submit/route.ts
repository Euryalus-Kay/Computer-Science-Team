import { sessionFromRequest } from "@/lib/auth/session";
import { getProblemBySlug, getTests, judge, recordSubmission } from "@/lib/problems";
import { getLanguage } from "@/lib/runner/languages";
import { rateLimit } from "@/lib/rate-limit";
import { flagOutsideActivity } from "@/lib/integrity/outside";

export const maxDuration = 120;

export async function POST(req: Request, ctx: RouteContext<"/api/problems/[slug]/submit">) {
  const s = await sessionFromRequest(req);
  if (!s) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { slug } = await ctx.params;
  const problem = await getProblemBySlug(slug);
  if (!problem || (!problem.published && s.user.role !== "admin")) return Response.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { language?: string; code?: string } | null;
  if (!body?.language || !getLanguage(body.language) || typeof body.code !== "string" || !body.code.trim()) {
    return Response.json({ error: "Write some code first." }, { status: 400 });
  }
  if (body.code.length > 100_000) return Response.json({ error: "Code is too long." }, { status: 413 });
  const rl = rateLimit(`submit:${s.user.id}`, 8, 60_000);
  if (!rl.ok) return Response.json({ error: `Too many submissions. Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s.` }, { status: 429 });
  await flagOutsideActivity(s.user.id, "problem_submit", { problem: slug });
  const tests = await getTests(problem.id);
  if (tests.length === 0) return Response.json({ error: "This problem has no tests yet." }, { status: 409 });
  const outcome = await judge(problem, tests, body.language, body.code);
  const id = outcome.verdict === "IE" ? null : await recordSubmission({ userId: s.user.id, problemId: problem.id, language: body.language, code: body.code, outcome });
  return Response.json({ id, outcome });
}
