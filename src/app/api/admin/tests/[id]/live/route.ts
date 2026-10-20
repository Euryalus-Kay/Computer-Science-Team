import { sessionFromRequest } from "@/lib/auth/session";
import { getContest } from "@/lib/tests/attempts";
import { liveSnapshot } from "@/lib/admin/live";

export async function GET(req: Request, ctx: RouteContext<"/api/admin/tests/[id]/live">) {
  const s = await sessionFromRequest(req);
  if (!s || s.user.role !== "admin") return Response.json({ error: "Admins only." }, { status: 403 });
  const { id } = await ctx.params;
  const c = await getContest(id);
  if (!c) return Response.json({ error: "Not found" }, { status: 404 });
  const previews = new URL(req.url).searchParams.get("previews") === "1";
  return Response.json(await liveSnapshot(c, { previews }));
}
