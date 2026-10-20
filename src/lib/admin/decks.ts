"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { del } from "@vercel/blob";
import { db } from "@/lib/db";
import { decks, files } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { newId } from "@/lib/ids";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export type DeckInput = {
  id?: string | null;
  title: string;
  kind: "markdown" | "pdf" | "link";
  body: string;
  url: string | null;
  fileId: string | null;
  published: boolean;
};

function refresh(id?: string) {
  revalidatePath("/slides", "layout");
  revalidatePath("/admin/slides", "layout");
  revalidatePath("/");
  if (id) revalidatePath(`/slides/${id}`);
}

/** Deletes an uploaded file, including its copy in Vercel Blob. */
async function removeFile(id: string) {
  const d = await db();
  const [f] = await d.select({ blobUrl: files.blobUrl }).from(files).where(eq(files.id, id)).limit(1);
  await d.delete(files).where(eq(files.id, id));
  if (f?.blobUrl && process.env.BLOB_READ_WRITE_TOKEN) await del(f.blobUrl).catch(() => {});
}

export async function saveDeck(input: DeckInput): Promise<Result<{ id: string }>> {
  const s = await requireAdmin();
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Give the deck a title." };
  if (input.kind === "pdf" && !input.fileId) return { ok: false, error: "Upload a PDF first." };
  if (input.kind === "link") {
    try {
      const u = new URL(input.url ?? "");
      if (u.protocol !== "https:") throw new Error();
    } catch {
      return { ok: false, error: "Paste a full https:// link." };
    }
  }
  const d = await db();
  const row = {
    title,
    kind: input.kind,
    body: input.kind === "markdown" ? input.body : "",
    url: input.kind === "link" ? input.url : null,
    fileId: input.kind === "pdf" ? input.fileId : null,
    published: input.published,
    updatedAt: new Date(),
  };
  let id = input.id ?? null;
  if (id) {
    const [prev] = await d.select({ fileId: decks.fileId }).from(decks).where(eq(decks.id, id)).limit(1);
    await d.update(decks).set(row).where(eq(decks.id, id));
    // A replaced or dropped PDF isn't used anywhere else.
    if (prev?.fileId && prev.fileId !== row.fileId) await removeFile(prev.fileId);
  } else {
    id = newId();
    await d.insert(decks).values({ id, ...row, authorId: s.user.id });
  }
  refresh(id);
  return { ok: true, data: { id } };
}

export async function setDeckPublished(id: string, published: boolean): Promise<Result> {
  await requireAdmin();
  const d = await db();
  await d.update(decks).set({ published, updatedAt: new Date() }).where(eq(decks.id, id));
  refresh(id);
  return { ok: true };
}

export async function deleteDeck(id: string): Promise<Result> {
  await requireAdmin();
  const d = await db();
  const [row] = await d.select({ fileId: decks.fileId }).from(decks).where(eq(decks.id, id)).limit(1);
  await d.delete(decks).where(eq(decks.id, id));
  if (row?.fileId) await removeFile(row.fileId);
  refresh();
  return { ok: true };
}

const MAX_DB_FILE = 4 * 1024 * 1024;

/** Small files go straight into the database, which works on any host. */
export async function uploadFile(form: FormData): Promise<Result<{ id: string; name: string }>> {
  await requireAdmin();
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No file." };
  if (file.type !== "application/pdf") return { ok: false, error: "Upload a PDF." };
  if (file.size > MAX_DB_FILE) return { ok: false, error: "That PDF is over 4 MB. Connect Vercel Blob for larger files, or link to it instead." };
  const id = newId();
  const d = await db();
  await d.insert(files).values({ id, name: file.name.slice(0, 200), mime: file.type, size: file.size, data: Buffer.from(await file.arrayBuffer()) });
  return { ok: true, data: { id, name: file.name } };
}

/** Records a file that the browser already uploaded to Vercel Blob. */
export async function registerBlob(input: { url: string; name: string; size: number }): Promise<Result<{ id: string; name: string }>> {
  await requireAdmin();
  if (!/^https:\/\/[a-z0-9.-]+\.blob\.vercel-storage\.com\//i.test(input.url)) return { ok: false, error: "Unexpected upload address." };
  const id = newId();
  const d = await db();
  await d.insert(files).values({ id, name: input.name.slice(0, 200), mime: "application/pdf", size: Math.round(input.size) || 0, blobUrl: input.url });
  return { ok: true, data: { id, name: input.name } };
}
