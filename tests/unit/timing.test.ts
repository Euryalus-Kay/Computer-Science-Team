import { describe, expect, it } from "vitest";
import { attemptDeadline, availability, isExpired, overForEveryone, remainingMs, type TimingContest } from "@/lib/tests/timing";

const T0 = Date.parse("2026-10-20T15:00:00Z");
const min = 60_000;

function live(over: Partial<TimingContest> = {}): TimingContest {
  return {
    status: "published",
    startMode: "live",
    durationMin: 30,
    opensAt: null,
    closesAt: null,
    liveStartAt: new Date(T0),
    liveEndAt: new Date(T0 + 30 * min),
    extraSeconds: 0,
    pauses: [],
    ...over,
  };
}
const attempt = (startOffset = 0, extraSeconds = 0) => ({ startedAt: new Date(T0 + startOffset), extraSeconds, status: "active" as const });

describe("test timing", () => {
  it("live tests end at the shared end time, and late joiners get their full time", () => {
    expect(attemptDeadline(live(), attempt(0))).toBe(T0 + 30 * min);
    expect(attemptDeadline(live(), attempt(7 * min))).toBe(T0 + 37 * min);
    expect(attemptDeadline(live(), attempt(29 * min))).toBe(T0 + 59 * min);
  });

  it("a late joiner's clock only counts pauses after they start", () => {
    const pause = { start: new Date(T0 + 10 * min).toISOString(), end: new Date(T0 + 14 * min).toISOString() };
    const c = live({ pauses: [pause] });
    expect(attemptDeadline(c, attempt(0), T0 + 20 * min)).toBe(T0 + 34 * min);
    expect(attemptDeadline(c, attempt(5 * min), T0 + 20 * min)).toBe(T0 + 39 * min);
    expect(attemptDeadline(c, attempt(20 * min), T0 + 25 * min)).toBe(T0 + 50 * min);
  });

  it("End now stops late joiners too", () => {
    const c = live({ closesAt: new Date(T0 + 32 * min) });
    expect(attemptDeadline(c, attempt(20 * min))).toBe(T0 + 32 * min);
  });

  it("a live test is over for everyone once the last possible late joiner is done", () => {
    expect(availability(live(), T0 + 31 * min).state).toBe("closed");
    expect(overForEveryone(live(), T0 + 31 * min)).toBe(false);
    expect(overForEveryone(live(), T0 + 60 * min)).toBe(true);
    expect(overForEveryone(live({ closesAt: new Date(T0 + 31 * min) }), T0 + 31 * min)).toBe(true);
    expect(overForEveryone(live(), T0 + 10 * min)).toBe(false);
  });

  it("extra time for everyone and for one person adds up", () => {
    expect(attemptDeadline(live({ extraSeconds: 120 }), attempt(0, 300))).toBe(T0 + 37 * min);
  });

  it("a finished pause pushes the end back by its length", () => {
    const c = live({ pauses: [{ start: new Date(T0 + 10 * min).toISOString(), end: new Date(T0 + 14 * min).toISOString() }] });
    expect(attemptDeadline(c, attempt(0), T0 + 20 * min)).toBe(T0 + 34 * min);
  });

  it("an open pause freezes the clock", () => {
    const c = live({ pauses: [{ start: new Date(T0 + 10 * min).toISOString(), end: null }] });
    const a = remainingMs(c, attempt(0), T0 + 12 * min);
    const b = remainingMs(c, attempt(0), T0 + 25 * min);
    expect(a).toBe(20 * min);
    expect(b).toBe(20 * min);
    expect(isExpired(c, attempt(0), T0 + 60 * min)).toBe(false);
  });

  it("End now closes everything at that moment", () => {
    const c = live({ closesAt: new Date(T0 + 12 * min), extraSeconds: 600 });
    expect(attemptDeadline(c, attempt(0, 900))).toBe(T0 + 12 * min);
    expect(availability(c, T0 + 13 * min).state).toBe("closed");
  });

  it("live tests wait, count down, open and close", () => {
    expect(availability(live({ liveStartAt: null, liveEndAt: null })).state).toBe("waiting");
    expect(availability(live(), T0 - 3000)).toEqual({ state: "countdown", startsAt: T0 });
    expect(availability(live(), T0 + min).state).toBe("open");
    expect(availability(live(), T0 + 31 * min).state).toBe("closed");
  });

  it("self-start tests time each person from their own start", () => {
    const c: TimingContest = { ...live(), startMode: "open", liveStartAt: null, liveEndAt: null, durationMin: 45 };
    expect(attemptDeadline(c, attempt(5 * min))).toBe(T0 + 50 * min);
  });

  it("grace period before an attempt counts as expired", () => {
    expect(isExpired(live(), attempt(0), T0 + 30 * min + 10_000)).toBe(false);
    expect(isExpired(live(), attempt(0), T0 + 30 * min + 20_000)).toBe(true);
  });

  it("an admin's preview runs on its own clock, even after the test ended", () => {
    const ended = live({ closesAt: new Date(T0 + 12 * min) });
    const preview = { ...attempt(60 * min), isPreview: true };
    expect(attemptDeadline(ended, preview)).toBe(T0 + 90 * min);
    expect(isExpired(ended, preview, T0 + 61 * min)).toBe(false);
    expect(isExpired(ended, preview, T0 + 91 * min)).toBe(true);
    const paused = live({ pauses: [{ start: new Date(T0 + 50 * min).toISOString(), end: null }] });
    expect(isExpired(paused, preview, T0 + 91 * min)).toBe(true);
  });
});
