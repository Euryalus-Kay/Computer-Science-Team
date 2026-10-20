import { createSession } from "@/lib/auth/session";
import { buildSebConfig, sebHash } from "@/lib/seb";
import { consumeLaunchToken, htmlPage, originOf, peekLaunchToken } from "@/lib/launch";
import { getContest } from "@/lib/tests/attempts";
import { publicUrl, sebInfo } from "@/lib/lockdown";

/** Start page inside Safe Exam Browser: checks it really is SEB, then signs in. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const row = await peekLaunchToken(token, "seb");
  if (!row) return htmlPage("Link expired", "<h1>Link expired</h1><p>Start again from the test page on the website.</p>", 410);
  const { origin } = originOf(req);
  const contest = await getContest(row.target.split("/").pop() ?? "");
  const cfg = buildSebConfig({ startURL: `${origin}/seb/launch?token=${token}`, quitURL: `${origin}/seb/quit`, quitPassword: contest?.integrity?.exitCode ?? "labcs" });
  const url = publicUrl(req);
  const header = req.headers.get("x-safeexambrowser-configkeyhash")?.toLowerCase();
  const verified = Boolean(header && header === sebHash(url, cfg.configKey));
  const looks = sebInfo(req.headers, url, null).ok;
  if (!verified && !looks) {
    return htmlPage("Open in Safe Exam Browser", "<h1>Open this in Safe Exam Browser</h1><p>This page only works inside Safe Exam Browser. Go back to the test page and choose Open in Safe Exam Browser.</p>", 403);
  }
  if (!(await consumeLaunchToken(token))) return htmlPage("Link used", "<h1>This link was already used</h1><p>Start again from the website.</p>", 410);
  await createSession(row.userId, "seb", { sebConfigKey: cfg.configKey });
  return Response.redirect(`${origin}${row.target}${verified ? "" : "?seb=unverified"}`, 303);
}
