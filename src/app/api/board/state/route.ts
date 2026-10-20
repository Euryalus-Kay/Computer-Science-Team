import { sessionFromRequest } from "@/lib/auth/session";
import { boardPayload, patchBoard, type BoardPatch } from "@/lib/board";

async function admin(req: Request) {
  const s = await sessionFromRequest(req);
  return s && s.user.role === "admin" ? s : null;
}

export async function GET(req: Request) {
  if (!(await admin(req))) return Response.json({ error: "Admins only." }, { status: 403 });
  return Response.json(await boardPayload(), { headers: { "cache-control": "no-store" } });
}

export async function PATCH(req: Request) {
  if (!(await admin(req))) return Response.json({ error: "Admins only." }, { status: 403 });
  const patch = (await req.json().catch(() => ({}))) as BoardPatch;
  await patchBoard(patch);
  return Response.json(await boardPayload());
}
