import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { attempts, contests } from "@/lib/db/schema";
import { attemptDeadline, isExpired } from "./timing";

/** The member's in-progress (non-preview) attempt, if any, for the sidebar resume card. */
export async function activeAttemptFor(userId: string) {
  const d = await db();
  const rows = await d
    .select({ attempt: attempts, contest: contests })
    .from(attempts)
    .innerJoin(contests, eq(contests.id, attempts.contestId))
    .where(and(eq(attempts.userId, userId), eq(attempts.status, "active"), eq(attempts.isPreview, false)))
    .limit(5);
  for (const { attempt, contest } of rows) {
    if (isExpired(contest, attempt)) continue;
    return { id: attempt.id, title: contest.title, deadline: attemptDeadline(contest, attempt) };
  }
  return null;
}
