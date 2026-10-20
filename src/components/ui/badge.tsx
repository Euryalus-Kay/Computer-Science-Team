import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tone = "neutral" | "green" | "blue" | "red" | "amber" | "outline";

const tones: Record<Tone, string> = {
  neutral: "bg-panel-3 text-ink-2",
  green: "bg-accent-soft text-accent-ink",
  blue: "bg-blue-soft text-blue",
  red: "bg-red-soft text-red",
  amber: "bg-amber-soft text-amber",
  outline: "border border-line-2 text-ink-2",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  dot,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-[5px] px-1.5 text-xs font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
