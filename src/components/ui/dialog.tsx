"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  width = 480,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto max-h-[85dvh] w-[calc(100%-32px)] overflow-visible rounded-xl border-0 bg-transparent p-0 text-ink backdrop:bg-[rgba(10,12,15,0.42)] backdrop:backdrop-blur-[1px]",
        className,
      )}
      style={{ maxWidth: width }}
    >
      {open && (
        <div className="animate-in flex max-h-[85dvh] flex-col rounded-xl bg-panel shadow-pop">
          {title && (
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
              <div className="text-md font-semibold">{title}</div>
              <button onClick={onClose} className="rounded p-1 text-ink-3 hover:bg-panel-3 hover:text-ink" aria-label="Close">
                <X className="size-4" />
              </button>
            </div>
          )}
          <div className="min-h-0 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
