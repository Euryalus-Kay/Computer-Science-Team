import { sessionFromRequest } from "@/lib/auth/session";
import { forDisplay, runOnce } from "@/lib/runner";
import { getLanguage } from "@/lib/runner/languages";
import { rateLimit } from "@/lib/rate-limit";
import { flagOutsideActivity } from "@/lib/integrity/outside";

export const maxDuration = 60;

export async function POST(req: Request) {
  const s = await sessionFromRequest(req);
  if (!s) return Response.json({ error: "Sign in to run code." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { language?: string; code?: string; stdin?: string; source?: string } | null;
  if (!body?.language || typeof body.code !== "string") return Response.json({ error: "Bad request" }, { status: 400 });
  if (!getLanguage(body.language)) return Response.json({ error: "Unknown language" }, { status: 400 });
  if (body.code.length > 100_000) return Response.json({ error: "Code is too long (100 KB max)." }, { status: 413 });
  const stdin = (body.stdin ?? "").slice(0, 1_000_000);
  const limit = rateLimit(`run:${s.user.id}`, 20, 60_000);
  if (!limit.ok) {
    return Response.json({ error: `Slow down a little. Try again in ${Math.ceil(limit.retryAfterMs / 1000)}s.` }, { status: 429 });
  }
  if (body.source === "playground") {
    await flagOutsideActivity(s.user.id, "playground_run", { language: body.language, chars: body.code.length });
  }
  const result = await runOnce(body.language, body.code, stdin, { timeMs: 3000, memoryMb: 256 });
  return Response.json(forDisplay(result));
}
