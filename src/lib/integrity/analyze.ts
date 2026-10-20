import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { answers, attempts, integrityEvents, users, type IntegritySummary } from "@/lib/db/schema";
import { generateItem, needsReview, type ItemRow } from "@/lib/items/engine";
import { WIDGETS } from "@/lib/items/widgets";
import * as G from "@/lib/items/generic";
import type { AnyConfig } from "@/lib/items/types";
import { getItems } from "@/lib/tests/attempts";

type Flag = IntegritySummary["flags"][number];
const WEIGHT = { low: 6, medium: 16, high: 34 };

const secs = (ms: number) => (ms >= 60_000 ? `${Math.round(ms / 60000)} min` : `${Math.round(ms / 1000)} s`);

export type Stats = IntegritySummary["stats"];

export const emptyStats = (): Stats => ({
  leaves: 0,
  awayMs: 0,
  longestAwayMs: 0,
  blurs: 0,
  pastes: 0,
  pastedChars: 0,
  fullscreenExits: 0,
  devtools: 0,
  camera: 0,
  resizes: 0,
  reloads: 0,
});

/** Folds one event into running stats. Shared by the live monitor and the summary. */
export function addEvent(stats: Stats, type: string, severity: string, data: Record<string, unknown> | null) {
  const v = (k: string) => Number((data ?? {})[k]) || 0;
  switch (type) {
    case "visibility_hidden":
    case "desktop_blur":
      stats.leaves++;
      break;
    case "visibility_visible":
    case "desktop_focus": {
      const away = v("awayMs");
      stats.awayMs += away;
      stats.longestAwayMs = Math.max(stats.longestAwayMs, away);
      break;
    }
    case "blur":
      stats.blurs++;
      break;
    case "focus": {
      // Back from another app while the tab stayed visible.
      const away = v("awayMs");
      if (away >= 1500) {
        stats.leaves++;
        stats.awayMs += away;
        stats.longestAwayMs = Math.max(stats.longestAwayMs, away);
      }
      break;
    }
    case "paste":
      stats.pastes++;
      stats.pastedChars += v("chars");
      break;
    case "fullscreen_exit":
      stats.fullscreenExits++;
      break;
    case "devtools":
      stats.devtools++;
      break;
    case "resize":
      if ((data ?? {}).small) stats.resizes++;
      break;
    case "reload":
      stats.reloads++;
      break;
    default:
      if (type.startsWith("camera_") && severity !== "info") stats.camera++;
  }
}

const SERVER_FLAGS: [string, string, Flag["severity"]][] = [
  ["session_mismatch", "Tried to use the lockdown session outside the lockdown app.", "high"],
  ["multi_screen", "A second screen was connected.", "high"],
  ["desktop_display_change", "A display was connected or removed during the test.", "high"],
  ["desktop_clipboard", "Clipboard changed from another app during the test.", "high"],
  ["desktop_apps", "Assistant, chat or remote-control apps were running.", "high"],
  ["second_device", "Signed in on a second device during the test.", "medium"],
];

