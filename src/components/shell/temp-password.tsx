"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KeyRound } from "lucide-react";

/** Shown to members still using the password an admin made for them. */
export function TempPasswordBanner() {
  const path = usePathname();
  if (path === "/account") return null;
  return (
    <div className="flex items-center gap-2 border-b border-line bg-amber-soft px-4 py-2 text-sm text-amber sm:px-8">
      <KeyRound className="size-4 shrink-0" />
      <span>
        You&apos;re using a temporary password.{" "}
        <Link href="/account" className="font-medium underline underline-offset-2">
          Pick your own
        </Link>
      </span>
    </div>
  );
}
