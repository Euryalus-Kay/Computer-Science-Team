"use client";

import { useEffect, useRef, useState } from "react";

import type { ReactNode } from "react";
import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Inline } from "../inline";

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

/** For drawings that can be wider than a phone: scrolls sideways and says so while part is hidden. */
export function WideScroll({ children, className }: { children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const check = () => setMore(el.scrollWidth - el.clientWidth - el.scrollLeft > 2);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    el.addEventListener("scroll", check, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", check);
    };
  }, []);
  return (
    <div className="relative">
      <div ref={box} className={cn("overflow-x-auto", className)}>
        {children}
      </div>
      {more && (
        <>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-panel to-transparent" />
          <div className="pointer-events-none absolute right-2 bottom-1.5 rounded bg-panel/90 px-1.5 py-0.5 text-[11px] text-ink-3 shadow-card">Swipe sideways to see all of it</div>
        </>
      )}
    </div>
  );
}

/**
 * One hint per question. The first click explains there is only one, the second asks for it.
 * `onGet` resolves once the hint is in, which the parent then passes back as `hint`.
 */
export function HintBox({ hint, onGet, disabled }: { hint: string | null; onGet: () => Promise<void>; disabled?: boolean }) {
  const [step, setStep] = useState<"idle" | "confirm" | "loading" | "failed">("idle");
  if (hint)
    return (
      <div className="flex gap-2.5 rounded-lg border border-amber/30 bg-amber-soft px-3.5 py-2.5 text-sm">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber" />
        <div>
          <span className="font-medium">Hint: </span>
          <Inline text={hint} />
          <div className="mt-1 text-xs text-ink-3">That was your one hint for this question.</div>
        </div>
      </div>
    );
  const ask = async () => {
    setStep("loading");
    try {
      await onGet();
      setStep("idle");
    } catch {
      setStep("failed");
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {step === "idle" ? (
        <Button size="sm" variant="ghost" icon={<Lightbulb className="size-3.5" />} onClick={() => setStep("confirm")} disabled={disabled}>
          Stuck? Get a hint
        </Button>
      ) : (
        <>
          <span className="text-ink-2">{step === "failed" ? "Couldn't get the hint. Try again." : "You get one hint for this question, based on what you've tried so far."}</span>
          <Button size="sm" variant="primary" onClick={ask} disabled={disabled || step === "loading"}>
            {step === "loading" ? "Getting it…" : "Show my hint"}
          </Button>
          {step !== "loading" && (
            <Button size="sm" variant="ghost" onClick={() => setStep("idle")}>
              Not yet
            </Button>
          )}
        </>
      )}
    </div>
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