/** Flags that follow from the stats and the set of event types seen. */
export function flagsFromStats(stats: Stats, typeCounts: Map<string, number>): Flag[] {
  const flags: Flag[] = [];
  if (stats.leaves) {
    const sev = stats.awayMs > 120_000 || stats.leaves >= 6 ? "high" : stats.awayMs > 20_000 || stats.leaves >= 3 ? "medium" : "low";
    flags.push({
      code: "left",
      severity: sev,
      message: `Left the test ${stats.leaves} time${stats.leaves === 1 ? "" : "s"}, ${secs(stats.awayMs)} away in total (longest ${secs(stats.longestAwayMs)}).`,
    });
  }
  if (stats.pastes) {
    flags.push({
      code: "paste",
      severity: stats.pastedChars >= 200 ? "high" : stats.pastedChars >= 40 ? "medium" : "low",
      message: `Pasted ${stats.pastes} time${stats.pastes === 1 ? "" : "s"} (${stats.pastedChars} characters).`,
    });
  }
  if (stats.fullscreenExits) flags.push({ code: "fullscreen", severity: "medium", message: `Left full screen ${stats.fullscreenExits} time${stats.fullscreenExits === 1 ? "" : "s"}.` });
  if (stats.devtools) flags.push({ code: "devtools", severity: "high", message: "Browser developer tools looked open." });
  if (stats.camera) flags.push({ code: "camera", severity: stats.camera >= 3 ? "high" : "medium", message: `${stats.camera} camera check alert${stats.camera === 1 ? "" : "s"}.` });
  if (stats.resizes) flags.push({ code: "resize", severity: "medium", message: "Shrank the window, possibly to fit something beside it." });
  if (stats.reloads >= 2) flags.push({ code: "reload", severity: "low", message: `Reloaded the test ${stats.reloads} times.` });
  for (const t of ["playground_run", "problem_run", "problem_submit"]) {
    const n = typeCounts.get(t) ?? 0;
    if (n) flags.push({ code: t, severity: "high", message: `${n} ${t === "playground_run" ? "Playground run" : "practice problem action"}${n === 1 ? "" : "s"} on the site during the test.` });
  }
  for (const [type, message, severity] of SERVER_FLAGS) {
    if (typeCounts.get(type)) flags.push({ code: type, severity, message });
  }
  return flags;
}

export function riskOf(flags: Flag[]): { risk: number; level: IntegritySummary["level"] } {
  const risk = Math.min(100, flags.reduce((s, f) => s + WEIGHT[f.severity], 0));
  const level: IntegritySummary["level"] = risk >= 60 ? "high" : risk >= 30 ? "medium" : flags.length ? "low" : "clear";
  return { risk, level };
}

/** Rebuilds the per-attempt integrity summary from its event log and answers. */
/** `cross` replaces the flags from comparing attempts; leave it out to keep the last ones. */
export async function summarizeAttempt(attemptId: string, cross: Flag[] | null = null): Promise<IntegritySummary | null> {
  const d = await db();
  const [attempt] = await d.select().from(attempts).where(eq(attempts.id, attemptId)).limit(1);
  if (!attempt) return null;
  const events = await d.select().from(integrityEvents).where(eq(integrityEvents.attemptId, attemptId)).orderBy(asc(integrityEvents.at));
  const ans = await d.select().from(answers).where(eq(answers.attemptId, attemptId));
  const stats = emptyStats();
  const typeCounts = new Map<string, number>();
  const returns: number[] = [];
  for (const e of events) {
    addEvent(stats, e.type, e.severity, e.data ?? null);
    typeCounts.set(e.type, (typeCounts.get(e.type) ?? 0) + 1);
    if ((e.type === "visibility_visible" || e.type === "desktop_focus" || e.type === "focus") && (Number(e.data?.awayMs) || 0) >= 4000) returns.push(e.at.getTime());
  }
  const flags = flagsFromStats(stats, typeCounts);
  // A correct answer saved right after coming back from another tab or app.
  const quick = ans.filter((a) => a.correct && a.firstSavedAt && returns.some((t) => a.firstSavedAt!.getTime() - t >= 0 && a.firstSavedAt!.getTime() - t < 20_000));
  if (quick.length) {
    flags.splice(1, 0, {
      code: "return-answer",
      severity: quick.length >= 2 ? "high" : "medium",
      message: `Answered ${quick.length} question${quick.length === 1 ? "" : "s"} correctly within 20 s of returning from another window.`,
    });
  }
  flags.push(...(cross ?? (attempt.integrity?.flags ?? []).filter((f) => f.code === "copied-version" || f.code === "fast")));
  const summary: IntegritySummary = { ...riskOf(flags), flags, stats, computedAt: new Date().toISOString() };
  await d.update(attempts).set({ integrity: summary }).where(eq(attempts.id, attemptId));
  return summary;
}

type Gen = { pub: unknown; key: unknown };

