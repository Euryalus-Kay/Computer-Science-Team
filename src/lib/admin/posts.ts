"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { announcements } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { newId } from "@/lib/ids";

type Result = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath("/");
  revalidatePath("/admin/posts");
}

export async function savePost(input: { id?: string | null; body: string; pinned: boolean }): Promise<Result> {
  const s = await requireAdmin();
  const body = input.body.trim();
  if (!body) return { ok: false, error: "Write something first." };
  if (body.length > 20_000) return { ok: false, error: "That post is too long." };
  const d = await db();
  if (input.id) await d.update(announcements).set({ body, pinned: input.pinned }).where(eq(announcements.id, input.id));
  else await d.insert(announcements).values({ id: newId(), body, pinned: input.pinned, authorId: s.user.id });
  refresh();
  return { ok: true };
}

export async function setPinned(id: string, pinned: boolean): Promise<Result> {
  await requireAdmin();
  const d = await db();
  await d.update(announcements).set({ pinned }).where(eq(announcements.id, id));
  refresh();
  return { ok: true };
}

export async function deletePost(id: string): Promise<Result> {
  await requireAdmin();
  const d = await db();
  await d.delete(announcements).where(eq(announcements.id, id));
  refresh();
  return { ok: true };
}
