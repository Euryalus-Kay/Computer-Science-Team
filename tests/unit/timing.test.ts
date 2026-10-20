import { describe, expect, it } from "vitest";
import { attemptDeadline, availability, isExpired, remainingMs, type TimingContest } from "@/lib/tests/timing";

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
  it("live tests end at the shared end time, even for late joiners", () => {
    expect(attemptDeadline(live(), attempt(0))).toBe(T0 + 30 * min);
    expect(attemptDeadline(live(), attempt(7 * min))).toBe(T0 + 30 * min);
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
});
