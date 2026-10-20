import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { answers, attempts, groupMembers, integrityEvents, users, type IntegritySummary } from "@/lib/db/schema";
import { getItems, type ContestRow } from "@/lib/tests/attempts";
import { availability, isPaused, remainingMs } from "@/lib/tests/timing";
import { emptyStats, flagsFromStats, riskOf, type Stats } from "@/lib/integrity/analyze";
import { EVENT_LABEL } from "@/lib/integrity/events";

export type LiveRow = {
  attemptId: string;
  userId: string;
  name: string;
  username: string;
  status: "active" | "submitted" | "expired";
  preview: boolean;
  startedAt: number;
  submittedAt: number | null;
  answered: number;
  frontier: number;
  current: number | null;
  score: number;
  maxScore: number;
  pending: number;
  remainingMs: number | null;
  lastActiveAt: number | null;
  online: boolean;
  away: boolean;
  risk: number;
  level: IntegritySummary["level"];
  flags: { severity: "low" | "medium" | "high"; message: string }[];
  kind: "web" | "desktop" | "seb";
  reviewed: boolean;
  aiVerdict: string | null;
};

export type FeedEvent = {
  id: number;
  at: number;
  attemptId: string;
  name: string;
  type: string;
  label: string;
  severity: string;
  item: string | null;
};

export type LiveSnapshot = {
  serverNow: number;
  state: ReturnType<typeof availability>;
  paused: boolean;
  questions: number;
  points: number;
  rows: LiveRow[];
  waiting: { id: string; name: string; username: string }[];
  feed: FeedEvent[];
};

const AWAY_TYPES = ["visibility_hidden", "visibility_visible", "desktop_blur", "desktop_focus", "blur", "focus"];

