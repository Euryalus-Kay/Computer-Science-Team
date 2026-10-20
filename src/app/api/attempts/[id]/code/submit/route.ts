import { attemptCtx, closeIfExpired, json } from "@/lib/tests/guard";
import { codeFractions, getItems, recomputeScore, upsertAnswer } from "@/lib/tests/attempts";
import { getProblemById, getTests, judge, recordSubmission } from "@/lib/problems";
import { getLanguage } from "@/lib/runner/languages";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 120;

export async function POST(req: Request, ctx: RouteContext<"/api/attempts/[id]/code/submit">) {
  const { id } = await ctx.params;
  const c = await attemptCtx(req, id);
  if (c instanceof Response) return c;
  if (await closeIfExpired(c)) return json({ error: "Time is up.", closed: true }, 409);
  const itemId = new URL(req.url).searchParams.get("item");
  const items = await getItems(c.attempt.contestId);
  const item = items.find((i) => i.id === itemId && i.type === "code");
  if (!item?.problemId) return json({ error: "Unknown question" }, 400);
  const problem = await getProblemById(item.problemId);
  if (!problem) return json({ error: "Problem missing" }, 404);
  const body = (await req.json().catch(() => null)) as { language?: string; code?: string } | null;
  if (!body?.language || !getLanguage(body.language) || !body.code?.trim()) return json({ error: "Write some code first." }, 400);
  const allowed = (item.config as { languages?: string[] }).languages;
  if (allowed?.length && !allowed.includes(body.language)) return json({ error: "That language isn't allowed here." }, 400);
  if (!rateLimit(`submit:${c.session.user.id}`, 10, 60_000).ok) return json({ error: "Too many submissions. Wait a moment." }, 429);
  const outcome = await judge(problem, await getTests(problem.id), body.language, body.code);
  let subId: string | null = null;
  if (outcome.verdict !== "IE") {
    subId = await recordSubmission({
      userId: c.session.user.id,
      problemId: problem.id,
      language: body.language,
      code: body.code,
      outcome,
      attemptId: id,
      itemId: item.id,
    });
    const best = (await codeFractions(id, [item])).get(item.id) ?? 0;
    const now = new Date();
    await upsertAnswer(id, item, {
      response: { language: body.language, submissions: true },
      score: best * item.points,
      maxScore: item.points,
      status: "graded",
      correct: best === 1,
      gradedBy: "auto",
      lastSavedAt: now,
    });
    await recomputeScore(id);
  }
  return json({ id: subId, outcome });
}
