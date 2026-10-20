import { eq } from "drizzle-orm";
import { sessionFromRequest } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { files } from "@/lib/db/schema";

/** Serves uploaded slides to signed-in members. */
export async function GET(req: Request, ctx: RouteContext<"/api/files/[id]">) {
  const s = await sessionFromRequest(req);
  if (!s) return new Response("Sign in first.", { status: 401 });
  const { id } = await ctx.params;
  const d = await db();
  const [f] = await d.select().from(files).where(eq(files.id, id)).limit(1);
  if (!f) return new Response("Not found", { status: 404 });
  if (f.blobUrl) return Response.redirect(f.blobUrl, 302);
  if (!f.data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(f.data), {
    headers: {
      "content-type": f.mime,
      "content-length": String(f.data.length),
      "content-disposition": `inline; filename="${f.name.replace(/[^\w.\- ]/g, "_")}"`,
      "cache-control": "private, max-age=3600",
    },
  });
}
