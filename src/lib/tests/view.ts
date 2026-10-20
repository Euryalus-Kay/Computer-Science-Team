import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { attempts, contestItems, contests } from "@/lib/db/schema";
import { availability, attemptDeadline } from "./timing";
import { userGroupIds, visibleTo, type ContestRow } from "./attempts";
import { sql } from "drizzle-orm";

export type TestCard = {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: ContestRow["status"];
  durationMin: number | null;
  questions: number;
  points: number;
  availability: ReturnType<typeof availability>;
  lockdown: string;
  camera: boolean;
  locked: boolean;
  mine: { status: "none" | "active" | "done"; attemptId: string | null; score: number | null; maxScore: number | null; deadline: number | null };
  showScore: boolean;
  tag: string | null;
  opensAt: string | null;
  closesAt: string | null;
  startMode: ContestRow["startMode"];
};

export function resultsVisible(c: ContestRow): boolean {
  if (c.showResults === "after_submit") return true;
  if (c.showResults === "after_close") return availability(c).state === "closed";
  return false;
}

/** Tests a member can see, with their own progress on each. */
export async function testsForUser(userId: string, isAdmin: boolean): Promise<TestCard[]> {
  const d = await db();
  const groups = await userGroupIds(userId);
  const all = await d.select().from(contests).orderBy(sql`coalesce(${contests.opensAt}, ${contests.createdAt}) desc`);
  const counts = await d
    .select({ contestId: contestItems.contestId, n: sql<number>`count(*)::int`, pts: sql<number>`coalesce(sum(${contestItems.points}),0)::float` })
    .from(contestItems)
    .groupBy(contestItems.contestId);
  const byContest = new Map(counts.map((c) => [c.contestId, c]));
  const mine = await d
    .select()
    .from(attempts)
    .where(and(eq(attempts.userId, userId), eq(attempts.isPreview, false)));
  const out: TestCard[] = [];
  for (const c of all) {
    if (c.status === "archived") continue;
    if (!visibleTo(c, userId, groups, false) && !(isAdmin && c.status === "published")) continue;
    const ats = mine.filter((a) => a.contestId === c.id);
    const active = ats.find((a) => a.status === "active");
    const done = ats.filter((a) => a.status !== "active").sort((a, b) => b.score - a.score)[0];
    out.push({
      id: c.id,
      slug: c.slug,
      title: c.title,
      description: c.description,
      status: c.status,
      durationMin: c.durationMin,
      questions: byContest.get(c.id)?.n ?? 0,
      points: byContest.get(c.id)?.pts ?? 0,
      availability: availability(c),
      lockdown: c.integrity?.lockdown ?? "none",
      camera: Boolean(c.integrity?.camera),
      locked: c.visibility === "code",
      mine: active
        ? { status: "active", attemptId: active.id, score: null, maxScore: null, deadline: attemptDeadline(c, active) }
        : done
          ? { status: "done", attemptId: done.id, score: resultsVisible(c) ? done.score : null, maxScore: done.maxScore, deadline: null }
          : { status: "none", attemptId: null, score: null, maxScore: null, deadline: null },
      showScore: resultsVisible(c),
      tag: c.tag,
      opensAt: c.opensAt?.toISOString() ?? null,
      closesAt: c.closesAt?.toISOString() ?? null,
      startMode: c.startMode,
    });
  }
  return out;
}
