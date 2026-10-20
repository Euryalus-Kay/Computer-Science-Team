import { buildSebConfig } from "@/lib/seb";
import { originOf, peekLaunchToken } from "@/lib/launch";
import { getContest } from "@/lib/tests/attempts";

/** The .seb file Safe Exam Browser downloads. Its start page signs the student in. */
export async function GET(req: Request, ctx: RouteContext<"/api/seb/[token]/exam.seb">) {
  const { token } = await ctx.params;
  const row = await peekLaunchToken(token, "seb");
  if (!row) return new Response("This link expired. Start again from the website.", { status: 410 });
  const slug = row.target.split("/").pop() ?? "";
  const contest = await getContest(slug);
  const { origin } = originOf(req);
  const cfg = buildSebConfig({
    startURL: `${origin}/seb/launch?token=${token}`,
    quitURL: `${origin}/seb/quit`,
    quitPassword: contest?.integrity?.exitCode ?? "labcs",
  });
  return new Response(new Uint8Array(cfg.file), {
    headers: {
      "content-type": "application/seb",
      "content-disposition": 'attachment; filename="exam.seb"',
      "cache-control": "no-store",
    },
  });
}
