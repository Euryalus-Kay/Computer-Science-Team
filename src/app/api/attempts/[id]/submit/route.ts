import { after } from "next/server";
import { db } from "@/lib/db";
import { integrityEvents } from "@/lib/db/schema";
import { attemptCtx, json } from "@/lib/tests/guard";
import { finalizeAttempt } from "@/lib/tests/attempts";
import { summarizeAttempt } from "@/lib/integrity/analyze";
import { gradePendingWithAi } from "@/lib/ai/grade";

export const maxDuration = 120;

export async function POST(req: Request, ctx: RouteContext<"/api/attempts/[id]/submit">) {
  const { id } = await ctx.params;
  const c = await attemptCtx(req, id);
  if (c instanceof Response) return c;
  if (c.attempt.status === "active") {
    const d = await db();
    await d.insert(integrityEvents).values({
      attemptId: id,
      contestId: c.contest.id,
      userId: c.session.user.id,
      type: "submit",
      severity: "info",
      at: new Date(),
    });
    const r = await finalizeAttempt(id, "submitted");
    after(async () => {
      await summarizeAttempt(id);
      if (r?.pending.length) await gradePendingWithAi(id);
    });
  }
  return json({ ok: true });
}
