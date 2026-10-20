import { ASSETS, downloadUrl } from "@/lib/desktop";

export async function GET(_req: Request, ctx: RouteContext<"/api/desktop/download/[platform]">) {
  const { platform } = await ctx.params;
  if (!(platform in ASSETS)) return new Response("Unknown platform", { status: 404 });
  return Response.redirect(downloadUrl(platform as keyof typeof ASSETS), 302);
}
