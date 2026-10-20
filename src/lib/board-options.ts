import { asc, desc, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { contests, decks } from "@/lib/db/schema";

/** Tests and decks the board can show, for its pickers. */
export async function boardOptions() {
  const d = await db();
  const [tests, deckRows] = await Promise.all([
    d.select({ id: contests.id, title: contests.title }).from(contests).where(ne(contests.status, "archived")).orderBy(desc(contests.updatedAt)),
    d.select({ id: decks.id, title: decks.title }).from(decks).orderBy(asc(decks.ord), desc(decks.updatedAt)),
  ]);
  return { tests, decks: deckRows };
}
