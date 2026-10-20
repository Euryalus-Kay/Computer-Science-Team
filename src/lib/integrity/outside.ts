import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { attempts, contests, integrityEvents } from "@/lib/db/schema";
import { isExpired } from "@/lib/tests/timing";

/**
 * Server-side signal: the member did something elsewhere on the site (ran code in the
 * playground, opened a problem) while a test attempt was in progress.
 */
export async function flagOutsideActivity(userId: string, type: string, data: Record<string, unknown>) {
  const d = await db();
  const rows = await d
    .select({ attempt: attempts, contest: contests })
    .from(attempts)
    .innerJoin(contests, eq(contests.id, attempts.contestId))
    .where(and(eq(attempts.userId, userId), eq(attempts.status, "active"), eq(attempts.isPreview, false)));
  const live = rows.filter((r) => !isExpired(r.contest, r.attempt));
  if (live.length === 0) return;
  await d.insert(integrityEvents).values(
    live.map((r) => ({
      attemptId: r.attempt.id,
      contestId: r.contest.id,
      userId,
      type,
      severity: "high" as const,
      at: new Date(),
      data,
    })),
  );
}
