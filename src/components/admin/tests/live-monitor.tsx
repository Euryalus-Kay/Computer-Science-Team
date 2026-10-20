"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Play,
  Pause,
  Square,
  Plus,
  Minus,
  RotateCcw,
  MoreHorizontal,
  Clock,
  Send,
  Trash2,
  Undo2,
  Eye,
  KeyRound,
  CircleCheck,
  Users,
  ShieldAlert,
  Activity,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { Dialog } from "@/components/ui/dialog";
import { Empty } from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { pts, formatTime } from "@/lib/format";
import type { LiveSnapshot, LiveRow } from "@/lib/admin/live";
import {
  addAttemptTime,
  addTestTime,
  deleteAttempt,
  endTestNow,
  forceSubmit,
  livePause,
  liveReset,
  liveStart,
  reopenAttempt,
  setOpenWindow,
  setTestStatus,
} from "@/lib/admin/tests";
import { useNow } from "@/lib/use-now";
import { clock, LevelPill, ClientIcon, Progress, Dot } from "./bits";

type Test = {
  id: string;
  status: "draft" | "published" | "archived";
  startMode: "open" | "live";
  durationMin: number | null;
  lockdown: string;
  exitCode: string;
  timezone: string;
};

type Sort = "name" | "progress" | "score" | "risk";

