"use client";

import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/** A markdown slide. Text and code shrink to fit when a slide has more than the screen holds. */
export function SlideBody({ html, className }: { html: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      let f = 1;
      el.style.setProperty("--fit", "1");
      for (let i = 0; i < 5; i++) {
        const over = el.scrollHeight / Math.max(1, el.clientHeight);
        if (over <= 1.005) break;
        f = Math.max(0.4, f / over - 0.01);
        el.style.setProperty("--fit", String(f));
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    document.fonts?.ready.then(fit).catch(() => {});
    return () => ro.disconnect();
  }, [html]);
  return <div ref={ref} className={cn("board-slide prose", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
