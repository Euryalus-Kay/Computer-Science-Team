"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, SquareTerminal, PackagePlus, CircleCheck, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { loadStarterContent, testClaude, testRunner, updateSettings } from "@/lib/admin/settings";

type S = {
  siteName: string;
  timezone: string;
  aiEnabled: boolean;
  aiModel: string;
  aiEffort: "low" | "medium" | "high";
  practiceLeaderboard: boolean;
  desktopMinVersion: string;
};

const ZONES = ["America/Chicago", "America/New_York", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu", "Europe/London", "UTC"];

function Card({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="card">
      <div className="border-b border-line px-5 py-3 text-sm font-semibold">{title}</div>
      <div className="space-y-4 px-5 py-4">{children}</div>
      {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-ink-3">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function Status({ state }: { state: { ok: boolean; text: string } | null }) {
  if (!state) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${state.ok ? "text-accent" : "text-red"}`}>
      {state.ok ? <CircleCheck className="size-4" /> : <CircleAlert className="size-4" />} {state.text}
    </span>
  );
}

export function SettingsForm({ initial, aiKey, desktopVersion, blob }: { initial: S; aiKey: boolean; desktopVersion: string; blob: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [s, setS] = useState(initial);
  const [pending, start] = useTransition();
  const [claude, setClaude] = useState<{ ok: boolean; text: string } | null>(null);
  const [runner, setRunner] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (p: Partial<S>) => setS((x) => ({ ...x, ...p }));
  const save = (patch: Partial<S>, done = "Saved") =>
    start(async () => {
      const r = await updateSettings(patch);
      toast(r.ok ? done : r.error, r.ok ? "default" : "error");
      if (r.ok) router.refresh();
    });

  return (
    <div className="space-y-5">
      <Card title="Site" footer={<Button variant="primary" disabled={pending} onClick={() => save({ siteName: s.siteName, timezone: s.timezone })}>Save</Button>}>
        <Row label="Name">
          <input value={s.siteName} onChange={(e) => set({ siteName: e.target.value })} className="field w-64" />
        </Row>
        <Row label="Time zone" hint="Used for test times and dates">
          <select value={s.timezone} onChange={(e) => set({ timezone: e.target.value })} className="field w-64">
            {[...new Set([s.timezone, ...ZONES])].map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Practice leaderboard" hint="Ranks members by problems solved">
          <Switch checked={s.practiceLeaderboard} onChange={(v) => (set({ practiceLeaderboard: v }), save({ practiceLeaderboard: v }))} label="Practice leaderboard" />
        </Row>
      </Card>

      <Card
        title="Claude"
        footer={
          <>
            <Status state={claude} />
            <Button
              icon={<Sparkles className="size-4" />}
              disabled={pending || !aiKey}
              onClick={() =>
                start(async () => {
                  setClaude(null);
                  const r = await testClaude();
                  setClaude(r.ok ? { ok: true, text: `Working · ${r.data?.model} · ${((r.data?.ms ?? 0) / 1000).toFixed(1)} s` } : { ok: false, text: r.error });
                })
              }
            >
              Test
            </Button>
            <Button variant="primary" disabled={pending} onClick={() => save({ aiModel: s.aiModel, aiEffort: s.aiEffort })}>
              Save
            </Button>
          </>
        }
      >
        {!aiKey && (
          <div className="rounded-md bg-amber-soft px-3 py-2 text-sm text-amber">
            Add <code className="font-mono">ANTHROPIC_API_KEY</code> to the site&apos;s environment to grade written answers, draft rubrics and review integrity logs.
          </div>
        )}
        <Row label="Use Claude" hint="Grading, rubric drafts, problem drafts and integrity reviews">
          <Switch checked={s.aiEnabled} onChange={(v) => (set({ aiEnabled: v }), save({ aiEnabled: v }, v ? "Claude on" : "Claude off"))} label="Use Claude" />
        </Row>
        <Row label="Model">
          <select value={s.aiModel} onChange={(e) => set({ aiModel: e.target.value })} className="field w-64">
            <option value="claude-opus-5-5">Claude Opus 5.5</option>
            <option value="claude-sonnet-5-5">Claude Sonnet 5.5</option>
            <option value="claude-haiku-5-5">Claude Haiku 5.5</option>
          </select>
        </Row>
        <Row label="Effort" hint="Higher is more careful and slower">
          <select value={s.aiEffort} onChange={(e) => set({ aiEffort: e.target.value as S["aiEffort"] })} className="field w-64">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </Row>
      </Card>

      <Card
        title="Code runner"
        footer={
          <>
            <Status state={runner} />
            <Button
              icon={<SquareTerminal className="size-4" />}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setRunner(null);
                  const r = await testRunner();
                  setRunner(r.ok ? { ok: true, text: `Working · ${r.data?.provider} · ${((r.data?.ms ?? 0) / 1000).toFixed(1)} s` } : { ok: false, text: r.error });
                })
              }
            >
              Test
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          Code runs on Judge0 with Wandbox as a backup. Set <code className="font-mono">JUDGE0_URL</code> or <code className="font-mono">PISTON_URL</code> to use your own server.
        </p>
      </Card>

      <Card title="Lab CS app">
        <Row label="Current version">
          <span className="num font-mono text-sm">{desktopVersion}</span>
        </Row>
        <Row label="Oldest version allowed" hint="Older copies are asked to update">
          <div className="flex items-center gap-2">
            <input value={s.desktopMinVersion} onChange={(e) => set({ desktopMinVersion: e.target.value })} className="field w-28 font-mono" />
            <Button disabled={pending} onClick={() => save({ desktopMinVersion: s.desktopMinVersion })}>
              Save
            </Button>
          </div>
        </Row>
        <Row label="Large slide uploads" hint="PDFs over 4 MB need Vercel Blob">
          <span className="text-sm text-ink-3">{blob ? "Connected" : "Not connected"}</span>
        </Row>
      </Card>

      <Card title="Starter content">
        <Row label="Problems, tests and slides" hint="Adds anything missing. Nothing you made is changed.">
          <Button
            icon={<PackagePlus className="size-4" />}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await loadStarterContent();
                toast(r.ok ? "Starter content loaded" : r.error, r.ok ? "default" : "error");
                router.refresh();
              })
            }
          >
            Load
          </Button>
        </Row>
      </Card>
    </div>
  );
}
