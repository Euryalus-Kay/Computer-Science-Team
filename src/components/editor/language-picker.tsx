"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import { LANGUAGES } from "@/lib/runner/languages";
import { cn } from "@/lib/cn";

export function LanguagePicker({
  value,
  onChange,
  allowed,
  size = "md",
}: {
  value: string;
  onChange: (id: string) => void;
  allowed?: string[];
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const list = useMemo(() => {
    const base = allowed?.length ? LANGUAGES.filter((l) => allowed.includes(l.id)) : LANGUAGES;
    const s = q.trim().toLowerCase();
    return s ? base.filter((l) => l.label.toLowerCase().includes(s) || l.id.includes(s)) : base;
  }, [allowed, q]);
  const current = LANGUAGES.find((l) => l.id === value);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  useEffect(() => setCursor(0), [q]);
  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setQ("");
  };
  const core = list.filter((l) => l.core);
  const more = list.filter((l) => !l.core);
  let idx = -1;
  const row = (l: (typeof LANGUAGES)[number]) => {
    idx++;
    const i = idx;
    return (
      <button
        key={l.id}
        type="button"
        onMouseEnter={() => setCursor(i)}
        onClick={() => pick(l.id)}
        className={cn(
          "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm",
          cursor === i ? "bg-panel-3" : "",
        )}
      >
        <span className="w-4">{l.id === value && <Check className="size-3.5 text-accent" />}</span>
        <span className="flex-1 truncate">{l.label}</span>
        <span className="text-xs text-ink-4">{l.version}</span>
      </button>
    );
  };
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2 rounded-md border border-line-2 bg-panel pr-2 pl-2.5 text-sm shadow-card hover:bg-panel-2",
          size === "sm" ? "h-7" : "h-8",
        )}
      >
        <span className="font-medium">{current?.label ?? value}</span>
        <span className="text-xs text-ink-3">{current?.version}</span>
        <ChevronDown className="size-3.5 text-ink-3" />
      </button>
      {open && (
        <div className="animate-in absolute top-full left-0 z-50 mt-1 w-[260px] rounded-lg bg-panel p-1 shadow-pop">
          <div className="relative mb-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-4" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setCursor((c) => Math.min(list.length - 1, c + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setCursor((c) => Math.max(0, c - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const ordered = [...core, ...more];
                  if (ordered[cursor]) pick(ordered[cursor].id);
                } else if (e.key === "Escape") setOpen(false);
              }}
              placeholder="Search languages"
              className="h-8 w-full rounded-md bg-panel-2 pr-2 pl-8 text-sm outline-none placeholder:text-ink-4"
            />
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {core.map(row)}
            {core.length > 0 && more.length > 0 && <div className="mx-2 my-1 h-px bg-line" />}
            {more.map(row)}
            {list.length === 0 && <div className="px-2 py-3 text-sm text-ink-3">No match</div>}
          </div>
        </div>
      )}
    </div>
  );
}
