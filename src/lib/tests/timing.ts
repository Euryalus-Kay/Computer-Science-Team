import type { PauseWindow } from "@/lib/db/schema";

/** The subset of contest fields the timing rules depend on. */
export type TimingContest = {
  status: "draft" | "published" | "archived";
  startMode: "open" | "live";
  durationMin: number | null;
  opensAt: Date | null;
  closesAt: Date | null;
  liveStartAt: Date | null;
  liveEndAt: Date | null;
  extraSeconds: number;
  pauses: PauseWindow[];
};

export type TimingAttempt = {
  startedAt: Date;
  extraSeconds: number;
  status: "active" | "submitted" | "expired";
  /** An admin's preview runs on its own clock, outside the live window, close time and pauses. */
  isPreview?: boolean;
};

export const GRACE_MS = 15_000;

export function isPaused(c: Pick<TimingContest, "pauses">): boolean {
  const last = c.pauses[c.pauses.length - 1];
  return Boolean(last && last.end === null);
}

export function currentPauseStart(c: Pick<TimingContest, "pauses">): number | null {
  const last = c.pauses[c.pauses.length - 1];
  return last && last.end === null ? Date.parse(last.start) : null;
}

/** Total paused milliseconds overlapping [from, to]. Open pauses run until `now`. */
export function pausedWithin(pauses: PauseWindow[], from: number, to: number, now: number): number {
  let total = 0;
  for (const p of pauses) {
    const s = Date.parse(p.start);
    const e = p.end ? Date.parse(p.end) : now;
    const lo = Math.max(s, from);
    const hi = Math.min(e, to);
    if (hi > lo) total += hi - lo;
  }
  return total;
}

/** Pushes `base` back by the pauses that overlap [from, deadline]. Iterates because a later deadline can take in more pause time. */
function withPauses(c: TimingContest, base: number, from: number, now: number): number {
  let deadline = base;
  for (let i = 0; i < 8; i++) {
    const next = base + pausedWithin(c.pauses, from, deadline, now);
    if (next === deadline) break;
    deadline = next;
  }
  return deadline;
}

/**
 * Absolute deadline for an attempt in ms since epoch, or null if untimed.
 * Live tests end for everyone at the shared end time, but someone who starts late still gets the full
 * duration from their own start. Pauses only count from when each clock starts.
 */
export function attemptDeadline(c: TimingContest, a: TimingAttempt, now = Date.now()): number | null {
  if (a.isPreview) return c.durationMin ? a.startedAt.getTime() + c.durationMin * 60_000 + a.extraSeconds * 1000 : null;
  const extras = (c.extraSeconds + a.extraSeconds) * 1000;
  const start = a.startedAt.getTime();
  const own = c.durationMin ? start + c.durationMin * 60_000 : null;
  let deadline: number | null = null;
  if (c.startMode === "live") {
    const shared = c.liveEndAt ? withPauses(c, c.liveEndAt.getTime() + extras, c.liveStartAt ? Math.min(start, c.liveStartAt.getTime()) : start, now) : null;
    const late = own !== null ? withPauses(c, own + extras, start, now) : null;
    deadline = shared === null ? late : late === null ? shared : Math.max(shared, late);
  } else {
    let base = own;
    if (c.closesAt) base = base === null ? c.closesAt.getTime() : Math.min(base, c.closesAt.getTime());
    if (base !== null) deadline = withPauses(c, base + extras, start, now);
  }
  if (deadline === null) return null;
  // A close time is a hard stop, which is how "End now" works for live tests.
  if (c.closesAt) deadline = Math.min(deadline, c.closesAt.getTime());
  return deadline;
}

/**
 * Whether nobody can still be working: joining a live test stops at the shared end, and the latest
 * starter then has the full duration. Used for results and leaderboards shown "after it closes".
 */
export function overForEveryone(c: TimingContest, now = Date.now()): boolean {
  const a = availability(c, now);
  if (a.state !== "closed") return false;
  if (c.closesAt && now >= c.closesAt.getTime()) return true;
  if (c.startMode !== "live" || !c.liveEndAt || !c.liveStartAt || !c.durationMin) return true;
  const end = c.liveEndAt.getTime() + c.extraSeconds * 1000 + pausedWithin(c.pauses, c.liveStartAt.getTime(), Infinity, now);
  return now >= end + c.durationMin * 60_000;
}

export function remainingMs(c: TimingContest, a: TimingAttempt, now = Date.now()): number | null {
  const d = attemptDeadline(c, a, now);
  if (d === null) return null;
  // An open pause extends the deadline in step with `now`, so this stays frozen while paused.
  return Math.max(0, d - now);
}

export function isExpired(c: TimingContest, a: TimingAttempt, now = Date.now()): boolean {
  if (a.status !== "active") return a.status === "expired";
  if (isPaused(c) && !a.isPreview) return false;
  const d = attemptDeadline(c, a, now);
  return d !== null && now > d + GRACE_MS;
}

export type Availability =
  | { state: "draft" }
  | { state: "scheduled"; opensAt: number }
  | { state: "waiting" } // live mode, not started yet
  | { state: "countdown"; startsAt: number }
  | { state: "open"; closesAt: number | null }
  | { state: "closed" };

/** Whether a member can start a new attempt right now. */
export function availability(c: TimingContest, now = Date.now()): Availability {
  if (c.status === "draft") return { state: "draft" };
  if (c.status === "archived") return { state: "closed" };
  if (c.opensAt && now < c.opensAt.getTime()) return { state: "scheduled", opensAt: c.opensAt.getTime() };
  if (c.closesAt && now >= c.closesAt.getTime()) return { state: "closed" };
  if (c.startMode === "live") {
    if (!c.liveStartAt) return { state: "waiting" };
    if (now < c.liveStartAt.getTime()) return { state: "countdown", startsAt: c.liveStartAt.getTime() };
    if (c.liveEndAt) {
      const end = c.liveEndAt.getTime() + c.extraSeconds * 1000 + pausedWithin(c.pauses, c.liveStartAt.getTime(), Infinity, now);
      if (now >= end) return { state: "closed" };
      return { state: "open", closesAt: end };
    }
    return { state: "open", closesAt: c.closesAt?.getTime() ?? null };
  }
  return { state: "open", closesAt: c.closesAt?.getTime() ?? null };
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function humanMinutes(ms: number): string {
  const m = Math.round(ms / 60000);
  if (m < 1) return "under a minute";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}
