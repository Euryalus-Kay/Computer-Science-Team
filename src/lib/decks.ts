import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { decks, files } from "@/lib/db/schema";
import { renderMarkdown } from "@/lib/markdown";
import { splitSlides } from "@/lib/board";

export type DeckRow = typeof decks.$inferSelect;

export async function listDecks(includeDrafts: boolean) {
  const d = await db();
  return d
    .select()
    .from(decks)
    .where(includeDrafts ? undefined : eq(decks.published, true))
    .orderBy(asc(decks.ord), desc(decks.updatedAt));
}

/** Google Slides and Docs links work best as their embed view. */
export function embedUrl(url: string): string | null {
  const m = url.match(/^https:\/\/docs\.google\.com\/presentation\/d\/([\w-]+)/);
  if (m) return `https://docs.google.com/presentation/d/${m[1]}/embed?start=false&loop=false`;
  const c = url.match(/^https:\/\/www\.canva\.com\/design\/([\w-]+)\/([\w-]+)/);
  if (c) return `https://www.canva.com/design/${c[1]}/${c[2]}/view?embed`;
  return null;
}

export type DeckView = {
  id: string;
  title: string;
  kind: DeckRow["kind"];
  published: boolean;
  updatedAt: string;
  slides: string[];
  fileUrl: string | null;
  fileName: string | null;
  url: string | null;
  embed: string | null;
};

export async function deckView(id: string): Promise<DeckView | null> {
  const d = await db();
  const [row] = await d.select().from(decks).where(eq(decks.id, id)).limit(1);
  if (!row) return null;
  let fileName: string | null = null;
  if (row.fileId) {
    const [f] = await d.select({ name: files.name }).from(files).where(eq(files.id, row.fileId)).limit(1);
    fileName = f?.name ?? null;
  }
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    published: row.published,
    updatedAt: row.updatedAt.toISOString(),
    slides: row.kind === "markdown" ? await Promise.all(splitSlides(row.body).map((s) => renderMarkdown(s))) : [],
    fileUrl: row.fileId ? `/api/files/${row.fileId}` : null,
    fileName,
    url: row.url,
    embed: row.url ? embedUrl(row.url) : null,
  };
}