/** Everything the live monitor and the board need, in one round of queries. */
export async function liveSnapshot(c: ContestRow, opts: { previews?: boolean; feed?: boolean } = {}): Promise<LiveSnapshot> {
  const d = await db();
  const now = Date.now();
  const items = await getItems(c.id);
  const itemTitle = new Map(items.map((i, n) => [i.id, `${n + 1}. ${i.title || "Question"}`]));
  const rows = await d
    .select({ attempt: attempts, name: users.name, username: users.username })
    .from(attempts)
    .innerJoin(users, eq(users.id, attempts.userId))
    .where(and(eq(attempts.contestId, c.id), opts.previews ? sql`true` : eq(attempts.isPreview, false)));
  const ids = rows.map((r) => r.attempt.id);

  const counts = ids.length
    ? await d
        .select({
          attemptId: answers.attemptId,
          answered: sql<number>`count(*) filter (where ${answers.status} <> 'empty')::int`,
          pending: sql<number>`count(*) filter (where ${answers.status} = 'pending')::int`,
        })
        .from(answers)
        .where(inArray(answers.attemptId, ids))
        .groupBy(answers.attemptId)
    : [];
  const countBy = new Map(counts.map((x) => [x.attemptId, x]));

  // Event stats per attempt, aggregated in the database.
  const num = (k: string) => sql`case when jsonb_typeof(${integrityEvents.data}->${k}) = 'number' then (${integrityEvents.data}->>${k})::float else 0 end`;
  const agg = ids.length
    ? await d
        .select({
          attemptId: integrityEvents.attemptId,
          type: integrityEvents.type,
          severity: integrityEvents.severity,
          n: sql<number>`count(*)::int`,
          away: sql<number>`coalesce(sum(${num("awayMs")}), 0)::float`,
          longest: sql<number>`coalesce(max(${num("awayMs")}), 0)::float`,
          chars: sql<number>`coalesce(sum(${num("chars")}), 0)::float`,
          small: sql<number>`(count(*) filter (where ${integrityEvents.data}->>'small' = 'true'))::int`,
        })
        .from(integrityEvents)
        .where(eq(integrityEvents.contestId, c.id))
        .groupBy(integrityEvents.attemptId, integrityEvents.type, integrityEvents.severity)
    : [];
  const stats = new Map<string, { stats: Stats; types: Map<string, number> }>();
  for (const a of agg) {
    if (!stats.has(a.attemptId)) stats.set(a.attemptId, { stats: emptyStats(), types: new Map() });
    const s = stats.get(a.attemptId)!;
    s.types.set(a.type, (s.types.get(a.type) ?? 0) + a.n);
    const st = s.stats;
    switch (a.type) {
      case "visibility_hidden":
      case "desktop_blur":
        st.leaves += a.n;
        break;
      case "visibility_visible":
      case "desktop_focus":
        st.awayMs += a.away;
        st.longestAwayMs = Math.max(st.longestAwayMs, a.longest);
        break;
      case "blur":
        st.blurs += a.n;
        break;
      case "focus":
        if (a.severity !== "info") {
          st.leaves += a.n;
          st.awayMs += a.away;
          st.longestAwayMs = Math.max(st.longestAwayMs, a.longest);
        }
        break;
      case "paste":
        st.pastes += a.n;
        st.pastedChars += a.chars;
        break;
      case "fullscreen_exit":
        st.fullscreenExits += a.n;
        break;
      case "devtools":
        st.devtools += a.n;
        break;
      case "resize":
        st.resizes += a.small;
        break;
      case "reload":
        st.reloads += a.n;
        break;
      default:
        if (a.type.startsWith("camera_") && a.severity !== "info") st.camera += a.n;
    }
  }

  // Whether each person is away right now: their latest leave/return event.
  const lastAway = ids.length
    ? await d
        .selectDistinctOn([integrityEvents.attemptId], { attemptId: integrityEvents.attemptId, type: integrityEvents.type })
        .from(integrityEvents)
        .where(and(eq(integrityEvents.contestId, c.id), inArray(integrityEvents.type, AWAY_TYPES)))
        .orderBy(integrityEvents.attemptId, desc(integrityEvents.at), desc(integrityEvents.id))
    : [];
  const awayNow = new Set(lastAway.filter((x) => x.type === "visibility_hidden" || x.type === "desktop_blur" || x.type === "blur").map((x) => x.attemptId));

  const out: LiveRow[] = rows.map(({ attempt: a, name, username }) => {
    const s = stats.get(a.id);
    const done = a.status !== "active";
    // Finished attempts use the stored summary, which also has cross-attempt flags.
    const flags = done && a.integrity ? a.integrity.flags : s ? flagsFromStats(s.stats, s.types) : [];
    const { risk, level } = done && a.integrity ? a.integrity : riskOf(flags);
    const cur = a.lastItemId ? a.order.indexOf(a.lastItemId) : -1;
    return {
      attemptId: a.id,
      userId: a.userId,
      name,
      username,
      status: a.status,
      preview: a.isPreview,
      startedAt: a.startedAt.getTime(),
      submittedAt: a.submittedAt?.getTime() ?? null,
      answered: countBy.get(a.id)?.answered ?? 0,
      frontier: a.frontier,
      current: cur >= 0 ? cur + 1 : null,
      score: a.score,
      maxScore: a.maxScore,
      pending: countBy.get(a.id)?.pending ?? 0,
      remainingMs: done ? null : remainingMs(c, a, now),
      lastActiveAt: a.lastActiveAt?.getTime() ?? null,
      online: !done && Boolean(a.lastActiveAt && now - a.lastActiveAt.getTime() < 45_000),
      away: !done && awayNow.has(a.id),
      risk,
      level,
      flags: flags.map((f) => ({ severity: f.severity, message: f.message })),
      kind: a.client?.kind ?? "web",
      reviewed: a.reviewed,
      aiVerdict: a.aiReview?.verdict ?? null,
    };
  });

  // People expected to take it who haven't started.
  let expected: { id: string; name: string; username: string }[] = [];
  if (c.visibility === "everyone") {
    expected = await d
      .select({ id: users.id, name: users.name, username: users.username })
      .from(users)
      .where(and(eq(users.role, "member"), eq(users.disabled, false)));
  } else if (c.visibility === "assigned") {
    const fromGroups = c.assignees.groups.length
      ? (await d.select({ u: groupMembers.userId }).from(groupMembers).where(inArray(groupMembers.groupId, c.assignees.groups))).map((r) => r.u)
      : [];
    const want = [...new Set([...c.assignees.users, ...fromGroups])];
    expected = want.length
      ? await d
          .select({ id: users.id, name: users.name, username: users.username })
          .from(users)
          .where(and(inArray(users.id, want), eq(users.disabled, false), ne(users.role, "admin")))
      : [];
  }
  const started = new Set(out.filter((r) => !r.preview).map((r) => r.userId));
  const waiting = expected.filter((u) => !started.has(u.id)).sort((x, y) => x.name.localeCompare(y.name));

  let feed: FeedEvent[] = [];
  if (opts.feed !== false && ids.length) {
    const ev = await d
      .select({ e: integrityEvents, name: users.name })
      .from(integrityEvents)
      .innerJoin(users, eq(users.id, integrityEvents.userId))
      .where(and(eq(integrityEvents.contestId, c.id), inArray(integrityEvents.severity, ["low", "medium", "high"])))
      .orderBy(desc(integrityEvents.id))
      .limit(60);
    feed = ev.map(({ e, name }) => ({
      id: e.id,
      at: e.at.getTime(),
      attemptId: e.attemptId,
      name,
      type: e.type,
      label: EVENT_LABEL[e.type] ?? e.type,
      severity: e.severity,
      item: e.itemId ? (itemTitle.get(e.itemId) ?? null) : null,
    }));
  }

  return {
    serverNow: now,
    state: availability(c, now),
    paused: isPaused(c),
    questions: items.length,
    points: items.reduce((s, i) => s + i.points, 0),
    rows: out,
    waiting,
    feed,
  };
}
