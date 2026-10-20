import { db } from "@/lib/db";
import { integrityEvents } from "@/lib/db/schema";
import { sessionFromRequest } from "@/lib/auth/session";
import { loadAttempt } from "@/lib/tests/attempts";
import { rateLimit } from "@/lib/rate-limit";

/** The desktop app checks a coach's exit code here before it unlocks mid-test. */
export async function POST(req: Request) {
  const s = await sessionFromRequest(req);
  if (!s) return Response.json({ ok: false }, { status: 401 });
  if (!rateLimit(`exit:${s.user.id}`, 8, 60_000).ok) return Response.json({ ok: false }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as { attemptId?: string; code?: string };
  const loaded = body.attemptId ? await loadAttempt(body.attemptId) : null;
  if (!loaded || loaded.attempt.userId !== s.user.id) return Response.json({ ok: false }, { status: 404 });
  const want = (loaded.contest.integrity?.exitCode ?? "").trim().toUpperCase();
  const ok = Boolean(want) && String(body.code ?? "").trim().toUpperCase() === want;
  const d = await db();
  await d.insert(integrityEvents).values({
    attemptId: loaded.attempt.id,
    contestId: loaded.contest.id,
    userId: s.user.id,
    type: ok ? "desktop_exit" : "desktop_exit_wrong",
    severity: ok ? "medium" : "low",
    at: new Date(),
  });
  return Response.json({ ok }, { status: ok ? 200 : 403 });
}
