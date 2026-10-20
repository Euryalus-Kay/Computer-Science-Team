import { sessionFromRequest, type Session } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { integrityEvents } from "@/lib/db/schema";
import { desktopInfo, sebInfo, publicUrl } from "@/lib/lockdown";
import { finalizeAttempt, loadAttempt, lockdownOk, type AttemptRow, type ContestRow } from "./attempts";
import { isExpired } from "./timing";

export type AttemptCtx = { session: Session; attempt: AttemptRow; contest: ContestRow };

export const json = (body: unknown, status = 200) => Response.json(body, { status });

/**
 * Loads an attempt for its owner and enforces lockdown on every request:
 * a desktop or SEB session only works when the request really comes from that client.
 */
export async function attemptCtx(req: Request, attemptId: string): Promise<AttemptCtx | Response> {
  const session = await sessionFromRequest(req);
  if (!session) return json({ error: "Sign in again." }, 401);
  const loaded = await loadAttempt(attemptId);
  if (!loaded || loaded.attempt.userId !== session.user.id) return json({ error: "Not found" }, 404);
  const { attempt, contest } = loaded;
  if (!attempt.isPreview) {
    const lock = lockdownOk(contest, session, false);
    if (!lock.ok) return json({ error: "This test only runs in lockdown mode.", need: lock.need }, 403);
    const fromDesktop = session.kind === "desktop" && !desktopInfo(req.headers).ok;
    const fromSeb = session.kind === "seb" && !sebInfo(req.headers, publicUrl(req), contest.integrity?.sebConfigKey).ok;
    if (fromDesktop || fromSeb) {
      const d = await db();
      await d.insert(integrityEvents).values({
        attemptId: attempt.id,
        contestId: contest.id,
        userId: session.user.id,
        type: "session_mismatch",
        severity: "high",
        at: new Date(),
        data: { ua: req.headers.get("user-agent")?.slice(0, 200) ?? null },
      });
      return json({ error: "Open this test from the lockdown app." }, 403);
    }
  }
  return { session, attempt, contest };
}

/** Closes attempts whose time ran out. Returns true if the attempt is no longer active. */
export async function closeIfExpired(ctx: AttemptCtx): Promise<boolean> {
  if (ctx.attempt.status !== "active") return true;
  if (isExpired(ctx.contest, ctx.attempt)) {
    await finalizeAttempt(ctx.attempt.id, "expired");
    return true;
  }
  return false;
}
