import { attemptCtx, closeIfExpired, json } from "@/lib/tests/guard";
import { getItems } from "@/lib/tests/attempts";
import { getProblemById, getTests, judge } from "@/lib/problems";
import { forDisplay, runOnce } from "@/lib/runner";
import { getLanguage } from "@/lib/runner/languages";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

export async function POST(req: Request, ctx: RouteContext<"/api/attempts/[id]/code/run">) {
  const { id } = await ctx.params;
  const c = await attemptCtx(req, id);
  if (c instanceof Response) return c;
  if (await closeIfExpired(c)) return json({ error: "Time is up.", closed: true }, 409);
  const itemId = new URL(req.url).searchParams.get("item");
  const item = (await getItems(c.attempt.contestId)).find((i) => i.id === itemId && i.type === "code");
  if (!item?.problemId) return json({ error: "Unknown question" }, 400);
  const problem = await getProblemById(item.problemId);
  if (!problem) return json({ error: "Problem missing" }, 404);
  const body = (await req.json().catch(() => null)) as { language?: string; code?: string; input?: string | null } | null;
  if (!body?.language || !getLanguage(body.language) || typeof body.code !== "string") return json({ error: "Bad request" }, 400);
  if (!rateLimit(`run:${c.session.user.id}`, 20, 60_000).ok) return json({ error: "Slow down a little." }, 429);
  if (typeof body.input === "string") {
    const r = await runOnce(body.language, body.code, body.input, { timeMs: problem.timeLimitMs, memoryMb: problem.memoryLimitMb });
    return json({ kind: "custom", result: forDisplay(r) });
  }
  const outcome = await judge(problem, await getTests(problem.id, true), body.language, body.code);
  return json({ kind: "samples", outcome });
}
