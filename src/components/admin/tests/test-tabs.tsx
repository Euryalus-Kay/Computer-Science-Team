"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export function TestTabs({ id }: { id: string }) {
  const path = usePathname();
  const base = `/admin/tests/${id}`;
  const tabs = [
    { href: base, label: "Monitor", active: path === base },
    { href: `${base}/results`, label: "Results", active: path.startsWith(`${base}/results`) || path.startsWith(`${base}/attempts`) },
    { href: `${base}/edit`, label: "Edit", active: path.startsWith(`${base}/edit`) },
  ];
  return (
    <div className="-mb-px flex gap-5 border-b border-line">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "border-b-2 pb-2.5 text-sm transition-colors",
            t.active ? "border-ink font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
