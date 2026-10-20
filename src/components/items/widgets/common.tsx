"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Stage({ children, className, dark }: { children: ReactNode; className?: string; dark?: boolean }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border",
        dark ? "border-[#1f242b] bg-[#0b0e12] text-[#d7dde4]" : "border-line bg-panel",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AnswerField({
  label,
  value,
  onChange,
  disabled,
  placeholder,
  width = "w-48",
  mono = true,
  inputMode,
}: {
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  width?: string;
  mono?: boolean;
  inputMode?: "numeric" | "text" | "decimal";
}) {
  return (
    <label className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-medium text-ink-2">{label}</span>
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        className={cn("field", width, mono && "font-mono text-[15px]")}
        data-answer
      />
    </label>
  );
}

export function Legend({ items }: { items: { k: ReactNode; v: ReactNode }[] }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-3">
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {it.k}
          <span>{it.v}</span>
        </span>
      ))}
    </div>
  );
}

export function Chip({ children, active, onClick, className }: { children: ReactNode; active?: boolean; onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium",
        active ? "border-ink bg-ink text-panel" : "border-line-2 bg-panel text-ink hover:bg-panel-2",
        className,
      )}
    >
      {children}
    </button>
  );
}
