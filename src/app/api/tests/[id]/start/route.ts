import { sessionFromRequest } from "@/lib/auth/session";
import { getContest, startAttempt } from "@/lib/tests/attempts";
import { desktopInfo } from "@/lib/lockdown";

export async function POST(req: Request, ctx: RouteContext<"/api/tests/[id]/start">) {
  const s = await sessionFromRequest(req);
  if (!s) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await ctx.params;
  const c = await getContest(id);
  if (!c) return Response.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { preview?: boolean; code?: string };
  const desk = desktopInfo(req.headers);
  const r = await startAttempt(c, s, {
    preview: body.preview,
    code: body.code,
    client: {
      kind: s.kind,
      ua: req.headers.get("user-agent")?.slice(0, 300),
      ip: (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || undefined,
      appVersion: desk.version ?? undefined,
    },
  });
  if (!r.ok) return Response.json(r, { status: 409 });
  return Response.json(r);
}
