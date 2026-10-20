"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { LogoMark } from "@/components/shell/logo";
import { cn } from "@/lib/cn";
import type { BoardState } from "@/lib/db/schema";
import type { BoardTest } from "@/lib/board";

export type BoardPayload = {
  state: BoardState;
  test: BoardTest | null;
  deck: { id: string; title: string; count: number; slide: number; html: string } | null;
  join: { code: string | null; siteName: string; timezone: string };
  serverNow: number;
};

export function clockText(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

function Qr({ text, className }: { text: string; className?: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let live = true;
    QRCode.toString(text, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#ffffff", light: "#00000000" } }).then((s) => live && setSvg(s));
    return () => {
      live = false;
    };
  }, [text]);
  return <div className={cn("[&>svg]:h-full [&>svg]:w-full", className)} dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** The projector view. Sized with container units so it also works as a small preview. */
export function BoardScreen({ data, now, origin }: { data: BoardPayload; now: number | null; origin: string }) {
  const { state, test } = data;
  const host = origin.replace(/^https?:\/\//, "");
  return (
    <div data-theme="dark" className="relative h-full w-full overflow-hidden bg-[#0b0d10] text-[#eef0f3] [container-type:size]">
      <div className="absolute inset-x-[3cqw] top-[2.6cqh] flex items-center justify-between text-[1.5cqw] text-white/55">
        <span className="flex items-center gap-[0.8cqw] font-medium text-white/80">
          <span className="text-white">
            <LogoMark size={0} className="size-[2.2cqw]" />
          </span>
          {data.join.siteName}
        </span>
        <span className="num font-mono">{now ? new Date(now).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: data.join.timezone }) : ""}</span>
      </div>
      <div className="absolute inset-0 flex items-center justify-center px-[5cqw] pt-[6cqh] pb-[5cqh]">
        {state.view === "test" ? (
          test ? (
            <TestView test={test} now={now} origin={origin} host={host} />
          ) : (
            <Big text="Pick a test" dim />
          )
        ) : state.view === "timer" ? (
          <TimerView timer={state.timer} now={now} />
        ) : state.view === "join" ? (
          <JoinView code={data.join.code} siteName={data.join.siteName} origin={origin} host={host} />
        ) : state.view === "slides" ? (
          data.deck ? (
            <div className="flex h-full w-full flex-col">
              <div className="board-slide prose min-h-0 w-full flex-1 overflow-hidden" dangerouslySetInnerHTML={{ __html: data.deck.html }} />
              <div className="num pt-[1.5cqh] text-right font-mono text-[1.3cqw] text-white/40">
                {data.deck.slide + 1} / {data.deck.count}
              </div>
            </div>
          ) : (
            <Big text="Pick a deck" dim />
          )
        ) : state.message ? (
          <div className="max-w-[80cqw] text-center text-[5cqw] leading-tight font-semibold tracking-[-0.02em] text-balance">{state.message}</div>
        ) : (
          <span className="text-white/15">
            <LogoMark size={0} className="size-[10cqw]" />
          </span>
        )}
      </div>
    </div>
  );
}

function Big({ text, dim }: { text: string; dim?: boolean }) {
  return <div className={cn("text-[4cqw] font-semibold", dim && "text-white/30")}>{text}</div>;
}

function TestView({ test, now, origin, host }: { test: BoardTest; now: number | null; origin: string; host: string }) {
  const s = test.state;
  const t = now ?? 0;
  const lead = test.leaders.length > 0;
  let main: React.ReactNode;
  if (s.state === "waiting" || s.state === "scheduled" || s.state === "draft") {
    return (
      <div className="flex w-full items-center justify-between gap-[5cqw]">
        <div className="min-w-0">
          <div className="text-[2cqw] text-white/50">{s.state === "scheduled" ? "Opens soon" : "Starting soon"}</div>
          <div className="mt-[1cqh] text-[6cqw] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">{test.title}</div>
          <div className="mt-[4cqh] space-y-[1.4cqh] text-[2.2cqw] text-white/70">
            <div>
              Sign in at <span className="font-mono text-white">{host}</span>
            </div>
            <div>Open the test and wait. It starts for everyone at once.</div>
          </div>
          <div className="mt-[4cqh] flex gap-[3cqw] text-[1.8cqw] text-white/50">
            <span>
              <span className="num font-mono text-[3cqw] text-white">{test.questions}</span> questions
            </span>
            {test.durationMin && (
              <span>
                <span className="num font-mono text-[3cqw] text-white">{test.durationMin}</span> minutes
              </span>
            )}
            {test.working > 0 && (
              <span>
                <span className="num font-mono text-[3cqw] text-white">{test.working}</span> in
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 rounded-[1.2cqw] bg-white/[0.04] p-[2cqw]">
          <Qr text={`${origin}/tests/${test.slug}`} className="size-[24cqh]" />
        </div>
      </div>
    );
  }
  if (s.state === "countdown") {
    main = (
      <div className="text-center">
        <div className="text-[2.4cqw] text-white/50">{test.title} starts in</div>
        <div className="num font-mono text-[34cqh] leading-none font-semibold text-[#5fd7a0]">{Math.max(0, Math.ceil((s.startsAt - t) / 1000))}</div>
      </div>
    );
  } else if (s.state === "open") {
    const left = s.closesAt ? (test.paused ? s.closesAt - (t || s.closesAt) : s.closesAt - t) : null;
    const total = (test.durationMin ?? 0) * 60_000;
    const frac = left !== null && total ? Math.max(0, Math.min(1, 1 - left / Math.max(total, left))) : null;
    main = (
      <div className="w-full text-center">
        <div className="text-[2.4cqw] text-white/55">{test.title}</div>
        <div className={cn("num font-mono text-[30cqh] leading-[1.05] font-semibold tracking-[-0.04em]", test.paused && "text-[#e7a343]", left !== null && left < 60_000 && !test.paused && "text-[#f07167]")}>
          {left === null ? "Open" : clockText(left)}
        </div>
        <div className="mt-[1cqh] text-[2.2cqw] text-white/55">
          {test.paused ? (
            <span className="font-medium text-[#e7a343]">Paused</span>
          ) : (
            <>
              <span className="text-white">{test.working}</span> working · <span className="text-white">{test.submitted}</span> submitted
            </>
          )}
        </div>
        {frac !== null && (
          <div className="mx-auto mt-[5cqh] h-[0.7cqh] w-[60cqw] overflow-hidden rounded-full bg-white/10">
            <div className={cn("h-full rounded-full transition-[width] duration-1000", test.paused ? "bg-[#e7a343]" : "bg-[#2eb278]")} style={{ width: `${frac * 100}%` }} />
          </div>
        )}
      </div>
    );
  } else {
    main = (
      <div className="text-center">
        <div className="text-[2.4cqw] text-white/55">{test.title}</div>
        <div className="text-[16cqh] leading-tight font-semibold tracking-[-0.03em]">Time</div>
        <div className="mt-[1cqh] text-[2.2cqw] text-white/55">
          <span className="text-white">{test.submitted}</span> submitted
        </div>
      </div>
    );
  }
  if (!lead) return main;
  return (
    <div className="grid w-full grid-cols-[1fr_32cqw] items-center gap-[4cqw]">
      {main}
      <ol className="space-y-[1.1cqh]">
        {test.leaders.map((l, i) => (
          <li key={i} className="flex items-baseline gap-[1.2cqw] text-[2cqw]">
            <span className="num w-[2.4cqw] text-right font-mono text-white/40">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">{l.name}</span>
            <span className="num font-mono text-white/70">{Math.round(l.score * 10) / 10}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function TimerView({ timer, now }: { timer: BoardState["timer"]; now: number | null }) {
  const running = Boolean(timer.endsAt);
  const left = running ? Math.max(0, Date.parse(timer.endsAt!) - (now ?? Date.parse(timer.endsAt!))) : (timer.remainingMs ?? timer.durationMs);
  const done = running && left <= 0;
  return (
    <div className="text-center">
      {timer.label && <div className="text-[3cqw] font-medium text-white/60">{timer.label}</div>}
      <div className={cn("num font-mono text-[34cqh] leading-[1.05] font-semibold tracking-[-0.04em]", done && "animate-pulse text-[#f07167]", !running && !done && "text-white/80")}>
        {done ? "0:00" : clockText(left)}
      </div>
      {!running && left > 0 && left < timer.durationMs && <div className="text-[2.2cqw] font-medium text-[#e7a343]">Paused</div>}
    </div>
  );
}

function JoinView({ code, siteName, origin, host }: { code: string | null; siteName: string; origin: string; host: string }) {
  const url = code ? `${origin}/join?code=${code}` : `${origin}/login`;
  return (
    <div className="flex w-full items-center justify-between gap-[6cqw]">
      <div className="min-w-0">
        <div className="text-[2.2cqw] text-white/50">Join {siteName}</div>
        <div className="mt-[1cqh] font-mono text-[5cqw] leading-tight font-semibold tracking-[-0.02em]">
          {host}
          <span className="text-white/40">{code ? "/join" : ""}</span>
        </div>
        {code ? (
          <div className="mt-[5cqh]">
            <div className="text-[1.8cqw] text-white/50">Code</div>
            <div className="num font-mono text-[9cqw] leading-none font-semibold tracking-[0.12em] text-[#5fd7a0]">{code}</div>
          </div>
        ) : (
          <div className="mt-[4cqh] text-[2.2cqw] text-white/60">Ask for your sign-in details.</div>
        )}
      </div>
      <div className="shrink-0 rounded-[1.2cqw] bg-white/[0.04] p-[2.2cqw]">
        <Qr text={url} className="size-[34cqh]" />
      </div>
    </div>
  );
}
