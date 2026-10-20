"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

/** A table row that opens `href` when clicked anywhere outside its own controls. */
export function RowLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const router = useRouter();
  return (
    <tr
      className={cn("row-link", className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a,button,input,select,label,textarea")) return;
        if (e.metaKey || e.ctrlKey) window.open(href, "_blank");
        else router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
