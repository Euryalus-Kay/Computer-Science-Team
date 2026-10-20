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

/** Rebuilds the per-attempt integrity summary from its event log and answers. */
export async function summarizeAttempt(attemptId: string, extra: Flag[] = []): Promise<IntegritySummary | null> {
  const d = await db();
  const [attempt] = await d.select().from(attempts).where(eq(attempts.id, attemptId)).limit(1);
  if (!attempt) return null;
  const events = await d.select().from(integrityEvents).where(eq(integrityEvents.attemptId, attemptId)).orderBy(asc(integrityEvents.at));
  const ans = await d.select().from(answers).where(eq(answers.attemptId, attemptId));
  const stats: IntegritySummary["stats"] = {
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
  };
  const flags: Flag[] = [];
  const returns: number[] = [];
  for (const e of events) {
    const data = (e.data ?? {}) as Record<string, number>;
    switch (e.type) {
      case "visibility_hidden":
      case "desktop_blur":
        stats.leaves++;
        break;
      case "visibility_visible":
      case "desktop_focus": {
        const away = Number(data.awayMs) || 0;
        stats.awayMs += away;
        stats.longestAwayMs = Math.max(stats.longestAwayMs, away);
        if (away >= 4000) returns.push(e.at.getTime());
        break;
      }
      case "blur":
        stats.blurs++;
        break;
      case "paste":
        stats.pastes++;
        stats.pastedChars += Number(data.chars) || 0;
        break;
      case "fullscreen_exit":
        stats.fullscreenExits++;
        break;
      case "devtools":
        stats.devtools++;
        break;
      case "resize":
        if (data.small) stats.resizes++;
        break;
      case "reload":
        stats.reloads++;
        break;
      default:
        if (e.type.startsWith("camera_") && e.severity !== "info") stats.camera++;
    }
  }
  if (stats.leaves) {
    const sev = stats.awayMs > 120_000 || stats.leaves >= 6 ? "high" : stats.awayMs > 20_000 || stats.leaves >= 3 ? "medium" : "low";
    flags.push({
      code: "left",
      severity: sev,
      message: `Left the test ${stats.leaves} time${stats.leaves === 1 ? "" : "s"}, ${secs(stats.awayMs)} away in total (longest ${secs(stats.longestAwayMs)}).`,
    });
  }
  // A correct answer saved right after coming back from another tab or app.
  const quick = ans.filter((a) => a.correct && a.firstSavedAt && returns.some((t) => a.firstSavedAt!.getTime() - t >= 0 && a.firstSavedAt!.getTime() - t < 20_000));
  if (quick.length) {
    flags.push({
      code: "return-answer",
      severity: quick.length >= 2 ? "high" : "medium",
      message: `Answered ${quick.length} question${quick.length === 1 ? "" : "s"} correctly within 20 s of returning from another window.`,
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
    const n = events.filter((e) => e.type === t).length;
    if (n) flags.push({ code: t, severity: "high", message: `${n} ${t === "playground_run" ? "Playground run" : "practice problem action"}${n === 1 ? "" : "s"} on the site during the test.` });
  }
  const pick = (type: string, msg: string, sev: Flag["severity"] = "high") => {
    if (events.some((e) => e.type === type)) flags.push({ code: type, severity: sev, message: msg });
  };
  pick("session_mismatch", "Tried to use the lockdown session outside the lockdown app.");
  pick("multi_screen", "A second screen was connected.");
  pick("desktop_display_change", "A display was connected or removed during the test.");
  pick("desktop_clipboard", "Clipboard changed from another app during the test.");
  pick("desktop_apps", "Assistant, chat or remote-control apps were running.");
  pick("second_device", "Signed in on a second device during the test.", "medium");
  flags.push(...extra);
  const risk = Math.min(100, flags.reduce((s, f) => s + WEIGHT[f.severity], 0));
  const level: IntegritySummary["level"] = risk >= 60 ? "high" : risk >= 30 ? "medium" : risk >= 8 ? "low" : "clear";
  const summary: IntegritySummary = { risk, level, flags, stats, computedAt: new Date().toISOString() };
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
    for (const r of rows) await summarizeAttempt(r.attempt.id);
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
