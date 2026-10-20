"use client";

import { useRef, useState } from "react";
import { LockKeyhole, LockKeyholeOpen } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ItemProps } from "../types";
import { Stage } from "./common";
import { Button } from "@/components/ui/button";
import type { LockGuess } from "@/lib/items/widgets/lock";

type LockState = { guesses: LockGuess[]; solved: boolean };

export function Lock({ item, interact, state, disabled }: ItemProps<{ digits: number; maxGuesses: number }, unknown, LockState>) {
  const { digits, maxGuesses } = item.data;
  const [local, setLocal] = useState<LockState>(state ?? { guesses: [], solved: false });
  const [cells, setCells] = useState<string[]>(Array(digits).fill(""));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const left = maxGuesses - local.guesses.length;
  const over = local.solved || left <= 0;
  const submit = async () => {
    const guess = cells.join("");
    if (guess.length !== digits) return setErr(`Enter ${digits} digits`);
    if (new Set(guess).size !== digits) return setErr("Digits can't repeat");
    setBusy(true);
    setErr(null);
    try {
      const reply = await interact({ guess });
      if (reply?.error) setErr(reply.error);
      if (reply?.guesses) setLocal({ guesses: reply.guesses, solved: reply.solved });
      setCells(Array(digits).fill(""));
      refs.current[0]?.focus();
    } catch {
      setErr("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Stage>
      <div className="flex flex-wrap gap-8 px-6 py-6">
        <div className="flex flex-col items-center gap-4">
          <div className={cn("flex size-14 items-center justify-center rounded-2xl", local.solved ? "bg-accent-soft text-accent" : "bg-panel-3 text-ink-2")}>
            {local.solved ? <LockKeyholeOpen className="size-7" /> : <LockKeyhole className="size-7" />}
          </div>
          <div className="flex gap-2">
            {cells.map((c, i) => (
              <input
                key={i}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                value={c}
                disabled={disabled || over || busy}
                inputMode="numeric"
                maxLength={1}
                onChange={(e) => {
                  const d = e.target.value.replace(/\D/g, "").slice(-1);
                  const n = [...cells];
                  n[i] = d;
                  setCells(n);
                  if (d && i < digits - 1) refs.current[i + 1]?.focus();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !cells[i] && i > 0) refs.current[i - 1]?.focus();
                  if (e.key === "Enter") submit();
                }}
                className="h-14 w-11 rounded-lg border-2 border-line-2 bg-panel text-center font-mono text-2xl font-semibold outline-none focus:border-ink disabled:opacity-50"
                aria-label={`Digit ${i + 1}`}
              />
            ))}
          </div>
          <Button variant="primary" onClick={submit} disabled={disabled || over || busy || cells.some((c) => !c)} className="w-full">
            {local.solved ? "Unlocked" : left <= 0 ? "No tries left" : "Try code"}
          </Button>
          {err && <div className="text-sm text-red">{err}</div>}
          <div className="text-xs text-ink-3">{local.solved ? `Opened in ${local.guesses.length}` : `${left} of ${maxGuesses} tries left`}</div>
        </div>
        <div className="min-w-[220px] flex-1">
          <div className="mb-2 flex items-center gap-4 text-xs text-ink-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-ink" /> right digit, right place
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full border-[1.5px] border-ink" /> right digit, wrong place
            </span>
          </div>
          <div className="space-y-1.5">
            {local.guesses.map((g, i) => (
              <div key={i} className="flex items-center gap-4 rounded-lg border border-line bg-panel-2 px-3 py-1.5">
                <span className="w-4 font-mono text-xs text-ink-4">{i + 1}</span>
                <span className="flex gap-1">
                  {g.guess.split("").map((d, j) => (
                    <span key={j} className="flex h-7 w-6 items-center justify-center rounded border border-line bg-panel font-mono font-semibold">
                      {d}
                    </span>
                  ))}
                </span>
                <span className="flex gap-1">
                  {Array.from({ length: g.exact }).map((_, j) => (
                    <span key={`e${j}`} className="size-3 rounded-full bg-ink" />
                  ))}
                  {Array.from({ length: g.near }).map((_, j) => (
                    <span key={`n${j}`} className="size-3 rounded-full border-[1.5px] border-ink" />
                  ))}
                  {g.exact + g.near === 0 && <span className="text-xs text-ink-4">none</span>}
                </span>
              </div>
            ))}
            {local.guesses.length === 0 && <div className="py-6 text-center text-sm text-ink-4">No tries yet.</div>}
          </div>
        </div>
      </div>
    </Stage>
  );
}
