import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "xs" | "sm" | "md" | "lg";

const base =
  "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-[background-color,border-color,color,box-shadow] duration-100 disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-panel hover:bg-ink/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
  accent: "bg-accent text-white hover:bg-accent-hover shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]",
  secondary: "border border-line-2 bg-panel text-ink hover:bg-panel-2 shadow-card",
  ghost: "text-ink-2 hover:bg-panel-3 hover:text-ink",
  danger: "border border-line-2 bg-panel text-red hover:bg-red-soft hover:border-red/40",
};

const sizes: Record<Size, string> = {
  xs: "h-6 px-2 text-xs",
  sm: "h-7 px-2.5 text-sm",
  md: "h-8 px-3 text-sm",
  lg: "h-10 px-4 text-base",
};

export function buttonClass(variant: Variant = "secondary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ComponentProps<"button"> & { variant?: Variant; size?: Size; icon?: ReactNode };

export function Button({ variant = "secondary", size = "md", className, icon, children, type, ...rest }: ButtonProps) {
  return (
    <button type={type ?? "button"} className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

type LinkButtonProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size; icon?: ReactNode };

export function LinkButton({ variant = "secondary", size = "md", className, icon, children, ...rest }: LinkButtonProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
