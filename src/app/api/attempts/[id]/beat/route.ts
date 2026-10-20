import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { answers, attempts, integrityEvents } from "@/lib/db/schema";
import { attemptCtx, closeIfExpired, json } from "@/lib/tests/guard";
import { remainingMs, isPaused } from "@/lib/tests/timing";
import { EVENT_TYPES, severityOf, type ClientEvent } from "@/lib/integrity/events";

/** Keeps only small flat values from client-supplied event data. */
function sanitize(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data).slice(0, 20)) {
    const key = k.slice(0, 40);
    if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
    else if (typeof v === "boolean") out[key] = v;
    else if (typeof v === "string") out[key] = v.slice(0, 300);
    else if (Array.isArray(v)) out[key] = v.slice(0, 20).filter((x) => ["string", "number", "boolean"].includes(typeof x)).map((x) => (typeof x === "string" ? x.slice(0, 80) : x));
  }
  return out;
}

/** Heartbeat: time on the current question, integrity events, and the clock. */
export async function POST(req: Request, ctx: RouteContext<"/api/attempts/[id]/beat">) {
  const { id } = await ctx.params;
  const c = await attemptCtx(req, id);
  if (c instanceof Response) return c;
  const body = (await req.json().catch(() => ({}))) as {
    itemId?: string;
    ms?: number;
    times?: Record<string, number>;
    events?: ClientEvent[];
  };
  const d = await db();
  const now = Date.now();
  const events = (Array.isArray(body.events) ? body.events : [])
    .filter((e) => e && EVENT_TYPES.has(e.type))
    .slice(0, 80)
    .map((e) => {
      const at = typeof e.at === "number" ? Math.min(now, Math.max(c.attempt.startedAt.getTime() - 60_000, e.at)) : now;
      const data = sanitize(e.data);
      return {
        attemptId: id,
        contestId: c.contest.id,
        userId: c.session.user.id,
        type: e.type,
        severity: severityOf(e),
        at: new Date(at),
        itemId: typeof e.itemId === "string" ? e.itemId.slice(0, 40) : null,
        data,
      };
    });
  // A second "start" means the test was opened again in a new tab or browser.
  if (events.some((e) => e.type === "start")) {
    const [{ n: starts }] = await d
      .select({ n: sql<number>`count(*)::int` })
      .from(integrityEvents)
      .where(and(eq(integrityEvents.attemptId, id), eq(integrityEvents.type, "start")));
    let seen = starts > 0;
    for (const e of events) {
      if (e.type !== "start") continue;
      if (seen) {
        e.type = "resume";
        e.severity = "low";
      }
      seen = true;
    }
  }
  if (events.length && c.attempt.status === "active") {
    const [{ n }] = await d.select({ n: sql<number>`count(*)::int` }).from(integrityEvents).where(eq(integrityEvents.attemptId, id));
    if (n < 6000) await d.insert(integrityEvents).values(events);
  }
  const closed = await closeIfExpired(c);
  if (!closed) {
    const times: Record<string, number> = { ...(body.times ?? {}) };
    if (body.itemId && body.ms) times[body.itemId] = (times[body.itemId] ?? 0) + Number(body.ms);
    let budget = 60_000;
    for (const [itemId, raw] of Object.entries(times).slice(0, 30)) {
      const ms = Math.min(budget, Math.max(0, Math.round(Number(raw) || 0)));
      if (!ms || !c.attempt.order.includes(itemId)) continue;
      budget -= ms;
      await d
        .insert(answers)
        .values({ attemptId: id, itemId, timeSpentMs: ms, firstViewedAt: new Date(), status: "empty" })
        .onConflictDoUpdate({
          target: [answers.attemptId, answers.itemId],
          set: { timeSpentMs: sql`${answers.timeSpentMs} + ${ms}`, firstViewedAt: sql`coalesce(${answers.firstViewedAt}, now())` },
        });
    }
    await d.update(attempts).set({ lastActiveAt: new Date(), lastItemId: body.itemId ?? c.attempt.lastItemId }).where(eq(attempts.id, id));
  }
  const [fresh] = await d.select().from(attempts).where(eq(attempts.id, id)).limit(1);
  return json({
    status: fresh.status,
    remainingMs: remainingMs(c.contest, fresh),
    paused: !fresh.isPreview && isPaused(c.contest),
    serverNow: Date.now(),
  });
}
