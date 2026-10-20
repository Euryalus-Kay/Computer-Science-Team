"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Two panes with a draggable divider. `direction` row = side by side, column = stacked. */
export function Split({
  first,
  second,
  initial = 0.5,
  min = 0.2,
  max = 0.8,
  direction = "row",
  storageKey,
  className,
}: {
  first: ReactNode;
  second: ReactNode;
  initial?: number;
  min?: number;
  max?: number;
  direction?: "row" | "column";
  storageKey?: string;
  className?: string;
}) {
  const [ratio, setRatio] = useState(initial);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  useEffect(() => {
    if (!storageKey) return;
    try {
      const v = Number(localStorage.getItem(`split:${storageKey}`));
      if (v >= min && v <= max) setRatio(v);
    } catch {}
  }, [storageKey, min, max]);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragging.current || !box.current) return;
      const r = box.current.getBoundingClientRect();
      const v = direction === "row" ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height;
      setRatio(Math.min(max, Math.max(min, v)));
    };
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setRatio((v) => {
        if (storageKey)
          try {
            localStorage.setItem(`split:${storageKey}`, String(v));
          } catch {}
        return v;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [direction, min, max, storageKey]);
  const row = direction === "row";
  return (
    <div ref={box} className={cn("flex min-h-0 min-w-0", row ? "flex-row" : "flex-col", className)}>
      <div className="min-h-0 min-w-0 overflow-hidden" style={{ flexBasis: `${ratio * 100}%`, flexGrow: 0, flexShrink: 0 }}>
        {first}
      </div>
      <div
        role="separator"
        aria-orientation={row ? "vertical" : "horizontal"}
        onPointerDown={(e) => {
          e.preventDefault();
          dragging.current = true;
          document.body.style.cursor = row ? "col-resize" : "row-resize";
          document.body.style.userSelect = "none";
        }}
        className={cn(
          "group relative z-10 shrink-0 bg-line",
          row ? "w-px cursor-col-resize" : "h-px cursor-row-resize",
        )}
      >
        <div
          className={cn(
            "absolute bg-transparent transition-colors group-hover:bg-blue/40",
            row ? "inset-y-0 -left-[2px] w-[5px]" : "inset-x-0 -top-[2px] h-[5px]",
          )}
        />
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{second}</div>
    </div>
  );
}
