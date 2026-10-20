"use client";

import { Server, Check, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ItemProps } from "../types";
import { Inline } from "../inline";
import { Stage, AnswerField } from "./common";

/* --------------------------------------------------------------- liars */

export function Liars({ item, value, onChange, disabled }: ItemProps<{ names: string[]; claims: string[] }, { choice: number }>) {
  const { names, claims } = item.data;
  return (
    <div className="space-y-3">
      <div className="grid gap-2.5 sm:grid-cols-2">
        {names.map((n, i) => {
          const on = value?.choice === i;
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ choice: i })}
              className={cn(
                "group rounded-xl border bg-panel p-3.5 text-left transition-colors",
                on ? "border-red shadow-[0_0_0_1px_var(--red)]" : "border-line hover:border-line-2",
              )}
            >
              <div className="mb-2.5 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className={cn("flex size-7 items-center justify-center rounded-md", on ? "bg-red-soft text-red" : "bg-panel-3 text-ink-3")}>
                    <Server className="size-4" />
                  </span>
                  <span className="font-mono text-[14px] font-semibold">{n}</span>
                </span>
                <span className={cn("text-xs font-medium", on ? "text-red" : "text-ink-4 opacity-0 group-hover:opacity-100")}>
                  {on ? "Compromised" : "Mark compromised"}
                </span>
              </div>
              <div className="relative rounded-lg bg-panel-2 px-3 py-2 text-[14px] leading-snug text-ink">
                <span className="absolute -top-1 left-3 size-2 rotate-45 bg-panel-2" />
                <Inline text={claims[i]} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- logic grid */

type GridPub = { people: string[]; langs: string[]; lockers: number[]; clues: string[] };
type GridValue = { lang: number[]; locker: number[]; marks?: Record<string, "x"> };

export function LogicGrid({ item, value, onChange, disabled }: ItemProps<GridPub, GridValue>) {
  const { people, langs, lockers, clues } = item.data;
  const v: GridValue = {
    lang: value?.lang ?? [-1, -1, -1, -1],
    locker: value?.locker ?? [-1, -1, -1, -1],
    marks: value?.marks ?? {},
  };
  const cycle = (kind: "lang" | "locker", p: number, j: number) => {
    if (disabled) return;
    const key = `${kind}:${p}:${j}`;
    const marks = { ...v.marks };
    const current = v[kind][p] === j ? "check" : marks[key] ? "x" : "blank";
    const next = { ...v, [kind]: [...v[kind]], marks };
    if (current === "blank") marks[key] = "x";
    else if (current === "x") {
      delete marks[key];
      // check: clear this column and row elsewhere
      next[kind] = next[kind].map((x, i) => (i !== p && x === j ? -1 : x));
      next[kind][p] = j;
    } else {
      next[kind][p] = -1;
    }
    onChange(next);
  };
  const cell = (kind: "lang" | "locker", p: number, j: number) => {
    const isCheck = v[kind][p] === j;
    const isX = !isCheck && v.marks?.[`${kind}:${p}:${j}`];
    const implied = !isCheck && !isX && (v[kind][p] !== -1 || v[kind].includes(j));
    return (
      <td key={`${kind}${j}`} className="border border-line p-0">
        <button
          type="button"
          onClick={() => cycle(kind, p, j)}
          className={cn(
            "flex h-10 w-full min-w-10 items-center justify-center hover:bg-panel-3",
            isCheck && "bg-accent-soft text-accent",
            implied && "text-ink-4",
          )}
          aria-label={`${people[p]} ${kind === "lang" ? langs[j] : lockers[j]}`}
        >
          {isCheck ? <Check className="size-4" strokeWidth={2.5} /> : isX || implied ? <X className="size-3.5" /> : null}
        </button>
      </td>
    );
  };
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div>
        <div className="mb-2 text-xs font-medium text-ink-3">Clues</div>
        <ol className="space-y-2">
          {clues.map((c, i) => (
            <li key={i} className="flex gap-2.5 text-[14px] leading-snug">
              <span className="w-4 shrink-0 font-mono text-xs leading-5 text-ink-4">{i + 1}</span>
              <span>{c}</span>
            </li>
          ))}
        </ol>
      </div>
      <Stage className="overflow-x-auto">
        <table className="w-full border-collapse text-center text-xs">
          <thead>
            <tr>
              <th className="border-b border-line" />
              <th colSpan={4} className="border-b border-l border-line py-1.5 font-medium text-ink-3">
                Language
              </th>
              <th colSpan={4} className="border-b border-l border-line py-1.5 font-medium text-ink-3">
                Locker
              </th>
            </tr>
            <tr>
              <th className="border-b border-line" />
              {langs.map((l) => (
                <th key={l} className="border-b border-l border-line px-1 py-1.5 font-mono text-[11px] font-medium text-ink-2">
                  {l}
                </th>
              ))}
              {lockers.map((k) => (
                <th key={k} className="border-b border-l border-line px-1 py-1.5 font-mono text-[11px] font-medium text-ink-2">
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((p, i) => (
              <tr key={p}>
                <th className="border-r border-line px-3 text-left text-[13px] font-medium">{p}</th>
                {langs.map((_, j) => cell("lang", i, j))}
                {lockers.map((_, j) => cell("locker", i, j))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-line px-3 py-2 text-xs text-ink-3">Click once to rule out, again to pick, again to clear.</div>
      </Stage>
    </div>
  );
}

/* --------------------------------------------------------------- stride */

export function Stride({ item, value, onChange, disabled }: ItemProps<{ examples: { args: number[]; out: number[] }[]; ask: number[] }, { text: string }>) {
  const { examples, ask } = item.data;
  const call = (a: number[]) => `stride(${a.join(", ")})`;
  return (
    <div className="space-y-4">
      <Stage>
        <div className="overflow-x-auto px-5 py-4 font-mono text-[14px] leading-8">
          {examples.map((e, i) => (
            <div key={i} className="flex gap-6 whitespace-nowrap">
              <span className="w-44 text-ink">{call(e.args)}</span>
              <span className="text-ink-4">→</span>
              <span className="text-accent-ink">{e.out.join(" ")}</span>
            </div>
          ))}
          <div className="mt-1 flex gap-6 border-t border-dashed border-line pt-1 whitespace-nowrap">
            <span className="w-44 font-semibold text-ink">{call(ask)}</span>
            <span className="text-ink-4">→</span>
            <span className="text-ink-4">?</span>
          </div>
        </div>
      </Stage>
      <AnswerField label="Output" value={value?.text ?? ""} onChange={(t) => onChange({ text: t })} disabled={disabled} width="w-72" placeholder="numbers separated by spaces" />
    </div>
  );
}

/* --------------------------------------------------------------- cipher */

const AB = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function Cipher({ item, value, onChange, disabled }: ItemProps<{ examples: { plain: string; code: string }[]; code: string }, { text: string }>) {
  const { examples, code } = item.data;
  const Word = ({ w, tone }: { w: string; tone?: string }) => (
    <span className="inline-flex gap-1">
      {w.split("").map((ch, i) => (
        <span key={i} className={cn("flex h-8 w-7 items-center justify-center rounded-md border border-line bg-panel font-mono text-[15px] font-semibold", tone)}>
          {ch}
        </span>
      ))}
    </span>
  );
  return (
    <div className="space-y-4">
      <Stage>
        <div className="space-y-2.5 px-5 py-4">
          {examples.map((e) => (
            <div key={e.plain} className="flex flex-wrap items-center gap-4">
              <Word w={e.plain} />
              <span className="text-ink-4">→</span>
              <Word w={e.code} tone="text-accent-ink" />
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-4 border-t border-dashed border-line pt-3">
            <span className="inline-flex gap-1">
              {code.split("").map((_, i) => (
                <span key={i} className="flex h-8 w-7 items-center justify-center rounded-md border border-dashed border-line-2 font-mono text-ink-4">
                  ?
                </span>
              ))}
            </span>
            <span className="text-ink-4">→</span>
            <Word w={code} tone="text-accent-ink" />
          </div>
        </div>
        <div className="border-t border-line bg-panel-2 px-4 py-2.5">
          <div className="flex flex-wrap gap-[3px] font-mono text-[11px]">
            {AB.split("").map((ch, i) => (
              <span key={ch} className="flex w-[22px] flex-col items-center rounded border border-line bg-panel py-0.5">
                <span className="font-semibold text-ink">{ch}</span>
                <span className="text-[9px] text-ink-4">{i + 1}</span>
              </span>
            ))}
          </div>
        </div>
      </Stage>
      <AnswerField label="Original word" value={value?.text ?? ""} onChange={(t) => onChange({ text: t.toUpperCase() })} disabled={disabled} width="w-56" />
    </div>
  );
}
