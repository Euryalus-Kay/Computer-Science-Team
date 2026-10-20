import { sessionFromRequest } from "@/lib/auth/session";
import { getContest } from "@/lib/tests/attempts";
import { loadResults } from "@/lib/admin/results";
import { getSettings } from "@/lib/settings";

function cell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  // Quote everything that could break a row, and defuse spreadsheet formulas.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) || safe !== s ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function GET(req: Request, ctx: RouteContext<"/admin/tests/[id]/export">) {
  const s = await sessionFromRequest(req);
  if (!s || s.user.role !== "admin") return new Response("Admins only", { status: 403 });
  const { id } = await ctx.params;
  const c = await getContest(id);
  if (!c) return new Response("Not found", { status: 404 });
  const [data, settings] = await Promise.all([loadResults(c), getSettings()]);
  const tz = settings.timezone;
  const when = (t: number | null) =>
    t ? new Date(t).toLocaleString("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
  const sections = data.rows[0]?.sections.map((x) => x.name) ?? [];
  const header = [
    "Rank",
    "Name",
    "Username",
    "Grade",
    "Status",
    "Score",
    "Out of",
    "Percent",
    "Answered",
    "Ended on question",
    "Furthest answered",
    "Minutes used",
    "Started",
    "Submitted",
    "Integrity",
    "Risk",
    "Flags",
    ...sections.map((x) => `${x} score`),
    ...data.items.map((it, i) => `Q${i + 1} ${it.title}`.trim()),
  ];
  const lines = [header.map(cell).join(",")];
  data.rows.forEach((r, i) => {
    lines.push(
      [
        i + 1,
        r.name,
        r.username,
        r.grade ?? "",
        r.status,
        r.score,
        r.maxScore,
        r.maxScore ? Math.round((r.score / r.maxScore) * 1000) / 10 : 0,
        r.answered,
        r.endedOn ?? "",
        r.reached,
        Math.round(r.usedMs / 6000) / 10,
        when(r.startedAt),
        when(r.submittedAt),
        r.level,
        r.risk,
        r.flags.map((f) => f.message).join(" | "),
        ...r.sections.map((x) => x.score),
        ...r.itemScores.map((v) => (v === null ? "" : v)),
      ]
        .map(cell)
        .join(","),
    );
  });
  const name = `${c.slug}-results.csv`;
  return new Response("﻿" + lines.join("\r\n") + "\r\n", {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}
