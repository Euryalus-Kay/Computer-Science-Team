"use client";

import { MonitorSmartphone, ShieldCheck } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export function clock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

const LEVEL: Record<string, { label: string; tone: Tone }> = {
  clear: { label: "Clear", tone: "neutral" },
  low: { label: "Low", tone: "outline" },
  medium: { label: "Review", tone: "amber" },
  high: { label: "High", tone: "red" },
};

export function LevelPill({ level, flags }: { level: string; flags?: { severity: string; message: string }[] }) {
  const l = LEVEL[level] ?? LEVEL.clear;
  return (
    <span title={flags?.map((f) => f.message).join("\n") || undefined}>
      <Badge tone={l.tone}>{l.label}</Badge>
    </span>
  );
}

export function ClientIcon({ kind }: { kind: string }) {
  if (kind === "desktop") return <MonitorSmartphone className="size-3.5 text-ink-3" aria-label="Lab CS app" />;
  if (kind === "seb") return <ShieldCheck className="size-3.5 text-ink-3" aria-label="Safe Exam Browser" />;
  return null;
}

export function Progress({ value, max, className, tone = "ink" }: { value: number; max: number; className?: string; tone?: "ink" | "accent" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-panel-3", className)}>
      <div className={cn("h-full rounded-full transition-[width] duration-500", tone === "accent" ? "bg-accent" : "bg-ink-3")} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Dot({ tone }: { tone: "green" | "amber" | "gray" | "blue" }) {
  return (
    <span
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        tone === "green" && "bg-accent",
        tone === "amber" && "bg-amber",
        tone === "gray" && "bg-ink-4",
        tone === "blue" && "bg-blue",
      )}
    />
  );
}
