import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { announcements, users } from "@/lib/db/schema";
import { renderMarkdown } from "@/lib/markdown";

export type PostView = { id: string; html: string; body: string; pinned: boolean; createdAt: string; author: string | null };

/** Posts for the home page, pinned first, rendered to HTML. */
export async function postsForHome(limit = 8): Promise<PostView[]> {
  const d = await db();
  const rows = await d
    .select({ p: announcements, author: users.name })
    .from(announcements)
    .leftJoin(users, eq(users.id, announcements.authorId))
    .orderBy(desc(announcements.pinned), desc(announcements.createdAt))
    .limit(limit);
  return Promise.all(
    rows.map(async ({ p, author }) => ({
      id: p.id,
      html: await renderMarkdown(p.body),
      body: p.body,
      pinned: p.pinned,
      createdAt: p.createdAt.toISOString(),
      author,
    })),
  );
}
