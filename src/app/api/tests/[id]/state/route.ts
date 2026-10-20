import { sessionFromRequest } from "@/lib/auth/session";
import { getContest } from "@/lib/tests/attempts";
import { availability, isPaused } from "@/lib/tests/timing";

/** Lobby polling: has the test opened or started yet? */
export async function GET(req: Request, ctx: RouteContext<"/api/tests/[id]/state">) {
  const s = await sessionFromRequest(req);
  if (!s) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await ctx.params;
  const c = await getContest(id);
  if (!c) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ...availability(c), paused: isPaused(c), serverNow: Date.now() });
}
