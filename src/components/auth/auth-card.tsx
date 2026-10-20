import type { ReactNode } from "react";
import { LogoMark } from "@/components/shell/logo";
import { TEAM_NAME } from "@/lib/brand";

export function AuthCard({ title, siteName, children }: { title: string; siteName: string; children: ReactNode }) {
  return (
    <div className="w-full max-w-[360px]">
      <div className="mb-7">
        <div className="flex items-center gap-2 text-ink">
          <LogoMark size={24} />
          <span className="text-md font-semibold tracking-[-0.01em]">{siteName}</span>
        </div>
        <div className="mt-1 pl-8 text-xs text-ink-3">{TEAM_NAME}</div>
      </div>
      <h1 className="mb-5 text-xl font-semibold tracking-[-0.01em]">{title}</h1>
      {children}
    </div>
  );
}
