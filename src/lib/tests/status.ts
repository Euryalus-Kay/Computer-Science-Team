import { availability, isPaused, type TimingContest } from "./timing";

export type StatusTone = "neutral" | "green" | "blue" | "amber" | "red" | "outline";

/** One short label for where a test is in its life, for admin lists and headers. */
export function testStatus(c: TimingContest, now = Date.now()): { label: string; tone: StatusTone; live: boolean } {
  if (c.status === "draft") return { label: "Draft", tone: "outline", live: false };
  if (c.status === "archived") return { label: "Archived", tone: "neutral", live: false };
  const a = availability(c, now);
  switch (a.state) {
    case "scheduled":
      return { label: "Scheduled", tone: "blue", live: false };
    case "waiting":
      return { label: "Ready to start", tone: "blue", live: false };
    case "countdown":
      return { label: "Starting", tone: "green", live: true };
    case "open":
      if (c.startMode === "live") return isPaused(c) ? { label: "Paused", tone: "amber", live: true } : { label: "Live", tone: "green", live: true };
      return { label: "Open", tone: "green", live: false };
    case "closed":
      return { label: "Closed", tone: "neutral", live: false };
    default:
      return { label: "Draft", tone: "outline", live: false };
  }
}
