import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contestItems, contests, type IntegrityConfig } from "@/lib/db/schema";
import { newCode, newId } from "@/lib/ids";
import { TOCK_DOCS } from "@/lib/tock/docs";
import { INTRO_ITEMS, PRACTICE_ITEMS, type SeedItem } from "./test-items";

async function insertContest(
  adminId: string,
  problemIds: Record<string, string>,
  c: Partial<typeof contests.$inferInsert> & { slug: string; title: string },
  items: SeedItem[],
) {
  const d = await db();
  const [exists] = await d.select({ id: contests.id }).from(contests).where(eq(contests.slug, c.slug)).limit(1);
  if (exists) return exists.id;
  const id = newId();
  const integrity: IntegrityConfig = {
    lockdown: "none",
    requireFullscreen: false,
    warnOnLeave: true,
    blockPaste: false,
    camera: false,
    exitCode: newCode(6),
    scanApps: true,
    ...(c.integrity ?? {}),
  };
  await d.insert(contests).values({ id, createdBy: adminId, ...c, integrity });
  await d.insert(contestItems).values(
    items.map((it, i) => ({
      id: newId(),
      contestId: id,
      ord: i,
      section: it.section ?? null,
      type: it.type,
      title: it.title,
      prompt: it.prompt,
      points: it.points,
      config: it.config ?? {},
      grading: it.grading ?? "auto",
      rubric: it.rubric ?? null,
      problemId: it.problem ? (problemIds[it.problem] ?? null) : null,
    })),
  );
  return id;
}

export async function seedTests(adminId: string, problemIds: Record<string, string>) {
  await insertContest(
    adminId,
    problemIds,
    {
      slug: "intro-logic",
      title: "Intro Logic Test",
      description:
        "30 minutes, 30 questions. Nobody is expected to finish, so skip anything that stalls you and come back if there's time. Later questions are worth more.\n\nEveryone gets different numbers, so comparing answers won't help.",
      status: "published",
      durationMin: 30,
      startMode: "live",
      visibility: "everyone",
      showResults: "never",
      resultsDetail: "score",
      leaderboard: "off",
      shuffleItems: false,
      tag: "Tryout",
      resources: [{ id: "tock", title: "Tock reference", body: TOCK_DOCS }],
      integrity: { lockdown: "none", requireFullscreen: true, warnOnLeave: true, blockPaste: true, camera: false, exitCode: newCode(6), scanApps: true },
    },
    INTRO_ITEMS,
  );
  await insertContest(
    adminId,
    problemIds,
    {
      slug: "practice-round-1",
      title: "Practice Round 1",
      description: "Three short questions and three programming problems. Partial credit counts the tests you pass.",
      status: "published",
      durationMin: 45,
      startMode: "open",
      visibility: "everyone",
      showResults: "after_submit",
      resultsDetail: "full",
      leaderboard: "live",
      maxAttempts: 1,
      tag: "Practice",
    },
    PRACTICE_ITEMS,
  );
}
