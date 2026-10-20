"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clock, ListChecks, Camera, Maximize2, MonitorSmartphone, Radio, Play, LoaderCircle, Lock, Eye, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { formatDateTime, pts, relativeTime } from "@/lib/format";
import type { Availability } from "@/lib/tests/timing";
import { OpenInApp, OpenInSeb } from "./lockdown-launch";

type LobbyTest = {
  id: string;
  slug: string;
  title: string;
  descriptionHtml: string;
  durationMin: number | null;
  questions: number;
  points: number;
  startMode: "open" | "live";
  lockdown: string;
  camera: boolean;
  fullscreen: boolean;
  needsCode: boolean;
  maxAttempts: number;
  timezone: string;
};

export function TestLobby({
  test,
  initialState,
  sessionKind,
  lockdownOk,
  isAdmin,
  active,
  past,
}: {
  test: LobbyTest;
  initialState: Availability;
  sessionKind: "web" | "desktop" | "seb";
  lockdownOk: boolean;
  isAdmin: boolean;
  active: { id: string } | null;
  past: { id: string; submittedAt: string; score: number | null; maxScore: number; status: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState<Availability>(initialState);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [code, setCode] = useState("");
  const [starting, setStarting] = useState(false);
  const autoStarted = useRef(false);

  const live = test.startMode === "live";
  const waiting = state.state === "waiting" || state.state === "countdown";
  const attemptsLeft = test.maxAttempts - past.length;
  const canStart = !active && state.state === "open" && attemptsLeft > 0;

  useEffect(() => {
    if (!(waiting || state.state === "scheduled")) return;
    const poll = async () => {
      const r = await fetch(`/api/tests/${test.id}/state`).then((x) => x.json()).catch(() => null);
      if (r?.state) {
        setOffset(r.serverNow - Date.now());
        setState(r);
      }
    };
    poll();
    const t = setInterval(poll, 2000);
    return () => clearInterval(t);
  }, [waiting, state.state, test.id]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  async function start(preview = false) {
    if (starting) return;
    setStarting(true);
    try {
      if (test.fullscreen && !preview && sessionKind === "web") {
        try {
          await document.documentElement.requestFullscreen();
        } catch {}
      }
      const res = await fetch(`/api/tests/${test.id}/start`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ preview, code: code || undefined }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast(j.error ?? "Couldn't start", "error");
        setStarting(false);
        return;
      }
      router.push(`/take/${j.attemptId}`);
    } catch {
      toast("Network error. Try again.", "error");
      setStarting(false);
    }
  }

  // Live tests start for everyone at once: move people in automatically.
  useEffect(() => {
    if (live && state.state === "open" && !active && lockdownOk && !test.needsCode && attemptsLeft > 0 && !autoStarted.current && initialState.state !== "open") {
      autoStarted.current = true;
      start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.state]);

  const facts = [
    { icon: ListChecks, text: `${test.questions} questions · ${pts(test.points)} points` },
    test.durationMin ? { icon: Clock, text: `${test.durationMin} minutes` } : null,
    live ? { icon: Radio, text: "Everyone starts together" } : null,
    test.lockdown !== "none"
      ? { icon: MonitorSmartphone, text: test.lockdown === "seb" ? "Safe Exam Browser" : test.lockdown === "any" ? "Lockdown app or Safe Exam Browser" : "Lab CS app" }
      : null,
    test.fullscreen && test.lockdown === "none" ? { icon: Maximize2, text: "Full screen" } : null,
    test.camera ? { icon: Camera, text: "Camera check, video stays on your computer" } : null,
  ].filter(Boolean) as { icon: typeof Clock; text: string }[];

  const countdown = state.state === "countdown" ? Math.max(0, state.startsAt - (now + offset)) : 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-[-0.015em]">{test.title}</h1>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-2">
        {facts.map((f, i) => (
          <span key={i} className="inline-flex items-center gap-1.5">
            <f.icon className="size-4 text-ink-4" /> {f.text}
          </span>
        ))}
      </div>
      {test.descriptionHtml && <div className="prose mt-6" dangerouslySetInnerHTML={{ __html: test.descriptionHtml }} />}

      <div className="card mt-7 p-5">
        {active ? (
          lockdownOk ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-medium">You have this test open.</div>
                <div className="text-sm text-ink-3">Your answers are saved as you go.</div>
              </div>
              <Button variant="primary" size="lg" onClick={() => router.push(`/take/${active.id}`)} icon={<Play className="size-4 fill-current" />}>
                Resume
              </Button>
            </div>
          ) : (
            <LockdownChoice test={test} resume />
          )
        ) : waiting ? (
          <div className="flex flex-col items-center py-6 text-center">
            {state.state === "countdown" ? (
              <>
                <div className="text-sm text-ink-3">Starting in</div>
                <div className="num mt-1 font-mono text-6xl font-semibold tabular-nums">{Math.ceil(countdown / 1000)}</div>
              </>
            ) : (
              <>
                <span className="relative mb-4 flex size-3">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
                  <span className="relative inline-flex size-3 rounded-full bg-accent" />
                </span>
                <div className="text-lg font-semibold">Waiting for the start</div>
                <div className="mt-1 text-sm text-ink-3">Keep this page open. You&apos;ll be moved in automatically.</div>
              </>
            )}
            {!lockdownOk && (
              <div className="mt-6 w-full border-t border-line pt-5 text-left">
                <LockdownChoice test={test} />
              </div>
            )}
          </div>
        ) : state.state === "scheduled" ? (
          <div className="text-sm">
            Opens <b>{formatDateTime(state.opensAt, test.timezone)}</b> ({relativeTime(state.opensAt)}).
          </div>
        ) : state.state === "closed" ? (
          <div className="text-sm text-ink-2">This test is closed.</div>
        ) : state.state === "draft" ? (
          <div className="text-sm text-ink-2">This test is a draft. Only admins can preview it.</div>
        ) : attemptsLeft <= 0 ? (
          <div className="text-sm text-ink-2">You&apos;ve submitted this test.</div>
        ) : !lockdownOk ? (
          <LockdownChoice test={test} />
        ) : (
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-md text-sm text-ink-2">
              {test.durationMin ? (
                <>
                  The clock starts when you press Start and keeps running if you leave.
                  {test.fullscreen && " The test opens in full screen."}
                </>
              ) : (
                "Your answers save as you go."
              )}
            </div>
            <div className="flex items-end gap-2">
              {test.needsCode && (
                <div>
                  <label className="label text-xs" htmlFor="access">
                    <Lock className="mr-1 inline size-3" /> Access code
                  </label>
                  <input id="access" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="field w-36 font-mono tracking-widest" />
                </div>
              )}
              <Button variant="primary" size="lg" onClick={() => start()} disabled={!canStart || starting || (test.needsCode && !code)}>
                {starting ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4 fill-current" />}
                Start
              </Button>
            </div>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="mt-3 flex items-center gap-2 text-sm text-ink-3">
          <Button size="sm" variant="ghost" icon={<Eye className="size-3.5" />} onClick={() => start(true)}>
            Preview as a member
          </Button>
          <span>Previews aren&apos;t counted in results.</span>
        </div>
      )}

      {past.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-medium text-ink-3">Your attempts</h2>
          <div className="card divide-y divide-line">
            {past.map((a) => (
              <Link key={a.id} href={`/take/${a.id}`} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-panel-2">
                <span>{formatDateTime(a.submittedAt, test.timezone)}</span>
                <span className="flex items-center gap-3">
                  {a.status === "expired" && <Badge tone="neutral">Time ran out</Badge>}
                  {a.score !== null ? (
                    <span className="num font-medium">
                      {pts(a.score)} / {pts(a.maxScore)}
                    </span>
                  ) : (
                    <span className="text-ink-3">Submitted</span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LockdownChoice({ test, resume }: { test: LobbyTest; resume?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent" />
        <div>
          <div className="font-medium">{resume ? "Continue in lockdown mode" : "This test runs in lockdown mode"}</div>
          <div className="text-sm text-ink-3">
            {test.lockdown === "seb"
              ? "Open it in Safe Exam Browser. Other apps and tabs are blocked until you submit."
              : "Open it in the Lab CS app. It fills the screen and blocks other apps until you submit."}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {(test.lockdown === "app" || test.lockdown === "any") && <OpenInApp target={`/tests/${test.slug}`} />}
        {(test.lockdown === "seb" || test.lockdown === "any") && <OpenInSeb testId={test.id} secondary={test.lockdown === "any"} />}
      </div>
    </div>
  );
}

