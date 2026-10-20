import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { launchTokens } from "@/lib/db/schema";
import { newToken, sha256 } from "@/lib/ids";

export async function createLaunchToken(userId: string, purpose: "desktop" | "seb", target: string, ttlMs: number) {
  const token = newToken(24);
  const d = await db();
  await d.insert(launchTokens).values({
    id: sha256(token),
    userId,
    purpose,
    target: target.startsWith("/") && !target.startsWith("//") ? target : "/",
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return token;
}

export async function peekLaunchToken(token: string, purpose: "desktop" | "seb") {
  const d = await db();
  const [row] = await d
    .select()
    .from(launchTokens)
    .where(and(eq(launchTokens.id, sha256(token)), eq(launchTokens.purpose, purpose), isNull(launchTokens.usedAt), gt(launchTokens.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

/** Marks a token used. Returns false if someone used it first. */
export async function consumeLaunchToken(token: string): Promise<boolean> {
  const d = await db();
  const r = await d
    .update(launchTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(launchTokens.id, sha256(token)), isNull(launchTokens.usedAt)))
    .returning({ id: launchTokens.id });
  return r.length === 1;
}

export function originOf(req: Request) {
  const u = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? u.host;
  const proto = req.headers.get("x-forwarded-proto") ?? u.protocol.replace(":", "");
  return { origin: `${proto}://${host}`, host, proto };
}

export function htmlPage(title: string, body: string, status = 200) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;background:#f5f6f8;color:#111316;display:grid;place-items:center;min-height:100vh;margin:0}main{max-width:420px;padding:24px}h1{font-size:20px;margin:0 0 8px}p{color:#474d55}a{display:inline-block;margin-top:12px;background:#111316;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none;font-weight:500}</style></head><body><main>${body}</main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
