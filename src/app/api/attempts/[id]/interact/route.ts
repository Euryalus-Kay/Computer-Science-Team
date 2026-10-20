import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { answers } from "@/lib/db/schema";
import { attemptCtx, closeIfExpired, json } from "@/lib/tests/guard";
import { getItems, recomputeScore, upsertAnswer } from "@/lib/tests/attempts";
import { gradeItem, interactItem } from "@/lib/items/engine";
import { rateLimit } from "@/lib/rate-limit";

/** Moves for puzzles that keep a secret on the server, like the code lock. */
export async function POST(req: Request, ctx: RouteContext<"/api/attempts/[id]/interact">) {
  const { id } = await ctx.params;
  const c = await attemptCtx(req, id);
  if (c instanceof Response) return c;
  if (await closeIfExpired(c)) return json({ error: "Time is up.", closed: true }, 409);
  if (!rateLimit(`interact:${id}`, 60, 60_000).ok) return json({ error: "Slow down." }, 429);
  const body = (await req.json().catch(() => null)) as { itemId?: string; action?: unknown } | null;
  const items = await getItems(c.attempt.contestId);
  const item = items.find((i) => i.id === body?.itemId);
  if (!item) return json({ error: "Unknown question" }, 400);
  const d = await db();
  const [prev] = await d
    .select()
    .from(answers)
    .where(and(eq(answers.attemptId, id), eq(answers.itemId, item.id)))
    .limit(1);
  const r = interactItem(item, c.attempt.seed, prev?.state ?? null, body?.action);
  if (!r) return json({ error: "Not interactive" }, 400);
  if (r.counts === false) {
    // Asking for a hint: keep it, but it isn't an answer.
    await upsertAnswer(id, item, prev ? { state: r.state as object } : { state: r.state as object, status: "empty" });
    return json({ reply: r.reply });
  }
  const g = gradeItem(item, c.attempt.seed, prev?.response ?? null, r.state);
  const now = new Date();
  await upsertAnswer(id, item, {
    state: r.state as object,
    response: prev?.response ?? { interacted: true },
    status: "graded",
    score: (g.fraction ?? 0) * item.points,
    correct: g.fraction === 1,
    gradedBy: "auto",
    firstSavedAt: prev?.firstSavedAt ?? now,
    lastSavedAt: now,
    saves: (prev?.saves ?? 0) + 1,
  });
  await recomputeScore(id);
  return json({ reply: r.reply });
}
