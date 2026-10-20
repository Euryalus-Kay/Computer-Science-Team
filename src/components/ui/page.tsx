import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export function Page({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <div className={cn("mx-auto w-full px-4 pt-5 pb-16 sm:px-8 sm:pt-7", wide ? "max-w-[1400px]" : "max-w-[1120px]", className)}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  actions,
  crumbs,
  meta,
}: {
  title: ReactNode;
  actions?: ReactNode;
  crumbs?: { href: string; label: string }[];
  meta?: ReactNode;
}) {
  return (
    <div className="mb-6">
      {crumbs && crumbs.length > 0 && (
        <nav className="mb-2 flex items-center gap-1 text-xs text-ink-3">
          {crumbs.map((c, i) => (
            <span key={c.href} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3 text-ink-4" />}
              <Link href={c.href} className="hover:text-ink">
                {c.label}
              </Link>
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-[-0.01em]">{title}</h1>
          {meta && <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-3">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Section({
  title,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-8", className)}>
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-md font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Panel({ children, className, pad = true }: { children: ReactNode; className?: string; pad?: boolean }) {
  return <div className={cn("card", pad && "p-4", className)}>{children}</div>;
}

export function PanelHeader({ title, actions }: { title: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex h-11 items-center justify-between gap-3 border-b border-line px-4">
      <div className="text-sm font-medium">{title}</div>
      {actions}
    </div>
  );
}

export function Empty({
  title,
  children,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      {icon && <div className="mb-3 text-ink-4">{icon}</div>}
      <div className="text-sm font-medium">{title}</div>
      {children && <div className="mt-1 max-w-sm text-sm text-ink-3">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-xs text-ink-3">{label}</div>
      <div className="num mt-1 text-2xl font-semibold tracking-[-0.02em]">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-3">{sub}</div>}
    </div>
  );
}
