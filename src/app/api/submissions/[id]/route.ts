import { eq } from "drizzle-orm";
import { sessionFromRequest } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { submissions } from "@/lib/db/schema";

export async function GET(req: Request, ctx: RouteContext<"/api/submissions/[id]">) {
  const s = await sessionFromRequest(req);
  if (!s) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await ctx.params;
  const d = await db();
  const [sub] = await d.select().from(submissions).where(eq(submissions.id, id)).limit(1);
  if (!sub || (sub.userId !== s.user.id && s.user.role !== "admin")) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(sub);
}