export function LiveMonitor({ test, initial }: { test: Test; initial: LiveSnapshot }) {
  const router = useRouter();
  const toast = useToast();
  const [snap, setSnap] = useState(initial);
  const [offset, setOffset] = useState(0);
  const [sort, setSort] = useState<Sort>("name");
  const [showPreviews, setShowPreviews] = useState(false);
  const [confirm, setConfirm] = useState<null | "end" | "reset">(null);
  const [pending, start] = useTransition();
  const tick = useNow(250);
  // Until mounted, render with the server's clock so hydration matches.
  const now = tick === null ? initial.serverNow : tick + offset;
  const fetching = useRef(false);

  const refresh = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      const r = await fetch(`/api/admin/tests/${test.id}/live${showPreviews ? "?previews=1" : ""}`, { cache: "no-store" });
      if (r.ok) {
        const j = (await r.json()) as LiveSnapshot;
        setOffset(j.serverNow - Date.now());
        setSnap(j);
      }
    } finally {
      fetching.current = false;
    }
  }, [test.id, showPreviews]);

  useEffect(() => {
    refresh();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 2500);
    return () => clearInterval(t);
  }, [refresh]);

  const act = (p: Promise<{ ok: boolean; error?: string }>, done?: string) =>
    start(async () => {
      const r = await p;
      if (!r.ok) toast(r.error ?? "Something went wrong", "error");
      else if (done) toast(done);
      await refresh();
      router.refresh();
    });

  const rows = useMemo(() => {
    const list = [...snap.rows];
    const cmp: Record<Sort, (a: LiveRow, b: LiveRow) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      progress: (a, b) => b.answered - a.answered || b.frontier - a.frontier,
      score: (a, b) => b.score - a.score,
      risk: (a, b) => b.risk - a.risk,
    };
    return list.sort(cmp[sort]);
  }, [snap.rows, sort]);

  const real = snap.rows.filter((r) => !r.preview);
  const working = real.filter((r) => r.status === "active");
  const done = real.filter((r) => r.status !== "active");
  const flagged = real.filter((r) => r.level === "medium" || r.level === "high");
  const s = snap.state;
  const live = test.startMode === "live";

  return (
    <div className="space-y-5">
      <ControlBar
        test={test}
        snap={snap}
        now={now}
        pending={pending}
        onStart={(sec) => act(liveStart(test.id, sec))}
        onPause={(p) => act(livePause(test.id, p), p ? "Paused for everyone" : "Resumed")}
        onAdd={(sec) => act(addTestTime(test.id, sec), sec > 0 ? `Added ${sec / 60} min for everyone` : `Removed ${-sec / 60} min`)}
        onEnd={() => setConfirm("end")}
        onReset={() => setConfirm("reset")}
        onPublish={() => act(setTestStatus(test.id, "published"), "Published")}
        onOpenNow={() => act(setOpenWindow(test.id, { opensAt: null, closesAt: null }), "Open")}
      />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
        <Tile icon={<Activity className="size-4" />} label="Working" value={working.length} />
        <Tile icon={<CircleCheck className="size-4" />} label="Submitted" value={done.length} />
        <Tile icon={<Users className="size-4" />} label="Not started" value={snap.waiting.length} />
        <Tile icon={<ShieldAlert className="size-4" />} label="Flagged" value={flagged.length} tone={flagged.length ? "amber" : undefined} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="card min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
            <div className="flex items-center gap-1 rounded-md bg-panel-3 p-0.5 text-xs">
              {(["name", "progress", "score", "risk"] as Sort[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setSort(k)}
                  className={cn("h-6 rounded-[5px] px-2 capitalize text-ink-3", sort === k && "bg-panel font-medium text-ink shadow-card")}
                >
                  {k === "risk" ? "Flags" : k}
                </button>
              ))}
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-3">
              <input type="checkbox" checked={showPreviews} onChange={(e) => setShowPreviews(e.target.checked)} className="accent-[var(--ink)]" />
              Include previews
            </label>
          </div>
          {rows.length === 0 ? (
            <Empty
              title={live && (s.state === "waiting" || s.state === "countdown") ? "Nobody has started yet" : "No attempts yet"}
              icon={<Users className="size-6" />}
            >
              {live && s.state === "waiting" ? "Members who open the test wait in the lobby until you start it." : null}
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th className="text-right">Score</th>
                    <th className="text-right">Time left</th>
                    <th>Integrity</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <Row key={r.attemptId} r={r} testId={test.id} questions={snap.questions} now={now} serverNow={snap.serverNow} paused={snap.paused} act={act} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {snap.waiting.length > 0 && (
            <div className="border-t border-line px-4 py-3">
              <div className="mb-2 text-xs font-medium text-ink-3">Not started</div>
              <div className="flex flex-wrap gap-1.5">
                {snap.waiting.map((u) => (
                  <span key={u.id} className="rounded-md bg-panel-3 px-2 py-0.5 text-xs text-ink-2">
                    {u.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card flex max-h-[640px] min-h-[240px] flex-col">
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-line px-4">
            <div className="text-sm font-medium">Activity</div>
            <span className="flex items-center gap-1.5 text-xs text-ink-4">
              <span className="pulse-dot inline-block size-1.5 rounded-full bg-accent" /> live
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {snap.feed.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-ink-3">Nothing flagged.</div>
            ) : (
              <ul className="divide-y divide-line">
                {snap.feed.map((e) => (
                  <li key={e.id} className="flex gap-3 px-4 py-2.5 text-sm">
                    <span
                      className={cn(
                        "mt-1.5 size-1.5 shrink-0 rounded-full",
                        e.severity === "high" ? "bg-red" : e.severity === "medium" ? "bg-amber" : "bg-ink-4",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">
                        <Link href={`/admin/tests/${test.id}/attempts/${e.attemptId}`} className="font-medium hover:underline">
                          {e.name}
                        </Link>{" "}
                        <span className="text-ink-2">{e.label.charAt(0).toLowerCase() + e.label.slice(1)}</span>
                      </div>
                      <div className="text-xs text-ink-4">
                        {formatTime(e.at, test.timezone)}
                        {e.item ? ` · ${e.item}` : ""}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {test.lockdown !== "none" && (
        <div className="flex items-center gap-2 text-sm text-ink-3">
          <KeyRound className="size-4 text-ink-4" />
          Exit code for the lockdown app <span className="font-mono font-semibold tracking-widest text-ink">{test.exitCode}</span>
          <button
            className="rounded p-1 text-ink-4 hover:bg-panel-3 hover:text-ink"
            onClick={() => {
              navigator.clipboard.writeText(test.exitCode);
              toast("Copied");
            }}
            aria-label="Copy exit code"
          >
            <Copy className="size-3.5" />
          </button>
        </div>
      )}

      <Dialog
        open={confirm === "end"}
        onClose={() => setConfirm(null)}
        title="End the test now?"
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirm(null);
                act(endTestNow(test.id), "Ended. Everyone still working was submitted.");
              }}
            >
              End now
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">Everyone still working is submitted with the answers they have saved.</p>
      </Dialog>
      <Dialog
        open={confirm === "reset"}
        onClose={() => setConfirm(null)}
        title="Run this test again?"
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                setConfirm(null);
                act(liveReset(test.id), "Ready to start again");
              }}
            >
              Reset the start
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          The test goes back to waiting for you to start it. Attempts already taken stay in the results, and those members can&apos;t take it again unless you delete
          their attempt.
        </p>
      </Dialog>
    </div>
  );
}

function Tile({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: "amber" }) {
  return (
    <div className="bg-panel px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-ink-3">
        <span className="text-ink-4">{icon}</span>
        {label}
      </div>
      <div className={cn("num mt-1 text-2xl font-semibold tracking-[-0.02em]", tone === "amber" && "text-amber")}>{value}</div>
    </div>
  );
}

function ControlBar({
  test,
  snap,
  now,
  pending,
  onStart,
  onPause,
  onAdd,
  onEnd,
  onReset,
  onPublish,
  onOpenNow,
}: {
  test: Test;
  snap: LiveSnapshot;
  now: number;
  pending: boolean;
  onStart: (sec: number) => void;
  onPause: (pause: boolean) => void;
  onAdd: (sec: number) => void;
  onEnd: () => void;
  onReset: () => void;
  onPublish: () => void;
  onOpenNow: () => void;
}) {
  const s = snap.state;
  const live = test.startMode === "live";
  const total = (test.durationMin ?? 0) * 60_000;
  let big: React.ReactNode = null;
  let label = "";
  let progress: number | null = null;
  let actions: React.ReactNode = null;

  if (test.status === "draft") {
    label = "Draft";
    big = <span className="text-ink-3">Not published</span>;
    actions = (
      <>
        {live && (
          <Button variant="accent" size="lg" icon={<Play className="size-4 fill-current" />} disabled={pending} onClick={() => onStart(5)}>
            Start
          </Button>
        )}
        <Button size="lg" disabled={pending} onClick={onPublish}>
          Publish
        </Button>
      </>
    );
  } else if (s.state === "waiting") {
    label = "Ready";
    big = <span>{test.durationMin ? clock(total) : "Untimed"}</span>;
    actions = (
      <>
        <StartMenu pending={pending} onStart={onStart} />
      </>
    );
  } else if (s.state === "countdown") {
    label = "Starting in";
    big = <span className="text-accent">{Math.max(0, Math.ceil((s.startsAt - now) / 1000))}</span>;
    actions = (
      <Button size="lg" icon={<RotateCcw className="size-4" />} disabled={pending} onClick={onReset}>
        Cancel
      </Button>
    );
  } else if (s.state === "open") {
    if (live || s.closesAt) {
      const left = s.closesAt ? (snap.paused ? s.closesAt - snap.serverNow : s.closesAt - now) : null;
      label = snap.paused ? "Paused" : "Time left";
      big = <span className={cn(snap.paused && "text-amber")}>{left === null ? "Open" : clock(left)}</span>;
      if (left !== null && total) progress = Math.max(0, Math.min(1, 1 - left / Math.max(total, left)));
    } else {
      label = "Open";
      big = <span>No close time</span>;
    }
    actions = live ? (
      <>
        {snap.paused ? (
          <Button variant="accent" size="lg" icon={<Play className="size-4 fill-current" />} disabled={pending} onClick={() => onPause(false)}>
            Resume
          </Button>
        ) : (
          <Button size="lg" icon={<Pause className="size-4" />} disabled={pending} onClick={() => onPause(true)}>
            Pause
          </Button>
        )}
        <Button size="lg" icon={<Plus className="size-4" />} disabled={pending} onClick={() => onAdd(60)}>
          1 min
        </Button>
        <Button size="lg" icon={<Plus className="size-4" />} disabled={pending} onClick={() => onAdd(300)} className="hidden sm:inline-flex">
          5 min
        </Button>
        <Button variant="danger" size="lg" icon={<Square className="size-3.5 fill-current" />} disabled={pending} onClick={onEnd}>
          End
        </Button>
        <Menu
          trigger={({ toggle }) => (
            <Button size="lg" onClick={toggle} aria-label="More" className="px-2.5">
              <MoreHorizontal className="size-4" />
            </Button>
          )}
        >
          {(close) => (
            <>
              <MenuItem icon={<Plus />} onClick={() => (close(), onAdd(600))}>
                Add 10 min
              </MenuItem>
              <MenuItem icon={<Minus />} onClick={() => (close(), onAdd(-60))}>
                Remove 1 min
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={<RotateCcw />} onClick={() => (close(), onReset())}>
                Reset the start
              </MenuItem>
            </>
          )}
        </Menu>
      </>
    ) : (
      <Button variant="danger" size="lg" icon={<Square className="size-3.5 fill-current" />} disabled={pending} onClick={onEnd}>
        Close now
      </Button>
    );
  } else if (s.state === "scheduled") {
    label = "Opens in";
    big = <span>{clock(s.opensAt - now)}</span>;
    actions = (
      <Button variant="accent" size="lg" disabled={pending} onClick={onOpenNow}>
        Open now
      </Button>
    );
  } else if (s.state === "closed" && live && test.status !== "archived" && snap.rows.some((r) => !r.preview && r.status === "active")) {
    // Late starters keep their full time after the shared end.
    label = "Late starters finishing";
    big = <span>{snap.rows.filter((r) => !r.preview && r.status === "active").length} still working</span>;
    actions = (
      <>
        <Link href={`/admin/tests/${test.id}/results`} className="inline-flex h-10 items-center rounded-md bg-ink px-4 text-base font-medium text-panel hover:bg-ink/85">
          Results
        </Link>
        <Button variant="danger" size="lg" icon={<Square className="size-3.5 fill-current" />} disabled={pending} onClick={onEnd}>
          End now
        </Button>
      </>
    );
  } else if (s.state === "closed") {
    label = test.status === "archived" ? "Archived" : "Ended";
    big = <span className="text-ink-3">Closed</span>;
    actions = (
      <>
        <Link href={`/admin/tests/${test.id}/results`} className="inline-flex h-10 items-center rounded-md bg-ink px-4 text-base font-medium text-panel hover:bg-ink/85">
          Results
        </Link>
        {live ? (
          <Button size="lg" icon={<RotateCcw className="size-4" />} disabled={pending} onClick={onReset}>
            Run again
          </Button>
        ) : (
          <Button size="lg" disabled={pending} onClick={onOpenNow}>
            Reopen
          </Button>
        )}
      </>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div>
          <div className="text-xs font-medium text-ink-3">{label}</div>
          <div className="num font-mono text-[34px] leading-tight font-semibold tracking-[-0.02em]">{big}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>
      {progress !== null && (
        <div className="h-1 bg-panel-3">
          <div className={cn("h-full transition-[width] duration-300", snap.paused ? "bg-amber" : "bg-accent")} style={{ width: `${progress * 100}%` }} />
        </div>
      )}
    </div>
  );
}

function StartMenu({ pending, onStart }: { pending: boolean; onStart: (sec: number) => void }) {
  return (
    <div className="flex">
      <Button
        variant="accent"
        size="lg"
        icon={<Play className="size-4 fill-current" />}
        disabled={pending}
        onClick={() => onStart(5)}
        className="rounded-r-none"
      >
        Start
      </Button>
      <Menu
        trigger={({ toggle }) => (
          <Button variant="accent" size="lg" onClick={toggle} className="rounded-l-none border-l border-white/20 px-2" aria-label="Start options">
            <Clock className="size-4" />
          </Button>
        )}
      >
        {(close) => (
          <>
            {[
              [0, "Start now"],
              [10, "10 second countdown"],
              [30, "30 second countdown"],
              [60, "1 minute countdown"],
            ].map(([sec, text]) => (
              <MenuItem key={sec} onClick={() => (close(), onStart(Number(sec)))}>
                {text}
              </MenuItem>
            ))}
          </>
        )}
      </Menu>
    </div>
  );
}

function Row({
  r,
  testId,
  questions,
  now,
  serverNow,
  paused,
  act,
}: {
  r: LiveRow;
  testId: string;
  questions: number;
  now: number;
  serverNow: number;
  paused: boolean;
  act: (p: Promise<{ ok: boolean; error?: string }>, done?: string) => void;
}) {
  const router = useRouter();
  const href = `/admin/tests/${testId}/attempts/${r.attemptId}`;
  const left = r.remainingMs === null ? null : paused ? r.remainingMs : r.remainingMs - (now - serverNow);
  const status =
    r.status === "submitted"
      ? { text: "Submitted", dot: "blue" as const }
      : r.status === "expired"
        ? { text: "Time ran out", dot: "blue" as const }
        : r.away
          ? { text: "Away now", dot: "amber" as const }
          : r.online
            ? { text: "Working", dot: "green" as const }
            : { text: "Not responding", dot: "gray" as const };
  return (
    <tr className={cn(r.away && "bg-amber-soft/40")}>
      <td className="max-w-[220px]">
        <Link href={href} className="block truncate font-medium hover:underline">
          {r.name}
        </Link>
        <div className="flex items-center gap-1.5 text-xs text-ink-4">
          @{r.username} <ClientIcon kind={r.kind} />
          {r.preview && <span className="text-blue">preview</span>}
        </div>
      </td>
      <td>
        <span className="flex items-center gap-2 text-sm whitespace-nowrap">
          <Dot tone={status.dot} />
          {status.text}
        </span>
        {r.status === "active" && r.current && <div className="text-xs text-ink-4">on question {r.current}</div>}
      </td>
      <td className="min-w-[140px]">
        <div className="num mb-1 text-xs text-ink-2">
          {r.answered} / {questions} answered
        </div>
        <Progress value={r.answered} max={questions} tone={r.status === "active" ? "accent" : "ink"} />
      </td>
      <td className="num text-right whitespace-nowrap">
        {pts(r.score)}
        <span className="text-ink-4"> / {pts(r.maxScore)}</span>
        {r.pending > 0 && <div className="text-xs text-amber">{r.pending} to grade</div>}
      </td>
      <td className="num text-right font-mono text-sm">
        {left === null ? <span className="text-ink-4">–</span> : <span className={cn(left < 60_000 && "text-red")}>{clock(left)}</span>}
      </td>
      <td>
        <LevelPill level={r.level} flags={r.flags} />
      </td>
      <td>
        <Menu
          trigger={({ toggle }) => (
            <button onClick={toggle} className="rounded p-1 text-ink-3 hover:bg-panel-3 hover:text-ink" aria-label="Actions">
              <MoreHorizontal className="size-4" />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem icon={<Eye />} onClick={() => (close(), router.push(href))}>
                Open attempt
              </MenuItem>
              {r.status === "active" ? (
                <>
                  <MenuItem icon={<Plus />} onClick={() => (close(), act(addAttemptTime(r.attemptId, 300), `Gave ${r.name} 5 more minutes`))}>
                    Give 5 more minutes
                  </MenuItem>
                  <MenuItem icon={<Plus />} onClick={() => (close(), act(addAttemptTime(r.attemptId, 900), `Gave ${r.name} 15 more minutes`))}>
                    Give 15 more minutes
                  </MenuItem>
                  <MenuItem icon={<Send />} onClick={() => (close(), act(forceSubmit(r.attemptId), "Submitted"))}>
                    Submit for them
                  </MenuItem>
                </>
              ) : (
                <MenuItem icon={<Undo2 />} onClick={() => (close(), act(reopenAttempt(r.attemptId, 5), `Reopened for ${r.name} with 5 minutes`))}>
                  Reopen with 5 minutes
                </MenuItem>
              )}
              <MenuSeparator />
              <MenuItem
                danger
                icon={<Trash2 />}
                onClick={() => {
                  close();
                  if (confirm(`Delete ${r.name}'s attempt? They will be able to take the test again.`)) act(deleteAttempt(r.attemptId), "Attempt deleted");
                }}
              >
                Delete attempt
              </MenuItem>
            </>
          )}
        </Menu>
      </td>
    </tr>
  );
}
