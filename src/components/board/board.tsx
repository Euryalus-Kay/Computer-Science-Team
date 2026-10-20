"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Maximize2, Minimize2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useNow } from "@/lib/use-now";
import type { BoardPatch } from "@/lib/board";
import { BoardScreen, type BoardPayload } from "./screen";
import { BoardControls, type Option } from "./controls";

/** Polls the board state and applies changes, shared by the projector and the remote. */
export function useBoard(initial: BoardPayload, everyMs = 1500) {
  const [data, setData] = useState(initial);
  const [offset, setOffset] = useState(0);
  const busy = useRef(false);
  const apply = (j: BoardPayload) => {
    setData(j);
    setOffset(j.serverNow - Date.now());
  };
  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const r = await fetch("/api/board/state", { cache: "no-store" });
      if (r.ok) apply(await r.json());
    } catch {
    } finally {
      busy.current = false;
    }
  }, []);
  const patch = useCallback(async (p: BoardPatch) => {
    const r = await fetch("/api/board/state", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(p) });
    if (r.ok) apply(await r.json());
  }, []);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, everyMs);
    return () => clearInterval(t);
  }, [refresh, everyMs]);
  return { data, offset, refresh, patch };
}

function chime() {
  try {
    const ctx = new AudioContext();
    [0, 0.28, 0.56].forEach((at, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = i === 2 ? 880 : 660;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + at);
      o.stop(ctx.currentTime + at + 0.3);
    });
  } catch {}
}

export function BoardApp({ initial, tests, decks }: { initial: BoardPayload; tests: Option[]; decks: Option[] }) {
  const { data, offset, refresh, patch } = useBoard(initial);
  const tick = useNow(250);
  const now = tick === null ? null : tick + offset;
  const [dock, setDock] = useState(true);
  const [full, setFull] = useState(false);
  const [origin, setOrigin] = useState("");
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overDock = useRef(false);

  useEffect(() => setOrigin(window.location.origin), []);

  const poke = useCallback(() => {
    setDock(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => !overDock.current && setDock(false), 2800);
  }, []);
  useEffect(() => {
    poke();
    window.addEventListener("mousemove", poke);
    return () => window.removeEventListener("mousemove", poke);
  }, [poke]);

  useEffect(() => {
    const onFs = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  const toggleFull = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});

  // Keyboard: F full screen, space starts or pauses the timer, arrows move slides, 1-5 switch views.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input,select,textarea")) return;
      const s = data.state;
      if (e.key === "f") toggleFull();
      else if (e.key === " " && s.view === "timer") {
        e.preventDefault();
        patch({ timer: { action: s.timer.endsAt ? "pause" : "start" } });
      } else if ((e.key === "ArrowRight" || e.key === "PageDown") && s.view === "slides" && data.deck && s.slide < data.deck.count - 1) patch({ slide: s.slide + 1 });
      else if ((e.key === "ArrowLeft" || e.key === "PageUp") && s.view === "slides" && s.slide > 0) patch({ slide: s.slide - 1 });
      else if (/^[1-5]$/.test(e.key)) patch({ view: (["test", "timer", "join", "slides", "blank"] as const)[Number(e.key) - 1] });
      else return;
      poke();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data, patch, poke]);

  // A short chime when the timer reaches zero.
  const rang = useRef<string | null>(null);
  useEffect(() => {
    const t = data.state.timer;
    if (data.state.view !== "timer" || !t.endsAt || now === null) return;
    if (now >= Date.parse(t.endsAt) && rang.current !== t.endsAt) {
      rang.current = t.endsAt;
      chime();
    }
  }, [now, data.state]);

  return (
    <div className={cn("fixed inset-0 bg-[#0b0d10]", !dock && "cursor-none")}>
      <BoardScreen data={data} now={now} origin={origin} />
      <div
        onMouseEnter={() => (overDock.current = true)}
        onMouseLeave={() => (overDock.current = false)}
        className={cn(
          "absolute inset-x-0 bottom-0 flex justify-center p-4 transition-all duration-300",
          dock ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
        )}
      >
        <div className="flex max-w-full flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-[#16191e]/95 p-2 shadow-2xl backdrop-blur">
          <BoardControls data={data} tests={tests} decks={decks} patch={patch} refresh={refresh} tone="dark" />
          <div className="mx-1 h-6 w-px bg-white/10" />
          <button onClick={toggleFull} className="inline-flex size-8 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white" aria-label="Full screen" title="Full screen (F)">
            {full ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
          <Link href="/admin" className="inline-flex size-8 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white" aria-label="Close board">
            <X className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
