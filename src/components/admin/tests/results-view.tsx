"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, ScanSearch, Sparkles, UsersRound, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Empty } from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { pts } from "@/lib/format";
import type { Results, ResultRow, Cell } from "@/lib/admin/results";
import { gradeAllPending, runIntegrityAnalysis } from "@/lib/admin/tests";
import { createGroup, setGroupMembership } from "@/lib/admin/members";
import { LevelPill, Progress } from "./bits";

type SortKey = "rank" | "name" | "score" | "reached" | "time" | "risk";

const CELL: Record<Cell, string> = {
  right: "bg-accent",
  partial: "bg-amber",
  wrong: "bg-red/70",
  pending: "bg-blue",
  blank: "bg-panel-3",
};

function minutes(ms: number) {
  const m = ms / 60000;
  return m < 10 ? m.toFixed(1) : String(Math.round(m));
}

export function ResultsView({
  testId,
  data,
  groups,
  aiReady,
}: {
  testId: string;
  data: Results;
  groups: { id: string; name: string }[];
  aiReady: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "rank", dir: 1 });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [groupOpen, setGroupOpen] = useState(false);
  const [pending, start] = useTransition();

  const ranked = useMemo(() => {
    const rank = new Map<string, number>();
    let last = -1;
    let place = 0;
    data.rows.forEach((r, i) => {
      if (r.score !== last) place = i + 1;
      last = r.score;
      rank.set(r.attemptId, place);
    });
    return rank;
  }, [data.rows]);

  const rows = useMemo(() => {
    const list = [...data.rows];
    const f: Record<SortKey, (a: ResultRow, b: ResultRow) => number> = {
      rank: (a, b) => ranked.get(a.attemptId)! - ranked.get(b.attemptId)!,
      name: (a, b) => a.name.localeCompare(b.name),
      score: (a, b) => b.score - a.score,
      reached: (a, b) => b.reached - a.reached,
      time: (a, b) => a.usedMs - b.usedMs,
      risk: (a, b) => b.risk - a.risk,
    };
    return list.sort((a, b) => f[sort.key](a, b) * sort.dir);
  }, [data.rows, sort, ranked]);

  const pendingCount = data.rows.reduce((t, r) => t + (r.status !== "active" ? r.pending : 0), 0);
  const allPicked = rows.length > 0 && rows.every((r) => picked.has(r.userId));
  const s = data.summary;

  const head = (key: SortKey, label: string, className?: string) => (
    <th className={className}>
      <button
        onClick={() => setSort((x) => ({ key, dir: x.key === key ? (-x.dir as 1 | -1) : 1 }))}
        className={cn("inline-flex items-center gap-0.5 hover:text-ink", sort.key === key && "text-ink")}
      >
        {label}
        {sort.key === key && (sort.dir === 1 ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />)}
      </button>
    </th>
  );

  if (data.rows.length === 0) {
    return (
      <div className="card">
        <Empty title="No results yet">Results appear here as people submit.</Empty>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="card grid grid-cols-2 gap-6 p-5 sm:grid-cols-4">
          <Stat label="Submitted" value={String(s.count)} />
          <Stat label="Average" value={pts(Math.round(s.mean * 10) / 10)} sub={`of ${pts(s.maxScore)}`} />
          <Stat label="Median" value={pts(s.median)} />
          <Stat label="Questions reached" value={s.reached.toFixed(1)} sub={`of ${data.items.length}`} />
        </div>
        <Histogram rows={data.rows.filter((r) => r.status !== "active")} max={s.maxScore} />
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {picked.size > 0 ? (
              <>
                <span className="text-sm font-medium">{picked.size} selected</span>
                <Button size="sm" icon={<UsersRound className="size-3.5" />} onClick={() => setGroupOpen(true)}>
                  Add to group
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>
                  Clear
                </Button>
              </>
            ) : (
              <span className="text-sm text-ink-3">Select people to add them to a group.</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {pendingCount > 0 && (
              <Button
                size="sm"
                icon={<Sparkles className="size-3.5" />}
                disabled={pending || !aiReady}
                title={aiReady ? undefined : "Add an Anthropic API key to grade with Claude"}
                onClick={() =>
                  start(async () => {
                    const r = await gradeAllPending(testId);
                    toast(r.ok ? "Graded with Claude" : r.error, r.ok ? "default" : "error");
                    router.refresh();
                  })
                }
              >
                Grade {pendingCount} with Claude
              </Button>
            )}
            <Button
              size="sm"
              icon={<ScanSearch className="size-3.5" />}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await runIntegrityAnalysis(testId);
                  toast(r.ok ? "Integrity check updated" : r.error, r.ok ? "default" : "error");
                  router.refresh();
                })
              }
            >
              Check for copying
            </Button>
            <a href={`/admin/tests/${testId}/export`} className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line-2 bg-panel px-2.5 text-sm font-medium shadow-card hover:bg-panel-2">
              <Download className="size-3.5" /> CSV
            </a>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="w-8">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allPicked}
                    onChange={() => setPicked(allPicked ? new Set() : new Set(rows.map((r) => r.userId)))}
                    className="accent-[var(--ink)]"
                  />
                </th>
                {head("rank", "#", "w-10")}
                {head("name", "Name")}
                {head("score", "Score", "text-right")}
                <th>Questions</th>
                {head("reached", "Reached", "text-right")}
                {head("time", "Time", "text-right")}
                {head("risk", "Integrity")}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.attemptId} className={cn(picked.has(r.userId) && "bg-blue-soft/40")}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.name}`}
                      checked={picked.has(r.userId)}
                      onChange={() =>
                        setPicked((p) => {
                          const n = new Set(p);
                          if (n.has(r.userId)) n.delete(r.userId);
                          else n.add(r.userId);
                          return n;
                        })
                      }
                      className="accent-[var(--ink)]"
                    />
                  </td>
                  <td className="num text-ink-3">{ranked.get(r.attemptId)}</td>
                  <td className="max-w-[200px]">
                    <Link href={`/admin/tests/${testId}/attempts/${r.attemptId}`} className="block truncate font-medium hover:underline">
                      {r.name}
                    </Link>
                    <div className="text-xs text-ink-4">
                      {r.status === "active" ? <span className="text-accent">working</span> : r.status === "expired" ? "time ran out" : "submitted"}
                      {r.grade ? ` · grade ${r.grade}` : ""}
                    </div>
                  </td>
                  <td className="num text-right whitespace-nowrap">
                    <span className="font-medium">{pts(r.score)}</span>
                    <span className="text-ink-4"> / {pts(r.maxScore)}</span>
                    <div className="text-xs text-ink-4">{r.maxScore ? Math.round((r.score / r.maxScore) * 100) : 0}%</div>
                  </td>
                  <td>
                    <div className="flex gap-[3px]" aria-label="Question results">
                      {r.cells.map((c, i) => (
                        <span key={i} title={`${i + 1}. ${data.items[i]?.title ?? ""}: ${c}`} className={cn("h-4 w-[7px] rounded-[2px]", CELL[c])} />
                      ))}
                    </div>
                  </td>
                  <td className="num text-right text-ink-2">
                    {r.reached}
                    <span className="text-ink-4"> / {data.items.length}</span>
                  </td>
                  <td className="num text-right text-ink-2">{minutes(r.usedMs)} min</td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <LevelPill level={r.level} flags={r.flags} />
                      {r.reviewed && <span className="text-xs text-ink-4">reviewed</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-4 border-t border-line px-4 py-2.5 text-xs text-ink-3">
          {(
            [
              ["right", "Right"],
              ["partial", "Partly right"],
              ["wrong", "Wrong"],
              ["pending", "Needs grading"],
              ["blank", "Not answered"],
            ] as [Cell, string][]
          ).map(([c, label]) => (
            <span key={c} className="flex items-center gap-1.5">
              <span className={cn("h-3 w-[6px] rounded-[2px]", CELL[c])} /> {label}
            </span>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex h-11 items-center border-b border-line px-4 text-sm font-medium">By question</div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="w-10">#</th>
                <th>Question</th>
                <th className="hidden md:table-cell">Section</th>
                <th className="text-right">Points</th>
                <th className="text-right">Answered</th>
                <th className="min-w-[160px]">Fully right</th>
                <th className="text-right">Avg time</th>
              </tr>
            </thead>
            <tbody>
              {data.questions.map((q) => {
                const rate = q.attempted ? q.correct / q.attempted : 0;
                return (
                  <tr key={q.id}>
                    <td className="num text-ink-3">{q.n}</td>
                    <td className="font-medium">{q.title}</td>
                    <td className="hidden text-ink-3 md:table-cell">{q.section}</td>
                    <td className="num text-right text-ink-2">{pts(q.points)}</td>
                    <td className="num text-right text-ink-2">
                      {q.attempted}
                      <span className="text-ink-4"> / {data.rows.length}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Progress value={q.correct} max={Math.max(1, q.attempted)} tone="accent" className="w-24" />
                        <span className="num text-xs text-ink-2">{q.attempted ? `${Math.round(rate * 100)}%` : "–"}</span>
                      </div>
                    </td>
                    <td className="num text-right text-ink-2">{q.avgTimeMs ? `${Math.round(q.avgTimeMs / 1000)} s` : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <GroupDialog
        open={groupOpen}
        onClose={() => setGroupOpen(false)}
        groups={groups}
        count={picked.size}
        onPick={(groupId, name) =>
          start(async () => {
            let id = groupId;
            if (!id) {
              const g = await createGroup(name);
              if (!g.ok || !g.data) return toast(g.ok ? "Couldn't create the group" : g.error, "error");
              id = g.data.id;
            }
            const r = await setGroupMembership(id, [...picked], true);
            if (!r.ok) return toast(r.error, "error");
            toast(`Added ${picked.size} to ${name}`);
            setGroupOpen(false);
            setPicked(new Set());
            router.refresh();
          })
        }
      />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-xs text-ink-3">{label}</div>
      <div className="num mt-1 text-2xl font-semibold tracking-[-0.02em]">
        {value}
        {sub && <span className="ml-1 text-sm font-normal text-ink-4">{sub}</span>}
      </div>
    </div>
  );
}

function Histogram({ rows, max }: { rows: ResultRow[]; max: number }) {
  const buckets = 10;
  const counts = Array.from({ length: buckets }, () => 0);
  for (const r of rows) {
    const f = max ? r.score / max : 0;
    counts[Math.min(buckets - 1, Math.floor(f * buckets))]++;
  }
  const top = Math.max(1, ...counts);
  return (
    <div className="card p-5">
      <div className="mb-3 text-xs text-ink-3">Score spread</div>
      <div className="flex h-[72px] items-end gap-1">
        {counts.map((n, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${i * 10}–${(i + 1) * 10}%: ${n}`}>
            {n > 0 && <span className="num text-[10px] text-ink-3">{n}</span>}
            <div className="w-full rounded-[3px] bg-ink/80" style={{ height: `${(n / top) * 52}px`, minHeight: n ? 3 : 1, opacity: n ? 1 : 0.15 }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-ink-4">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

function GroupDialog({
  open,
  onClose,
  groups,
  count,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  groups: { id: string; name: string }[];
  count: number;
  onPick: (groupId: string | null, name: string) => void;
}) {
  const [choice, setChoice] = useState<string>(groups[0]?.id ?? "new");
  const [name, setName] = useState("");
  const isNew = choice === "new";
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Add ${count} to a group`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={isNew && !name.trim()}
            onClick={() => onPick(isNew ? null : choice, isNew ? name.trim() : (groups.find((g) => g.id === choice)?.name ?? ""))}
          >
            Add
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        {groups.map((g) => (
          <label key={g.id} className="flex cursor-pointer items-center gap-2.5 rounded-md border border-line px-3 py-2 text-sm hover:bg-panel-2">
            <input type="radio" name="group" checked={choice === g.id} onChange={() => setChoice(g.id)} className="accent-[var(--ink)]" />
            {g.name}
          </label>
        ))}
        <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-line px-3 py-2 text-sm hover:bg-panel-2">
          <input type="radio" name="group" checked={isNew} onChange={() => setChoice("new")} className="accent-[var(--ink)]" />
          New group
        </label>
        {isNew && <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="field" placeholder="Group name" />}
      </div>
      <p className="hint mt-3">Groups decide who sees tests assigned to them. Members don&apos;t see group names.</p>
    </Dialog>
  );
}
