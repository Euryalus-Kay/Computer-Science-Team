"use client";

import { cn } from "@/lib/cn";

export function Switch({
  checked,
  onChange,
  disabled,
  name,
  label,
}: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  name?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        "relative inline-flex h-[18px] w-[30px] shrink-0 items-center rounded-full transition-colors duration-150 disabled:opacity-50",
        checked ? "bg-accent" : "bg-line-2",
      )}
    >
      {name && <input type="hidden" name={name} value={checked ? "on" : ""} />}
      <span
        className={cn(
          "inline-block size-[14px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.25)] transition-transform duration-150",
          checked ? "translate-x-[14px]" : "translate-x-[2px]",
        )}
      />
    </button>
  );
}
