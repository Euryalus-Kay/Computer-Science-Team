"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Menu({
  trigger,
  children,
  align = "end",
  side = "bottom",
  className,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: "start" | "end";
  side?: "bottom" | "top";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const close = () => setOpen(false);
  return (
    <div className="relative" ref={ref}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          className={cn(
            "animate-in absolute z-50 min-w-[180px] rounded-lg bg-panel p-1 shadow-pop",
            align === "end" ? "right-0" : "left-0",
            side === "bottom" ? "top-full mt-1" : "bottom-full mb-1",
            className,
          )}
          role="menu"
        >
          {typeof children === "function" ? children(close) : children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  children,
  onClick,
  danger,
  icon,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm disabled:opacity-50",
        danger ? "text-red hover:bg-red-soft" : "text-ink hover:bg-panel-3",
      )}
    >
      {icon && <span className="text-ink-3 [&>svg]:size-4">{icon}</span>}
      {children}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-line" />;
}
