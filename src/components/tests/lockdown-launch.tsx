"use client";

import { useEffect, useState } from "react";
import { MonitorSmartphone, Download, Copy, Check, LoaderCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export type Platform = "mac" | "windows" | "other";

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const p = ((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || navigator.userAgent).toLowerCase();
  if (p.includes("mac")) return "mac";
  if (p.includes("win")) return "windows";
  return "other";
}

export function InstallCommand({ platform }: { platform: Platform }) {
  const toast = useToast();
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);
  if (platform === "other") return null;
  const cmd = platform === "mac" ? `curl -fsSL ${origin}/desktop/install.sh | bash` : `irm ${origin}/desktop/install.ps1 | iex`;
  return (
    <div>
      <div className="mb-1 text-xs text-ink-3">{platform === "mac" ? "Or paste this in Terminal (installs with no security prompts):" : "Or paste this in PowerShell (no admin rights needed):"}</div>
      <div className="flex items-center gap-2 rounded-md border border-line bg-panel-2 py-1.5 pr-1.5 pl-3">
        <code className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{cmd}</code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(cmd);
            setCopied(true);
            toast("Copied");
          }}
          className="rounded p-1 text-ink-3 hover:bg-panel-3 hover:text-ink"
          aria-label="Copy command"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}

export function DownloadPanel({ platform }: { platform: Platform }) {
  if (platform === "other") {
    return (
      <div className="text-sm text-ink-2">
        The Lab CS app runs on Mac and Windows. Use a school Mac or Windows computer, or ask your coach.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <a href={`/api/desktop/download/${platform}`} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-ink px-3 text-sm font-medium text-panel hover:bg-ink/85">
          <Download className="size-4" /> Download for {platform === "mac" ? "Mac" : "Windows"}
        </a>
        <a href="/app" className="text-sm text-ink-3 hover:text-ink">
          Install help
        </a>
      </div>
      <InstallCommand platform={platform} />
    </div>
  );
}

/** Hands the test off to the desktop app with a one-time sign-in link. */
export function OpenInApp({ target, label = "Open in Lab CS app" }: { target: string; label?: string }) {
  const toast = useToast();
  const [phase, setPhase] = useState<"idle" | "opening" | "opened" | "missing">("idle");
  const [platform, setPlatform] = useState<Platform>("other");
  useEffect(() => setPlatform(detectPlatform()), []);
  const open = async () => {
    setPhase("opening");
    let url: string;
    try {
      const res = await fetch("/api/desktop/launch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      url = j.url;
    } catch (e) {
      toast((e as Error).message || "Couldn't create a launch link", "error");
      setPhase("idle");
      return;
    }
    let left = false;
    const onBlur = () => (left = true);
    const onHide = () => document.hidden && (left = true);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onHide);
    window.location.href = url;
    setTimeout(() => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onHide);
      setPhase(left ? "opened" : "missing");
    }, 2200);
  };
  return (
    <div className="w-full space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" size="lg" onClick={open} disabled={phase === "opening"} icon={phase === "opening" ? <LoaderCircle className="size-4 animate-spin" /> : <MonitorSmartphone className="size-4" />}>
          {phase === "opened" ? "Open again" : label}
        </Button>
        {phase === "opened" && <span className="text-sm text-ink-2">Opened in the app. You can close this tab.</span>}
        {phase === "idle" && (
          <button onClick={() => setPhase("missing")} className="text-sm text-ink-3 hover:text-ink">
            Don&apos;t have the app?
          </button>
        )}
      </div>
      {phase === "missing" && (
        <div className="animate-in rounded-lg border border-line bg-panel-2 p-4">
          <div className="mb-3 text-sm font-medium">Install the Lab CS app, then press Open again.</div>
          <DownloadPanel platform={platform} />
        </div>
      )}
    </div>
  );
}

export function OpenInSeb({ testId, secondary }: { testId: string; secondary?: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/seb/launch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ testId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      window.location.href = j.url;
    } catch (e) {
      toast((e as Error).message || "Couldn't open Safe Exam Browser", "error");
    } finally {
      setTimeout(() => setBusy(false), 1500);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant={secondary ? "secondary" : "primary"} size="lg" onClick={open} disabled={busy}>
        Open in Safe Exam Browser
      </Button>
      <a href="https://safeexambrowser.org/download_en.html" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink">
        Get Safe Exam Browser <ExternalLink className="size-3" />
      </a>
    </div>
  );
}
