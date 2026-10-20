"use client";

import { useState } from "react";
import { Play, Pause, RotateCcw, Plus, Square, ChevronLeft, ChevronRight, Timer, ListChecks, QrCode, Presentation, Circle } from "lucide-react";
import { cn } from "@/lib/cn";
import type { BoardState } from "@/lib/db/schema";
import type { BoardPatch } from "@/lib/board";
import { addTestTime, endTestNow, livePause, liveStart } from "@/lib/admin/tests";
import type { BoardPayload } from "./screen";

export type Option = { id: string; title: string };

const VIEWS: { id: BoardState["view"]; label: string; icon: typeof Timer }[] = [
  { id: "test", label: "Test", icon: ListChecks },
  { id: "timer", label: "Timer", icon: Timer },
  { id: "join", label: "Join", icon: QrCode },
  { id: "slides", label: "Slides", icon: Presentation },
  { id: "blank", label: "Blank", icon: Circle },
];

const PRESETS = [1, 3, 5, 10, 15, 30];

/**
 * Board controls. `tone` picks colors: "dark" for the dock floating over the
 * projector view, "light" for the remote page.
 */
export function BoardControls({
  data,
  tests,
  decks,
  patch,
  refresh,
  tone = "light",
}: {
  data: BoardPayload;
  tests: Option[];
  decks: Option[];
  patch: (p: BoardPatch) => Promise<void>;
  refresh: () => Promise<void>;
  tone?: "light" | "dark";
}) {
  const s = data.state;
  const dark = tone === "dark";
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState("");
  const run = async (p: Promise<unknown>) => {
    setBusy(true);
    try {
      await p;
      await refresh();
    } finally {
      setBusy(false);
    }
  };
  const btn = cn(
    "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors disabled:opacity-40",
    dark ? "bg-white/10 text-white hover:bg-white/20" : "border border-line-2 bg-panel text-ink shadow-card hover:bg-panel-2",
  );
  const primary = cn(
    "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors disabled:opacity-40",
    dark ? "bg-white text-[#0b0d10] hover:bg-white/85" : "bg-accent text-white hover:bg-accent-hover",
  );
  const field = cn(
    "h-8 rounded-md px-2.5 text-sm outline-none",
    dark ? "border border-white/15 bg-white/10 text-white placeholder:text-white/40 [&>option]:text-black" : "field field-sm w-auto",
  );
  const t = data.test;
  const deck = data.deck;
  const timerRunning = Boolean(s.timer.endsAt);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className={cn("flex rounded-lg p-0.5", dark ? "bg-white/10" : "bg-panel-3")}>
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => patch({ view: v.id })}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm",
              s.view === v.id ? (dark ? "bg-white text-[#0b0d10]" : "bg-panel font-medium text-ink shadow-card") : dark ? "text-white/70 hover:text-white" : "text-ink-3 hover:text-ink",
            )}
          >
            <v.icon className="size-3.5" />
            {v.label}
          </button>
        ))}
      </div>

      {s.view === "test" && (
        <>
          <select value={s.contestId ?? ""} onChange={(e) => patch({ contestId: e.target.value || null })} className={cn(field, "max-w-[220px]")}>
            <option value="">Choose a test</option>
            {tests.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </select>
          {t && t.startMode === "live" && (
            <>
              {t.state.state === "waiting" && (
                <button className={primary} disabled={busy} onClick={() => run(liveStart(t.id, 5))}>
                  <Play className="size-3.5 fill-current" /> Start
                </button>
              )}
              {t.state.state === "open" && (
                <>
                  <button className={t.paused ? primary : btn} disabled={busy} onClick={() => run(livePause(t.id, !t.paused))}>
                    {t.paused ? <Play className="size-3.5 fill-current" /> : <Pause className="size-3.5" />}
                    {t.paused ? "Resume" : "Pause"}
                  </button>
                  <button className={btn} disabled={busy} onClick={() => run(addTestTime(t.id, 60))}>
                    <Plus className="size-3.5" /> 1 min
                  </button>
                  <button
                    className={btn}
                    disabled={busy}
                    onClick={() => {
                      if (confirm("End the test for everyone now?")) run(endTestNow(t.id));
                    }}
                  >
                    <Square className="size-3 fill-current" /> End
                  </button>
                </>
              )}
            </>
          )}
          <Toggle dark={dark} on={s.showLeaderboard} onClick={() => patch({ showLeaderboard: !s.showLeaderboard })}>
            Leaderboard
          </Toggle>
          {s.showLeaderboard && (
            <Toggle dark={dark} on={s.showNames} onClick={() => patch({ showNames: !s.showNames })}>
              Names
            </Toggle>
          )}
        </>
      )}

      {s.view === "timer" && (
        <>
          <div className="flex gap-1">
            {PRESETS.map((m) => (
              <button key={m} className={cn(btn, "px-2")} onClick={() => patch({ timer: { action: "set", durationMs: m * 60_000 } })}>
                {m}m
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const [a, b] = custom.split(":").map(Number);
              const ms = b !== undefined && !Number.isNaN(b) ? (a * 60 + b) * 1000 : (Number(custom) || 0) * 60_000;
              if (ms > 0) patch({ timer: { action: "set", durationMs: ms } });
              setCustom("");
            }}
          >
            <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="mm:ss" className={cn(field, "w-20 font-mono")} />
          </form>
          <button className={primary} onClick={() => patch({ timer: { action: timerRunning ? "pause" : "start" } })}>
            {timerRunning ? <Pause className="size-3.5" /> : <Play className="size-3.5 fill-current" />}
            {timerRunning ? "Pause" : "Start"}
          </button>
          <button className={btn} onClick={() => patch({ timer: { action: "add", ms: 60_000 } })}>
            <Plus className="size-3.5" /> 1 min
          </button>
          <button className={btn} onClick={() => patch({ timer: { action: "reset" } })}>
            <RotateCcw className="size-3.5" /> Reset
          </button>
          <input
            defaultValue={s.timer.label}
            key={s.timer.label}
            onBlur={(e) => e.target.value !== s.timer.label && patch({ timer: { action: "set", durationMs: s.timer.durationMs, label: e.target.value } })}
            placeholder="Label"
            className={cn(field, "w-36")}
          />
        </>
      )}

      {s.view === "slides" && (
        <>
          <select value={s.deckId ?? ""} onChange={(e) => patch({ deckId: e.target.value || null, slide: 0 })} className={cn(field, "max-w-[220px]")}>
            <option value="">Choose a deck</option>
            {decks.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </select>
          {deck?.kind === "link" ? (
            deck.embed && <span className={cn("text-sm", dark ? "text-white/60" : "text-ink-3")}>Use the arrows on the slides</span>
          ) : (
            <>
              <button className={btn} disabled={!deck?.count || deck.slide <= 0} onClick={() => deck && patch({ slide: deck.slide - 1 })} aria-label="Previous slide">
                <ChevronLeft className="size-4" />
              </button>
              <span className={cn("num font-mono text-sm", dark ? "text-white/70" : "text-ink-3")}>{deck ? `${deck.slide + 1} / ${deck.count ?? "–"}` : "–"}</span>
              <button className={btn} disabled={!deck?.count || deck.slide >= deck.count - 1} onClick={() => deck && patch({ slide: deck.slide + 1 })} aria-label="Next slide">
                <ChevronRight className="size-4" />
              </button>
            </>
          )}
        </>
      )}

      {s.view === "blank" && (
        <input
          defaultValue={s.message}
          key={s.message}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          onBlur={(e) => e.target.value !== s.message && patch({ message: e.target.value })}
          placeholder="Message on screen"
          className={cn(field, "w-72")}
        />
      )}
    </div>
  );
}

function Toggle({ on, onClick, children, dark }: { on: boolean; onClick: () => void; children: React.ReactNode; dark: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm",
        dark ? (on ? "bg-white/25 text-white" : "bg-white/10 text-white/60 hover:text-white") : on ? "bg-ink text-panel" : "border border-line-2 text-ink-3 hover:text-ink",
      )}
    >
      <span className={cn("size-1.5 rounded-full", on ? "bg-[#2eb278]" : dark ? "bg-white/30" : "bg-ink-4")} />
      {children}
    </button>
  );
}
