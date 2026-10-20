import { sessionFromRequest } from "@/lib/auth/session";
import { getProblemBySlug, getTests, judge } from "@/lib/problems";
import { forDisplay, runOnce } from "@/lib/runner";
import { getLanguage } from "@/lib/runner/languages";
import { rateLimit } from "@/lib/rate-limit";
import { flagOutsideActivity } from "@/lib/integrity/outside";

export const maxDuration = 60;

export async function POST(req: Request, ctx: RouteContext<"/api/problems/[slug]/run">) {
  const s = await sessionFromRequest(req);
  if (!s) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { slug } = await ctx.params;
  const problem = await getProblemBySlug(slug);
  if (!problem || (!problem.published && s.user.role !== "admin")) return Response.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { language?: string; code?: string; input?: string | null } | null;
  if (!body?.language || !getLanguage(body.language) || typeof body.code !== "string") {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  if (body.code.length > 100_000) return Response.json({ error: "Code is too long." }, { status: 413 });
  const rl = rateLimit(`run:${s.user.id}`, 20, 60_000);
  if (!rl.ok) return Response.json({ error: `Slow down. Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s.` }, { status: 429 });
  await flagOutsideActivity(s.user.id, "problem_run", { problem: slug });
  if (typeof body.input === "string") {
    const r = await runOnce(body.language, body.code, body.input, { timeMs: problem.timeLimitMs, memoryMb: problem.memoryLimitMb });
    return Response.json({ kind: "custom", result: forDisplay(r) });
  }
  const tests = await getTests(problem.id, true);
  const outcome = await judge(problem, tests, body.language, body.code);
  return Response.json({ kind: "samples", outcome });
}
