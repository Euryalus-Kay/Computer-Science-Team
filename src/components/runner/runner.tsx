"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Flag,
  X,
  Check,
  LoaderCircle,
  Maximize2,
  Pause,
  EyeOff,
  TriangleAlert,
  CloudOff,
  PanelLeft,
} from "lucide-react";
import { LogoMark } from "@/components/shell/logo";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ItemView } from "@/components/items/item-view";
import { Workspace, type WorkspaceProblem } from "@/components/problems/workspace";
import type { PublicItem } from "@/lib/items/types";
import type { IntegrityConfig } from "@/lib/db/schema";
import { cn } from "@/lib/cn";
import { hasContent } from "@/lib/items/answered";
import { useIntegrity } from "./integrity";
import { CameraMonitor } from "./camera";

export type RunnerItem = PublicItem & { widget?: string; problem?: WorkspaceProblem; languages?: string[] | null };

export type RunnerProps = {
  attemptId: string;
  preview: boolean;
  contest: { id: string; slug: string; title: string; integrity: IntegrityConfig };
  items: RunnerItem[];
  answers: Record<string, { response: unknown; state: unknown; status: string }>;
  resources: { id: string; title: string; html: string }[];
  remainingMs: number | null;
  paused: boolean;
  desktop: boolean;
};

function isAnswered(item: RunnerItem, response: unknown, state: unknown, status?: string): boolean {
  if (item.type === "code") return status === "graded";
  if (item.widget === "lock") return Boolean((state as { guesses?: unknown[] })?.guesses?.length);
  if (item.widget === "door") return Boolean((state as { history?: unknown[] })?.history?.length);
  return hasContent(response, item.widget);
}