function grader(item: ItemRow): ((g: Gen, response: unknown) => number | null) | null {
  const r = (x: unknown) => x as never;
  switch (item.type) {
    case "mcq":
      return (g, resp) => G.gradeMcq(g.pub, r(g.key), r(resp)).fraction;
    case "multi":
      return (g, resp) => G.gradeMulti(g.pub, r(g.key), r(resp)).fraction;
    case "short":
      return (g, resp) => G.gradeShort(g.pub, r(g.key), r(resp)).fraction;
    case "numeric":
      return (g, resp) => G.gradeNumeric(g.pub, r(g.key), r(resp)).fraction;
    case "widget": {
      const w = WIDGETS[String((item.config as AnyConfig).widget)];
      if (!w || w.interact) return null;
      return (g, resp) => w.grade(g.pub, g.key, r(resp), null).fraction;
    }
    default:
      return null;
  }
}

/**
 * Looks across all attempts in a test for two signals a single attempt can't show:
 * a wrong answer that is exactly right for someone else's version of the question,
 * and correct answers on hard questions given far faster than everyone else.
 */
export async function analyzeContest(contestId: string) {
  const d = await db();
  const items = (await getItems(contestId)).filter((i) => !needsReview(i));
  const rows = await d
    .select({ attempt: attempts, name: users.name })
    .from(attempts)
    .innerJoin(users, eq(users.id, attempts.userId))
    .where(and(eq(attempts.contestId, contestId), eq(attempts.isPreview, false)));
  if (rows.length < 2) {
    for (const r of rows) await summarizeAttempt(r.attempt.id, []);
    return;
  }
  const ids = rows.map((r) => r.attempt.id);
  const ans = await d.select().from(answers).where(inArray(answers.attemptId, ids));
  const byAttempt = new Map<string, Map<string, (typeof ans)[number]>>();
  for (const a of ans) {
    if (!byAttempt.has(a.attemptId)) byAttempt.set(a.attemptId, new Map());
    byAttempt.get(a.attemptId)!.set(a.itemId, a);
  }
  const extra = new Map<string, Flag[]>();
  const add = (attemptId: string, f: Flag) => extra.set(attemptId, [...(extra.get(attemptId) ?? []), f]);

  for (const item of items) {
    const grade = grader(item);
    const label = item.title || "a question";
    if (grade) {
      const gens = new Map<string, Gen>();
      for (const r of rows) {
        try {
          gens.set(r.attempt.id, generateItem(item, r.attempt.seed));
        } catch {}
      }
      for (const a of rows) {
        const mine = byAttempt.get(a.attempt.id)?.get(item.id);
        if (!mine?.response || mine.correct) continue;
        for (const b of rows) {
          if (a.attempt.id === b.attempt.id) continue;
          const g = gens.get(b.attempt.id);
          if (!g) continue;
          let f: number | null = null;
          try {
            f = grade(g, mine.response);
          } catch {}
          if (f === 1) {
            add(a.attempt.id, {
              code: "copied-version",
              severity: "high",
              message: `Wrong answer on "${label}" is exactly right for ${b.name}'s version of it.`,
            });
            break;
          }
        }
      }
    }
    // Speed outliers on harder questions.
    if (item.points >= 2) {
      const times = rows
        .map((r) => byAttempt.get(r.attempt.id)?.get(item.id))
        .filter((a): a is NonNullable<typeof a> => Boolean(a?.correct && a.timeSpentMs > 0))
        .map((a) => a.timeSpentMs)
        .sort((x, y) => x - y);
      if (times.length >= 4) {
        const median = times[Math.floor(times.length / 2)];
        for (const r of rows) {
          const a = byAttempt.get(r.attempt.id)?.get(item.id);
          if (a?.correct && a.timeSpentMs > 0 && a.timeSpentMs < median * 0.2 && a.timeSpentMs < 20_000) {
            add(r.attempt.id, {
              code: "fast",
              severity: "medium",
              message: `Solved "${label}" in ${secs(a.timeSpentMs)}; the median was ${secs(median)}.`,
            });
          }
        }
      }
    }
  }
  for (const r of rows) await summarizeAttempt(r.attempt.id, extra.get(r.attempt.id) ?? []);
}
