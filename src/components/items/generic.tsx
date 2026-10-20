"use client";

import { useState } from "react";
import { ArrowUp, ArrowDown, GripVertical } from "lucide-react";
import { cn } from "@/lib/cn";
import { Inline } from "./inline";
import type { ItemProps } from "./types";

const LETTERS = "ABCDEFGHIJ";

export function Mcq({ item, value, onChange, disabled }: ItemProps<{ options: string[] }, { choice: number }>) {
  return (
    <div className="grid gap-2">
      {item.data.options.map((opt, i) => {
        const on = value?.choice === i;
        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onChange({ choice: i })}
            className={cn(
              "flex items-start gap-3 rounded-lg border px-3.5 py-2.5 text-left text-[14.5px] transition-colors",
              on ? "border-ink bg-panel shadow-[0_0_0_1px_var(--ink)]" : "border-line bg-panel hover:border-line-2 hover:bg-panel-2",
            )}
          >
            <span
              className={cn(
                "mt-px flex size-[22px] shrink-0 items-center justify-center rounded-md border font-mono text-xs",
                on ? "border-ink bg-ink text-panel" : "border-line-2 text-ink-3",
              )}
            >
              {LETTERS[i]}
            </span>
            <span className="pt-px">
              <Inline text={opt} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Multi({ item, value, onChange, disabled }: ItemProps<{ options: string[] }, { choices: number[] }>) {
  const picked = new Set(value?.choices ?? []);
  return (
    <div className="grid gap-2">
      <div className="text-xs text-ink-3">Select all that apply.</div>
      {item.data.options.map((opt, i) => {
        const on = picked.has(i);
        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => {
              const n = new Set(picked);
              if (on) n.delete(i);
              else n.add(i);
              onChange({ choices: [...n].sort((a, b) => a - b) });
            }}
            className={cn(
              "flex items-start gap-3 rounded-lg border px-3.5 py-2.5 text-left text-[14.5px]",
              on ? "border-ink shadow-[0_0_0_1px_var(--ink)]" : "border-line hover:border-line-2 hover:bg-panel-2",
              "bg-panel",
            )}
          >
            <span className={cn("mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded border", on ? "border-ink bg-ink text-panel" : "border-line-2")}>
              {on && (
                <svg viewBox="0 0 12 12" className="size-3">
                  <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                </svg>
              )}
            </span>
            <Inline text={opt} />
          </button>
        );
      })}
    </div>
  );
}

export function Short({ item, value, onChange, disabled }: ItemProps<{ placeholder?: string; mode?: string }, { text: string }>) {
  return (
    <input
      value={value?.text ?? ""}
      disabled={disabled}
      onChange={(e) => onChange({ text: e.target.value })}
      placeholder={item.data?.placeholder ?? "Your answer"}
      spellCheck={false}
      autoComplete="off"
      className="field max-w-md font-mono text-[15px]"
      data-answer
    />
  );
}

export function Numeric({ item, value, onChange, disabled }: ItemProps<{ unit?: string }, { value: string }>) {
  return (
    <div className="flex items-center gap-2">
      <input
        value={value?.value ?? ""}
        disabled={disabled}
        inputMode="decimal"
        onChange={(e) => onChange({ value: e.target.value })}
        placeholder="0"
        autoComplete="off"
        className="field num w-40 font-mono text-[15px]"
        data-answer
      />
      {item.data?.unit && <span className="text-sm text-ink-3">{item.data.unit}</span>}
    </div>
  );
}

export function TextAnswer({ item, value, onChange, disabled }: ItemProps<{ placeholder?: string; maxChars: number }, { text: string }>) {
  const text = value?.text ?? "";
  const max = item.data?.maxChars ?? 3000;
  return (
    <div className="max-w-2xl">
      <textarea
        value={text}
        disabled={disabled}
        maxLength={max}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder={item.data?.placeholder ?? "Write your answer"}
        rows={8}
        className="field resize-y text-[14.5px] leading-6"
        data-answer
      />
      <div className="mt-1 text-right text-xs text-ink-4">
        {text.length}/{max}
      </div>
    </div>
  );
}

export function Order({ item, value, onChange, disabled }: ItemProps<{ items: { id: string; text: string }[] }, { order: string[] }>) {
  const byId = new Map(item.data.items.map((x) => [x.id, x.text]));
  const order = value?.order?.length === item.data.items.length ? value.order : item.data.items.map((x) => x.id);
  const [drag, setDrag] = useState<number | null>(null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const n = [...order];
    const [x] = n.splice(from, 1);
    n.splice(to, 0, x);
    onChange({ order: n });
  };
  return (
    <div className="grid max-w-xl gap-1.5">
      {order.map((id, i) => (
        <div
          key={id}
          draggable={!disabled}
          onDragStart={() => setDrag(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (drag !== null) move(drag, i);
            setDrag(null);
          }}
          className={cn("flex items-center gap-2 rounded-lg border border-line bg-panel px-2 py-2", drag === i && "opacity-50")}
        >
          <GripVertical className="size-4 cursor-grab text-ink-4" />
          <span className="w-5 font-mono text-xs text-ink-3">{i + 1}</span>
          <span className="flex-1 text-[14.5px]">
            <Inline text={byId.get(id) ?? ""} />
          </span>
          <button type="button" disabled={disabled || i === 0} onClick={() => move(i, i - 1)} className="rounded p-1 text-ink-3 hover:bg-panel-3 disabled:opacity-30" aria-label="Move up">
            <ArrowUp className="size-3.5" />
          </button>
          <button type="button" disabled={disabled || i === order.length - 1} onClick={() => move(i, i + 1)} className="rounded p-1 text-ink-3 hover:bg-panel-3 disabled:opacity-30" aria-label="Move down">
            <ArrowDown className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function Match({ item, value, onChange, disabled }: ItemProps<{ left: string[]; right: { id: number; text: string }[] }, { pairs: Record<string, number> }>) {
  const pairs = value?.pairs ?? {};
  return (
    <div className="grid max-w-2xl gap-2">
      {item.data.left.map((l, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr] items-center gap-3 rounded-lg border border-line bg-panel px-3 py-2">
          <span className="text-[14.5px]">
            <Inline text={l} />
          </span>
          <select
            value={pairs[String(i)] ?? ""}
            disabled={disabled}
            onChange={(e) => onChange({ pairs: { ...pairs, [String(i)]: Number(e.target.value) } })}
            className="field field-sm"
          >
            <option value="" disabled>
              Choose
            </option>
            {item.data.right.map((r) => (
              <option key={r.id} value={r.id}>
                {r.text}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