function fmt(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

export function Runner(props: RunnerProps) {
  const { attemptId, items, contest } = props;
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(Object.entries(props.answers).map(([k, v]) => [k, v.response])),
  );
  const [states, setStates] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(Object.entries(props.answers).map(([k, v]) => [k, v.state])),
  );
  const [statuses, setStatuses] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(props.answers).map(([k, v]) => [k, v.status])),
  );
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [deadline, setDeadline] = useState<number | null>(props.remainingMs === null ? null : Date.now() + props.remainingMs);
  const [now, setNow] = useState(() => Date.now());
  const [paused, setPaused] = useState(props.paused);
  // Time left as the server reported it while paused, so the clock doesn't tick between check-ins.
  const [frozen, setFrozen] = useState<number | null>(props.paused ? props.remainingMs : null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [refOpen, setRefOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [needFullscreen, setNeedFullscreen] = useState(false);
  const [showTime, setShowTime] = useState(true);
  const [offline, setOffline] = useState(false);

  const item = items[index];
  const pendingSaves = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const latest = useRef(responses);
  latest.current = responses;
  const times = useRef<Record<string, number>>({});
  const viewStart = useRef<number>(Date.now());
  const currentId = useRef(item?.id ?? null);
  const finished = useRef(false);
  // People moved in automatically at a live start haven't been in full screen yet.
  const beenFullscreen = useRef(false);

  const integrity = useIntegrity({
    attemptId,
    title: contest.title,
    active: true,
    blockPaste: contest.integrity.blockPaste,
    scanApps: contest.integrity.scanApps !== false,
    currentItem: () => currentId.current,
    onReturn: (away) => {
      if (contest.integrity.warnOnLeave && away >= 1500) {
        setNotice(`You left the test for ${Math.round(away / 1000)} s. That is recorded.`);
        beat();
      }
    },
    onFullscreenChange: (on) => {
      if (on) beenFullscreen.current = true;
      if (contest.integrity.requireFullscreen && !props.desktop) setNeedFullscreen(!on);
    },
  });

  // Flags persist locally.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`attempt:${attemptId}:flags`);
      if (raw) setFlags(new Set(JSON.parse(raw)));
      const ix = Number(localStorage.getItem(`attempt:${attemptId}:index`));
      if (ix > 0 && ix < items.length) setIndex(ix);
    } catch {}
  }, [attemptId, items.length]);
  useEffect(() => {
    try {
      localStorage.setItem(`attempt:${attemptId}:flags`, JSON.stringify([...flags]));
      localStorage.setItem(`attempt:${attemptId}:index`, String(index));
    } catch {}
  }, [flags, index, attemptId]);

  // Time on question.
  const accrue = useCallback(() => {
    const id = currentId.current;
    const t = Date.now();
    if (id && !document.hidden) times.current[id] = (times.current[id] ?? 0) + (t - viewStart.current);
    viewStart.current = t;
  }, []);
  useEffect(() => {
    accrue();
    currentId.current = item?.id ?? null;
  }, [item?.id, accrue]);
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) accrue();
      else viewStart.current = Date.now();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [accrue]);

  const save = useCallback(
    async (itemId: string) => {
      setSaveState("saving");
      try {
        const res = await fetch(`/api/attempts/${attemptId}/answer`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ itemId, response: latest.current[itemId] ?? null }),
        });
        const j = await res.json().catch(() => ({}));
        if (res.status === 409 && j.closed) {
          finished.current = true;
          router.refresh();
          return;
        }
        if (!res.ok) throw new Error(j.error);
        setSaveState("saved");
        setOffline(false);
        setStatuses((s) => ({ ...s, [itemId]: "saved" }));
      } catch {
        setSaveState("error");
        setOffline(true);
        // retry shortly
        const t = setTimeout(() => save(itemId), 4000);
        pendingSaves.current.set(itemId, t);
      }
    },
    [attemptId, router],
  );

  const flushSaves = useCallback(async () => {
    const ids = [...pendingSaves.current.keys()];
    for (const t of pendingSaves.current.values()) clearTimeout(t);
    pendingSaves.current.clear();
    await Promise.all(ids.map((id) => save(id)));
  }, [save]);

  const change = (itemId: string, v: unknown) => {
    setResponses((r) => ({ ...r, [itemId]: v }));
    latest.current = { ...latest.current, [itemId]: v };
    const old = pendingSaves.current.get(itemId);
    if (old) clearTimeout(old);
    setSaveState("saving");
    pendingSaves.current.set(
      itemId,
      setTimeout(() => {
        pendingSaves.current.delete(itemId);
        save(itemId);
      }, 650),
    );
  };

  const interact = async (itemId: string, action: unknown) => {
    const res = await fetch(`/api/attempts/${attemptId}/interact`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemId, action }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? "Failed");
    setStates((s) => ({ ...s, [itemId]: j.reply }));
    setStatuses((s) => ({ ...s, [itemId]: "graded" }));
    return j.reply;
  };

  const beat = useCallback(async () => {
    if (finished.current) return;
    accrue();
    const sent = times.current;
    times.current = {};
    const events = integrity.drain();
    try {
      const res = await fetch(`/api/attempts/${attemptId}/beat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ times: sent, events }),
      });
      if (!res.ok) throw new Error();
      const j = await res.json();
      setOffline(false);
      if (j.status !== "active") {
        finished.current = true;
        router.refresh();
        return;
      }
      setPaused(Boolean(j.paused));
      setFrozen(j.paused && typeof j.remainingMs === "number" ? j.remainingMs : null);
      if (typeof j.remainingMs === "number") setDeadline(Date.now() + j.remainingMs);
    } catch {
      setOffline(true);
      // keep the data for the next beat
      for (const [k, v] of Object.entries(sent)) times.current[k] = (times.current[k] ?? 0) + v;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId, accrue, router]);

  useEffect(() => {
    beat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    // Every 10 s, and every 2 s while paused so everyone picks up the resume quickly.
    const t = setInterval(beat, paused ? 2000 : 10_000);
    return () => clearInterval(t);
  }, [beat, paused]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    const open = () => setRefOpen(true);
    window.addEventListener("labcs:open-reference", open);
    return () => window.removeEventListener("labcs:open-reference", open);
  }, []);

  useEffect(() => {
    if (document.fullscreenElement) beenFullscreen.current = true;
    else if (contest.integrity.requireFullscreen && !props.desktop) setNeedFullscreen(true);
  }, [contest.integrity.requireFullscreen, props.desktop]);

  const submit = useCallback(
    async (auto = false) => {
      if (finished.current && !auto) return;
      setSubmitting(true);
      await flushSaves();
      await beat();
      finished.current = true;
      await fetch(`/api/attempts/${attemptId}/submit`, { method: "POST" });
      window.labcsDesktop?.testEnded();
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
      } catch {}
      router.refresh();
    },
    [attemptId, beat, flushSaves, router],
  );

  const remaining = deadline === null ? null : paused && frozen !== null ? frozen : Math.max(0, deadline - now);
  useEffect(() => {
    if (remaining === 0 && !paused && !timeUp) {
      setTimeUp(true);
      submit(true);
    }
  }, [remaining, paused, timeUp, submit]);

  // Arrow keys move between questions when focus isn't in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowRight") setIndex((i) => Math.min(items.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items.length]);

  const answeredCount = items.filter((it) => isAnswered(it, responses[it.id], states[it.id], statuses[it.id])).length;
  const sections = useMemo(() => {
    const out: { section: string | null; items: { item: RunnerItem; i: number }[] }[] = [];
    items.forEach((it, i) => {
      const last = out[out.length - 1];
      if (last && last.section === it.section) last.items.push({ item: it, i });
      else out.push({ section: it.section, items: [{ item: it, i }] });
    });
    return out;
  }, [items]);

  const go = (i: number) => {
    setIndex(Math.max(0, Math.min(items.length - 1, i)));
    document.getElementById("runner-main")?.scrollTo({ top: 0 });
  };

  const timerTone = remaining === null ? "" : remaining < 60_000 ? "bg-red text-white" : remaining < 5 * 60_000 ? "bg-amber-soft text-amber" : "bg-panel-3 text-ink";
  const isCode = item?.type === "code";

  return (
    <div className="flex h-dvh flex-col bg-bg select-none [&_input]:select-text [&_textarea]:select-text [&_.cm-content]:select-text">
      {/* header */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel px-3 sm:px-4">
        <button onClick={() => setRailOpen((o) => !o)} className="hidden rounded-md p-1.5 text-ink-3 hover:bg-panel-3 hover:text-ink md:block" aria-label="Toggle questions">
          <PanelLeft className="size-4" />
        </button>
        <LogoMark size={22} className="text-ink" />
        <div className="min-w-0">
          <div className="truncate text-[14.5px] font-semibold">{contest.title}</div>
          <div className="num text-xs text-ink-3">
            {answeredCount} of {items.length} answered
            {props.preview && <span className="ml-2 rounded bg-blue-soft px-1.5 py-px font-medium text-blue">Preview</span>}
          </div>
        </div>
        <div className="flex-1" />
        <div className="hidden items-center gap-1.5 text-xs text-ink-3 sm:flex" aria-live="polite">
          {offline ? (
            <span className="inline-flex items-center gap-1 text-amber">
              <CloudOff className="size-3.5" /> Reconnecting
            </span>
          ) : saveState === "saving" ? (
            <span className="inline-flex items-center gap-1">
              <LoaderCircle className="size-3.5 animate-spin" /> Saving
            </span>
          ) : saveState === "saved" ? (
            <span className="inline-flex items-center gap-1">
              <Check className="size-3.5" /> Saved
            </span>
          ) : null}
        </div>
        {props.resources.length > 0 && (
          <Button size="sm" variant={refOpen ? "primary" : "secondary"} icon={<BookOpen className="size-3.5" />} onClick={() => setRefOpen((o) => !o)}>
            <span className="hidden sm:inline">Reference</span>
          </Button>
        )}
        {remaining !== null && (
          <button
            onClick={() => setShowTime((s) => !s)}
            className={cn("num flex h-8 items-center gap-1.5 rounded-md px-2.5 font-mono text-[15px] font-semibold tabular-nums", timerTone, remaining < 60_000 && "pulse-dot")}
            title={showTime ? "Hide timer" : "Show timer"}
          >
            {paused ? <Pause className="size-3.5" /> : showTime ? null : <EyeOff className="size-3.5" />}
            {showTime ? fmt(remaining) : "Time"}
          </button>
        )}
        <Button variant="primary" size="sm" onClick={() => setConfirmOpen(true)} disabled={submitting}>
          Submit
        </Button>
      </header>

      {notice && (
        <div className="animate-in absolute top-16 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-ink px-3.5 py-2 text-sm text-panel shadow-pop">
          <TriangleAlert className="size-4 text-amber" /> {notice}
          <button onClick={() => setNotice(null)} className="ml-1 text-panel/60 hover:text-panel" aria-label="Dismiss">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* rail */}
        {railOpen && (
          <nav className="hidden w-[232px] shrink-0 overflow-y-auto border-r border-line bg-panel py-3 md:block" aria-label="Questions">
            {sections.map((sec, si) => (
              <div key={si} className="mb-2">
                {sec.section && <div className="px-4 pt-2 pb-1 text-[11px] font-medium tracking-wide text-ink-4 uppercase">{sec.section}</div>}
                {sec.items.map(({ item: it, i }) => {
                  const done = isAnswered(it, responses[it.id], states[it.id], statuses[it.id]);
                  const active = i === index;
                  return (
                    <button
                      key={it.id}
                      onClick={() => go(i)}
                      className={cn(
                        "flex h-8 w-full items-center gap-2.5 px-4 text-left text-[13px]",
                        active ? "bg-panel-3 font-medium text-ink" : "text-ink-2 hover:bg-panel-2",
                      )}
                    >
                      <span className="num w-5 shrink-0 text-right font-mono text-xs text-ink-4">{i + 1}</span>
                      <span className={cn("size-2 shrink-0 rounded-full", done ? "bg-accent" : "border border-line-2")} />
                      <span className="min-w-0 flex-1 truncate">{it.title || `Question ${i + 1}`}</span>
                      {flags.has(it.id) && <Flag className="size-3 shrink-0 fill-amber text-amber" />}
                      <span className="num shrink-0 font-mono text-[11px] text-ink-4">{it.points}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        )}

        {/* main */}
        <main id="runner-main" className={cn("min-w-0 flex-1", isCode ? "flex flex-col overflow-hidden" : "overflow-y-auto")}>
          {/* mobile strip */}
          <div className="flex gap-1 overflow-x-auto border-b border-line bg-panel px-3 py-2 md:hidden">
            {items.map((it, i) => (
              <button
                key={it.id}
                onClick={() => go(i)}
                className={cn(
                  "num flex size-8 shrink-0 items-center justify-center rounded-md font-mono text-xs",
                  i === index ? "bg-ink text-panel" : isAnswered(it, responses[it.id], states[it.id], statuses[it.id]) ? "bg-accent-soft text-accent-ink" : "bg-panel-3 text-ink-3",
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>
          {item &&
            (isCode && item.problem ? (
              <div className="min-h-0 flex-1">
                <Workspace
                  key={item.id}
                  problem={item.problem}
                  storageKey={`attempt:${attemptId}:${item.id}`}
                  runUrl={`/api/attempts/${attemptId}/code/run?item=${item.id}`}
                  submitUrl={`/api/attempts/${attemptId}/code/submit?item=${item.id}`}
                  allowedLanguages={item.languages ?? undefined}
                  height="h-full"
                  submitLabel="Submit"
                  onSubmitted={() => setStatuses((s) => ({ ...s, [item.id]: "graded" }))}
                  statementHeader={<QuestionHeader index={index} total={items.length} item={item} flagged={flags.has(item.id)} onFlag={() => toggleFlag(item.id)} onGo={go} />}
                  onPaste={(t) => integrity.push("paste", { chars: t.length, editor: true })}
                />
              </div>
            ) : (
              <div className="mx-auto max-w-[900px] px-5 py-7 sm:px-10">
                <QuestionHeader index={index} total={items.length} item={item} flagged={flags.has(item.id)} onFlag={() => toggleFlag(item.id)} />
                {item.promptHtml && <div className="prose mb-6 max-w-none text-[15px]" dangerouslySetInnerHTML={{ __html: item.promptHtml }} />}
                <div key={item.id} className="animate-in">
                  <ItemView
                    item={item}
                    widget={item.widget}
                    value={(responses[item.id] as never) ?? null}
                    state={(states[item.id] as never) ?? null}
                    onChange={(v) => change(item.id, v)}
                    interact={(a) => interact(item.id, a)}
                    disabled={paused || submitting}
                    log={(type, data) => integrity.push(type, data)}
                  />
                </div>
                <div className="mt-10 flex items-center justify-between border-t border-line pt-5">
                  <Button variant="ghost" icon={<ChevronLeft className="size-4" />} onClick={() => go(index - 1)} disabled={index === 0}>
                    Previous
                  </Button>
                  {index < items.length - 1 ? (
                    <Button variant="secondary" onClick={() => go(index + 1)}>
                      Next <ChevronRight className="size-4" />
                    </Button>
                  ) : (
                    <Button variant="primary" onClick={() => setConfirmOpen(true)}>
                      Finish
                    </Button>
                  )}
                </div>
              </div>
            ))}
        </main>

        {/* reference drawer */}
        {refOpen && (
          <aside className="animate-in hidden w-[440px] shrink-0 overflow-y-auto border-l border-line bg-panel lg:block">
            <div className="sticky top-0 z-10 flex h-11 items-center justify-between border-b border-line bg-panel px-4">
              <span className="text-sm font-semibold">{props.resources[0]?.title ?? "Reference"}</span>
              <button onClick={() => setRefOpen(false)} className="rounded p-1 text-ink-3 hover:bg-panel-3" aria-label="Close reference">
                <X className="size-4" />
              </button>
            </div>
            {props.resources.map((r) => (
              <div key={r.id} className="px-5 py-4">
                {props.resources.length > 1 && <h3 className="mb-2 text-sm font-semibold">{r.title}</h3>}
                <div className="prose text-[13.5px] [&_pre]:text-[12.5px]" dangerouslySetInnerHTML={{ __html: r.html }} />
              </div>
            ))}
          </aside>
        )}
      </div>

      {contest.integrity.camera && !props.preview && <CameraMonitor attemptId={attemptId} onEvent={(t, d) => integrity.push(t, d)} />}

      {/* overlays */}
      {(paused || timeUp || needFullscreen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,12,15,0.55)] backdrop-blur-sm">
          <div className="animate-in w-[min(92vw,380px)] rounded-xl bg-panel p-6 text-center shadow-pop">
            {timeUp ? (
              <>
                <div className="text-lg font-semibold">Time&apos;s up</div>
                <div className="mt-1 flex items-center justify-center gap-2 text-sm text-ink-3">
                  <LoaderCircle className="size-4 animate-spin" /> Submitting your answers
                </div>
              </>
            ) : paused ? (
              <>
                <Pause className="mx-auto mb-2 size-6 text-ink-3" />
                <div className="text-lg font-semibold">Paused</div>
                <div className="mt-1 text-sm text-ink-3">The clock is stopped. Wait for the go-ahead.</div>
              </>
            ) : (
              <>
                <Maximize2 className="mx-auto mb-2 size-6 text-ink-3" />
                <div className="text-lg font-semibold">{beenFullscreen.current ? "Full screen required" : "This test runs in full screen"}</div>
                <div className="mt-1 mb-4 text-sm text-ink-3">Leaving full screen is recorded.</div>
                <Button
                  variant="primary"
                  onClick={async () => {
                    try {
                      await document.documentElement.requestFullscreen();
                      setNeedFullscreen(false);
                    } catch {}
                  }}
                >
                  {beenFullscreen.current ? "Return to full screen" : "Go full screen"}
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Submit your test?"
        width={420}
        footer={
          <>
            <Button onClick={() => setConfirmOpen(false)}>Keep working</Button>
            <Button
              variant="primary"
              disabled={submitting}
              onClick={() => {
                setConfirmOpen(false);
                submit();
              }}
            >
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-sm text-ink-2">
          <p>
            You answered <b className="text-ink">{answeredCount}</b> of {items.length} questions.
            {flags.size > 0 && (
              <>
                {" "}
                {flags.size} {flags.size === 1 ? "is" : "are"} flagged for review.
              </>
            )}
          </p>
          {remaining !== null && <p>{fmt(remaining)} left on the clock. You can&apos;t change answers after submitting.</p>}
        </div>
      </Dialog>
    </div>
  );

  function toggleFlag(id: string) {
    setFlags((f) => {
      const n = new Set(f);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
}

function QuestionHeader({
  index,
  total,
  item,
  flagged,
  onFlag,
  onGo,
}: {
  index: number;
  total: number;
  item: RunnerItem;
  flagged: boolean;
  onFlag: () => void;
  /** Code questions have no footer, so they get Previous and Next up here. */
  onGo?: (i: number) => void;
}) {
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="num flex items-center gap-2 text-xs text-ink-3">
          <span>
            Question {index + 1} of {total}
          </span>
          <span className="h-3 w-px bg-line-2" />
          <span>
            {item.points} {item.points === 1 ? "point" : "points"}
          </span>
          {item.grading !== "auto" && (
            <>
              <span className="h-3 w-px bg-line-2" />
              <span>{item.grading === "ai" ? "Graded by Claude" : "Graded by hand"}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onFlag}
            className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs", flagged ? "bg-amber-soft text-amber" : "text-ink-3 hover:bg-panel-3")}
          >
            <Flag className={cn("size-3.5", flagged && "fill-amber")} /> {flagged ? "Flagged" : "Flag"}
          </button>
          {onGo && (
            <>
              <button onClick={() => onGo(index - 1)} disabled={index === 0} className="rounded-md p-1 text-ink-3 hover:bg-panel-3 hover:text-ink disabled:opacity-30" aria-label="Previous question">
                <ChevronLeft className="size-4" />
              </button>
              <button onClick={() => onGo(index + 1)} disabled={index === total - 1} className="rounded-md p-1 text-ink-3 hover:bg-panel-3 hover:text-ink disabled:opacity-30" aria-label="Next question">
                <ChevronRight className="size-4" />
              </button>
            </>
          )}
        </div>
      </div>
      {item.title && <h2 className="text-xl font-semibold tracking-[-0.01em]">{item.title}</h2>}
    </div>
  );
}

