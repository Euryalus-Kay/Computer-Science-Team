"use client";

import { useEffect, useState } from "react";
import { Download, MonitorSmartphone, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { detectPlatform, InstallCommand, type Platform } from "./lockdown-launch";

export function AppSetup({ lastUsed }: { lastUsed: string | null }) {
  const [platform, setPlatform] = useState<Exclude<Platform, "other">>("mac");
  const [check, setCheck] = useState<"idle" | "opening" | "opened" | "missing">("idle");
  useEffect(() => {
    const p = detectPlatform();
    if (p !== "other") setPlatform(p);
  }, []);

  const tryOpen = () => {
    setCheck("opening");
    let left = false;
    const onBlur = () => (left = true);
    const onHide = () => document.hidden && (left = true);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onHide);
    window.location.href = `labcs://open?server=${encodeURIComponent(window.location.origin)}`;
    setTimeout(() => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onHide);
      setCheck(left ? "opened" : "missing");
    }, 2200);
  };

  const mac = platform === "mac";
  return (
    <div className="space-y-5">
      <p className="text-[15px] text-ink-2">Some tests open in the Lab CS app. It fills the screen and keeps other apps out of the way until you submit.</p>

      <div className="card">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <div className="text-sm font-medium">Install</div>
          <div className="flex rounded-md bg-panel-3 p-0.5 text-sm">
            {(["mac", "windows"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={cn("h-7 rounded-[5px] px-3 text-ink-3", platform === p && "bg-panel font-medium text-ink shadow-card")}
              >
                {p === "mac" ? "Mac" : "Windows"}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-5 px-5 py-5">
          <InstallCommand platform={platform} first />
          <div className="flex items-center gap-3 text-xs text-ink-4">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>
          <div>
            <a
              href={`/api/desktop/download/${platform}`}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-ink px-3.5 text-sm font-medium text-panel hover:bg-ink/85"
            >
              <Download className="size-4" /> Download for {mac ? "Mac" : "Windows"}
            </a>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-ink-2">
              {mac ? (
                <>
                  <li>Open the downloaded file and drag Lab CS into Applications.</li>
                  <li>Open Lab CS. macOS says it can&apos;t check the app, so close that message.</li>
                  <li>
                    Open <b>System Settings</b>, then <b>Privacy &amp; Security</b>, scroll down and choose <b>Open Anyway</b> next to Lab CS. On macOS 14 or
                    older, right-click Lab CS and choose <b>Open</b> instead.
                  </li>
                </>
              ) : (
                <>
                  <li>Run the downloaded installer. It installs for you only, no admin needed.</li>
                  <li>
                    If Windows says it protected your PC, choose <b>More info</b>, then <b>Run anyway</b>.
                  </li>
                </>
              )}
            </ol>
          </div>
        </div>
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div>
          <div className="text-sm font-medium">Check that it opens</div>
          <div className="text-sm text-ink-3">
            {check === "opened"
              ? "It opened. You're set."
              : check === "missing"
                ? "Nothing opened. Install it above, then try again."
                : lastUsed
                  ? `Last used ${relativeTime(lastUsed)}.`
                  : "Do this once before test day."}
          </div>
        </div>
        <Button
          onClick={tryOpen}
          disabled={check === "opening"}
          icon={check === "opened" ? <CircleCheck className="size-4 text-accent" /> : <MonitorSmartphone className="size-4" />}
        >
          Open the app
        </Button>
      </div>
    </div>
  );
}
