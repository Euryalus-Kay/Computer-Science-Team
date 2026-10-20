import { eq } from "drizzle-orm";
import { createSession } from "@/lib/auth/session";
import { consumeLaunchToken, htmlPage, originOf, peekLaunchToken } from "@/lib/launch";
import { desktopInfo } from "@/lib/lockdown";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/** First page the desktop app loads: verifies the app and signs the student in. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const app = desktopInfo(req.headers);
  if (!app.ok) {
    return htmlPage(
      "Open in the Lab CS app",
      `<h1>Open this in the Lab CS app</h1><p>This link only works inside the desktop app.</p><a href="labcs://open?token=${encodeURIComponent(token)}">Open the app</a>`,
      403,
    );
  }
  const row = await peekLaunchToken(token, "desktop");
  if (!row || !(await consumeLaunchToken(token))) {
    return htmlPage("Link expired", "<h1>Link expired</h1><p>Go back to the website and press Open in app again.</p>", 410);
  }
  await createSession(row.userId, "desktop", { appVersion: app.version ?? undefined });
  const d = await db();
  await d.update(users).set({ desktopSeenAt: new Date() }).where(eq(users.id, row.userId));
  const { origin } = originOf(req);
  return Response.redirect(`${origin}${row.target}`, 303);
}
