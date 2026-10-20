import { sessionFromRequest } from "@/lib/auth/session";
import { getContest } from "@/lib/tests/attempts";
import { createLaunchToken, originOf } from "@/lib/launch";

/** Creates a one-time Safe Exam Browser link for a test. */
export async function POST(req: Request) {
  const s = await sessionFromRequest(req);
  if (!s) return Response.json({ error: "Sign in first." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { testId?: string };
  const c = body.testId ? await getContest(body.testId) : null;
  if (!c) return Response.json({ error: "Test not found" }, { status: 404 });
  const token = await createLaunchToken(s.user.id, "seb", `/tests/${c.slug}`, 15 * 60_000);
  const { host, proto } = originOf(req);
  return Response.json({ url: `${proto === "https" ? "sebs" : "seb"}://${host}/api/seb/${token}/exam.seb` });
}
