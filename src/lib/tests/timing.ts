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

/**
 * Absolute deadline for an attempt in ms since epoch, or null if untimed.
 * Pauses that overlap the attempt window push the deadline back; we iterate
 * because extending the window can pull in more pause time.
 */
export function attemptDeadline(c: TimingContest, a: TimingAttempt, now = Date.now()): number | null {
  const extras = (c.extraSeconds + a.extraSeconds) * 1000;
  let base: number | null = null;
  const start = a.startedAt.getTime();
  if (c.startMode === "live") {
    if (c.liveEndAt) base = c.liveEndAt.getTime();
    else if (c.durationMin) base = start + c.durationMin * 60_000;
  } else if (c.durationMin) {
    base = start + c.durationMin * 60_000;
  }
  if (c.closesAt && c.startMode === "open") {
    base = base === null ? c.closesAt.getTime() : Math.min(base, c.closesAt.getTime());
  }
  if (base === null) return null;
  const from = c.startMode === "live" && c.liveStartAt ? Math.min(start, c.liveStartAt.getTime()) : start;
  let deadline = base + extras;
  for (let i = 0; i < 8; i++) {
    const next = base + extras + pausedWithin(c.pauses, from, deadline, now);
    if (next === deadline) break;
    deadline = next;
  }
  return deadline;
}

export function remainingMs(c: TimingContest, a: TimingAttempt, now = Date.now()): number | null {
  const d = attemptDeadline(c, a, now);
  if (d === null) return null;
  // An open pause extends the deadline in step with `now`, so this stays frozen while paused.
  return Math.max(0, d - now);
}

export function isExpired(c: TimingContest, a: TimingAttempt, now = Date.now()): boolean {
  if (a.status !== "active") return a.status === "expired";
  if (isPaused(c)) return false;
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
