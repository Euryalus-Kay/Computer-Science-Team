import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { sessionFromRequest } from "@/lib/auth/session";

/** Issues upload tokens so admins can send large PDFs straight to Vercel Blob. */
export async function POST(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ error: "Vercel Blob isn't connected." }, { status: 501 });
  const body = (await req.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => {
        const s = await sessionFromRequest(req);
        if (!s || s.user.role !== "admin") throw new Error("Admins only.");
        return { allowedContentTypes: ["application/pdf"], maximumSizeInBytes: 100 * 1024 * 1024, addRandomSuffix: true };
      },
    });
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
