"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, MonitorPlay, ExternalLink, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { DeckView } from "@/lib/decks";

export function DeckViewer({ deck, isAdmin }: { deck: DeckView; isAdmin: boolean }) {
  const toast = useToast();
  const [i, setI] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const n = deck.slides.length;
  const go = useCallback((d: number) => setI((x) => Math.max(0, Math.min(n - 1, x + d))), [n]);

  useEffect(() => {
    if (deck.kind !== "markdown") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input,textarea,select")) return;
      if (["ArrowRight", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        go(1);
      } else if (["ArrowLeft", "PageUp"].includes(e.key)) go(-1);
      else if (e.key === "Home") setI(0);
      else if (e.key === "End") setI(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deck.kind, go, n]);

  const board = async () => {
    const r = await fetch("/api/board/state", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ view: "slides", deckId: deck.id, slide: i }),
    });
    toast(r.ok ? "Showing on the board" : "Couldn't update the board", r.ok ? "default" : "error");
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-[-0.01em]">{deck.title}</h1>
        <div className="flex items-center gap-2">
          {isAdmin && deck.kind === "markdown" && (
            <Button icon={<MonitorPlay className="size-4" />} onClick={board}>
              Show on board
            </Button>
          )}
          {deck.kind === "markdown" && (
            <Button variant="primary" icon={<Maximize2 className="size-4" />} onClick={() => stage.current?.requestFullscreen().catch(() => {})}>
              Present
            </Button>
          )}
          {deck.kind === "pdf" && deck.fileUrl && (
            <a href={deck.fileUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-2 bg-panel px-3 text-sm font-medium shadow-card hover:bg-panel-2">
              <Download className="size-4" /> Open PDF
            </a>
          )}
          {deck.kind === "link" && deck.url && (
            <a href={deck.url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-2 bg-panel px-3 text-sm font-medium shadow-card hover:bg-panel-2">
              <ExternalLink className="size-4" /> Open
            </a>
          )}
        </div>
      </div>

      {deck.kind === "markdown" ? (
        n === 0 ? (
          <div className="card px-6 py-12 text-center text-sm text-ink-3">This deck is empty.</div>
        ) : (
          <>
            <div
              ref={stage}
              data-theme="dark"
              onClick={(e) => {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                go(e.clientX - r.left > r.width / 3 ? 1 : -1);
              }}
              className="relative aspect-video w-full cursor-pointer overflow-hidden rounded-xl bg-[#0b0d10] text-[#eef0f3] shadow-card [container-type:size] select-none"
            >
              <div className="absolute inset-0 px-[6cqw] py-[6cqh]">
                <div key={i} className="board-slide prose animate-in h-full overflow-hidden" dangerouslySetInnerHTML={{ __html: deck.slides[i] }} />
              </div>
              <div className="num absolute right-[2.5cqw] bottom-[2cqh] font-mono text-[1.3cqw] text-white/35">
                {i + 1} / {n}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <Button icon={<ChevronLeft className="size-4" />} onClick={() => go(-1)} disabled={i === 0}>
                Back
              </Button>
              <div className="flex max-w-[60%] flex-wrap justify-center gap-1">
                {deck.slides.map((_, k) => (
                  <button
                    key={k}
                    onClick={() => setI(k)}
                    aria-label={`Slide ${k + 1}`}
                    className={`h-1.5 rounded-full transition-all ${k === i ? "w-5 bg-ink" : "w-1.5 bg-line-2 hover:bg-ink-4"}`}
                  />
                ))}
              </div>
              <Button onClick={() => go(1)} disabled={i === n - 1}>
                Next <ChevronRight className="size-4" />
              </Button>
            </div>
          </>
        )
      ) : deck.kind === "pdf" && deck.fileUrl ? (
        <iframe src={deck.fileUrl} title={deck.title} className="h-[78vh] w-full rounded-xl border border-line bg-panel" />
      ) : deck.embed ? (
        <iframe src={deck.embed} title={deck.title} allowFullScreen className="aspect-video w-full rounded-xl border border-line bg-panel" />
      ) : (
        <div className="card px-6 py-12 text-center">
          <a href={deck.url ?? "#"} target="_blank" rel="noreferrer" className="link text-sm">
            {deck.url}
          </a>
        </div>
      )}
    </div>
  );
}
