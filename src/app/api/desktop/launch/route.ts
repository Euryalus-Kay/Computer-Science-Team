import { sessionFromRequest } from "@/lib/auth/session";
import { createLaunchToken, originOf } from "@/lib/launch";

/** One-time link that signs the desktop app in and opens `target`. */
export async function POST(req: Request) {
  const s = await sessionFromRequest(req);
  if (!s) return Response.json({ error: "Sign in first." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { target?: string };
  const token = await createLaunchToken(s.user.id, "desktop", body.target ?? "/tests", 3 * 60_000);
  const { origin } = originOf(req);
  return Response.json({ url: `labcs://open?server=${encodeURIComponent(origin)}&token=${encodeURIComponent(token)}` });
}
