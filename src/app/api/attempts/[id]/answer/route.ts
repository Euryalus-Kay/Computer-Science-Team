import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { answers, attempts } from "@/lib/db/schema";
import { attemptCtx, closeIfExpired, json } from "@/lib/tests/guard";
import { getItems, recomputeScore, upsertAnswer } from "@/lib/tests/attempts";
import { gradeItem, needsReview } from "@/lib/items/engine";

export async function POST(req: Request, ctx: RouteContext<"/api/attempts/[id]/answer">) {
  const { id } = await ctx.params;
  const c = await attemptCtx(req, id);
  if (c instanceof Response) return c;
  if (await closeIfExpired(c)) return json({ error: "Time is up. Your answers were submitted.", closed: true }, 409);
  const body = (await req.json().catch(() => null)) as { itemId?: string; response?: unknown; ms?: number } | null;
  if (!body?.itemId) return json({ error: "Bad request" }, 400);
  const size = JSON.stringify(body.response ?? null).length;
  if (size > 200_000) return json({ error: "Answer is too large." }, 413);
  const items = await getItems(c.attempt.contestId);
  const item = items.find((i) => i.id === body.itemId);
  if (!item || item.type === "code") return json({ error: "Unknown question" }, 400);
  const d = await db();
  const [prev] = await d
    .select()
    .from(answers)
    .where(and(eq(answers.attemptId, id), eq(answers.itemId, item.id)))
    .limit(1);
  const now = new Date();
  const g = gradeItem(item, c.attempt.seed, body.response, prev?.state ?? null);
  const empty = body.response == null || (typeof body.response === "object" && Object.keys(body.response as object).length === 0);
  await upsertAnswer(id, item, {
    response: body.response ?? null,
    status: empty ? "empty" : needsReview(item) ? "pending" : "graded",
    score: g.fraction === null ? null : g.fraction * item.points,
    correct: g.fraction === null ? null : g.fraction === 1,
    gradedBy: g.fraction === null ? null : "auto",
    firstSavedAt: prev?.firstSavedAt ?? now,
    lastSavedAt: now,
    saves: (prev?.saves ?? 0) + 1,
    timeSpentMs: (prev?.timeSpentMs ?? 0) + Math.min(120_000, Math.max(0, Number(body.ms) || 0)),
  });
  const index = c.attempt.order.indexOf(item.id);
  await d
    .update(attempts)
    .set({ lastActiveAt: now, lastItemId: item.id, frontier: Math.max(c.attempt.frontier, index + 1) })
    .where(eq(attempts.id, id));
  await recomputeScore(id);
  return json({ ok: true, savedAt: now.toISOString() });
}
