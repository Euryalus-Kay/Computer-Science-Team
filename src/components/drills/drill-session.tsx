"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, X, ArrowRight, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { TOPIC_BY_ID, type Drill } from "@/lib/drills/generators";

function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/).map((part, i) =>
        part.startsWith("`") ? (
          <code key={i} className="rounded bg-panel-3 px-1 py-px font-mono text-[0.92em]">
            {part.slice(1, -1)}
          </code>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

export function DrillSession({ topic, title, best: initialBest }: { topic: string; title: string; best: number }) {
  const make = TOPIC_BY_ID.get(topic)!.make;
  const [q, setQ] = useState<Drill | null>(null);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<null | boolean>(null);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(initialBest);
  const [tally, setTally] = useState({ right: 0, total: 0 });
  const field = useRef<HTMLInputElement>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);

  const next = useCallback(() => {
    setQ(make(Math.random));
    setInput("");
    setResult(null);
    setTimeout(() => field.current?.focus(), 0);
  }, [make]);
  useEffect(() => next(), [next]);

  const submit = () => {
    if (!q || result !== null || !input.trim()) return;
    const ok = q.check(input);
    const s = ok ? streak + 1 : 0;
    setResult(ok);
    setStreak(s);
    if (s > best) setBest(s);
    setTally((t) => ({ right: t.right + (ok ? 1 : 0), total: t.total + 1 }));
    fetch("/api/drills", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ topic, correct: ok, streak: s }) }).catch(() => {});
    setTimeout(() => nextBtn.current?.focus(), 0);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <Link href="/drills" className="text-xs text-ink-3 hover:text-ink">
            Drills
          </Link>
          <h1 className="text-xl font-semibold tracking-[-0.01em]">{title}</h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className={cn("inline-flex items-center gap-1 font-medium", streak >= 3 ? "text-amber" : "text-ink-3")}>
            <Flame className="size-4" />
            <span className="num">{streak}</span>
          </span>
          <span className="num text-ink-3">
            {tally.right}/{tally.total}
          </span>
          <span className="text-ink-4">best {best}</span>
        </div>
      </div>

      <div className="card p-6">
        {q && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (result === null) submit();
              else next();
            }}
          >
            <div className="text-[15px]">
              <Rich text={q.prompt} />
            </div>
            {q.code && <pre className="mt-3 overflow-x-auto rounded-lg bg-[var(--code-bg)] px-4 py-3 font-mono text-[15px] leading-relaxed">{q.code}</pre>}
            <div className="mt-5 flex items-center gap-2">
              <input
                ref={field}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={result !== null}
                placeholder={q.hint}
                autoComplete="off"
                spellCheck={false}
                className={cn(
                  "field h-10 max-w-[260px] font-mono text-base",
                  result === true && "border-accent bg-accent-soft",
                  result === false && "border-red bg-red-soft",
                )}
              />
              {result === null ? (
                <Button type="submit" variant="primary" size="lg" disabled={!input.trim()}>
                  Check
                </Button>
              ) : (
                <Button ref={nextBtn} type="submit" variant="primary" size="lg" icon={<ArrowRight className="size-4" />}>
                  Next
                </Button>
              )}
            </div>
            {result !== null && (
              <div className={cn("animate-in mt-5 rounded-lg border px-4 py-3", result ? "border-accent/30 bg-accent-soft/50" : "border-red/25 bg-red-soft/50")}>
                <div className={cn("flex items-center gap-1.5 text-sm font-medium", result ? "text-accent-ink" : "text-red")}>
                  {result ? <Check className="size-4" /> : <X className="size-4" />}
                  {result ? "Right" : <>Answer: <span className="font-mono">{q.answer}</span></>}
                </div>
                <ul className="mt-2 space-y-0.5 font-mono text-[13px] text-ink-2">
                  {q.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </form>
        )}
      </div>
      <p className="mt-3 text-xs text-ink-4">Enter checks, Enter again for the next one.</p>
    </div>
  );
}
