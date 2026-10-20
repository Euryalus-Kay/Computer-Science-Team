import { sql } from "drizzle-orm";
import { sessionFromRequest } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { drillStats } from "@/lib/db/schema";
import { TOPIC_BY_ID } from "@/lib/drills/generators";
import { rateLimit } from "@/lib/rate-limit";

/** Records one drill answer: attempts, correct answers and the best streak. */
export async function POST(req: Request) {
  const s = await sessionFromRequest(req);
  if (!s) return Response.json({ error: "Sign in first." }, { status: 401 });
  if (!rateLimit(`drill:${s.user.id}`, 120, 60_000).ok) return Response.json({ error: "Slow down." }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as { topic?: string; correct?: boolean; streak?: number };
  if (!body.topic || !TOPIC_BY_ID.has(body.topic)) return Response.json({ error: "Unknown topic" }, { status: 400 });
  const right = body.correct ? 1 : 0;
  const streak = Math.max(0, Math.min(10_000, Math.round(Number(body.streak) || 0)));
  const d = await db();
  await d
    .insert(drillStats)
    .values({ userId: s.user.id, topic: body.topic, attempted: 1, correct: right, best: streak })
    .onConflictDoUpdate({
      target: [drillStats.userId, drillStats.topic],
      set: {
        attempted: sql`${drillStats.attempted} + 1`,
        correct: sql`${drillStats.correct} + ${right}`,
        best: sql`greatest(${drillStats.best}, ${streak})`,
        updatedAt: new Date(),
      },
    });
  return Response.json({ ok: true });
}
