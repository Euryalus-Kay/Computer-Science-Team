"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { runCommand, complete, type Shell, type TerminalEnv } from "@/lib/items/widgets/terminal";
import type { ItemProps } from "../types";
import { AnswerField, HintBox } from "./common";

type Line = { kind: "in" | "out" | "sys"; text: string; prompt?: string };
type Session = { shell: Shell; lines: Line[] };

// One shell per environment, shared by every terminal question in the attempt.
const sessions = new Map<string, Session>();
function sessionFor(env: TerminalEnv): Session {
  // Keyed by the whole file system, so two attempts in one page load never share a shell.
  const json = JSON.stringify(env.fs);
  let h = 5381;
  for (let i = 0; i < json.length; i++) h = (h * 33 + json.charCodeAt(i)) | 0;
  const key = `${env.host}:${json.length}:${h}`;
  let s = sessions.get(key);
  if (!s) {
    s = freshSession(env);
    sessions.set(key, s);
  }
  return s;
}

function freshSession(env: TerminalEnv): Session {
  return {
    shell: { env, cwd: env.home, history: [] },
    lines: [
      { kind: "sys", text: `Connected to ${env.host} as ${env.user}.` },
      { kind: "sys", text: "Type help to see the commands." },
    ],
  };
}

function promptFor(sh: Shell) {
  const dir = sh.cwd === sh.env.home ? "~" : sh.cwd.startsWith(sh.env.home + "/") ? "~" + sh.cwd.slice(sh.env.home.length) : sh.cwd;
  return `${sh.env.user}@${sh.env.host}:${dir}$`;
}

export function Terminal({ item, value, onChange, disabled, state, interact, log }: ItemProps<{ env: TerminalEnv; ask: string }, { text: string }, { hint?: string }>) {
  const session = sessionFor(item.data.env);
  const [hint, setHint] = useState<string | null>(state?.hint ?? null);
  const getHint = async () => {
    const r = (await interact({ hint: true, history: session.shell.history, cwd: session.shell.cwd })) as { hint: string | null };
    if (!r?.hint) throw new Error("No hint");
    setHint(r.hint);
    log?.("hint_used");
  };
  // Bumped when the output changes. Scrolling follows it, so reading back up isn't pulled down again.
  const [version, force] = useState(0);
  const [input, setInput] = useState("");
  const [hist, setHist] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [version]);
  const reset = () => {
    Object.assign(session, freshSession(item.data.env));
    setInput("");
    setHist(null);
    force((n) => n + 1);
    field.current?.focus();
  };
  const exec = () => {
    if (input.trim() === "reset") return reset();
    const sh = session.shell;
    const prompt = promptFor(sh);
    session.lines.push({ kind: "in", text: input, prompt });
    if (input.trim()) sh.history.push(input.trim());
    const r = runCommand(sh, input);
    if (r.out === null) session.lines = [];
    else if (r.out) session.lines.push({ kind: "out", text: r.out });
    sh.cwd = r.cwd;
    if (session.lines.length > 400) session.lines = session.lines.slice(-400);
    setInput("");
    setHist(null);
    force((n) => n + 1);
  };
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const h = session.shell.history;
    if (e.key === "Enter") {
      e.preventDefault();
      exec();
    } else if (e.key === "Tab") {
      e.preventDefault();
      setInput(complete(session.shell, input));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!h.length) return;
      const i = hist === null ? h.length - 1 : Math.max(0, hist - 1);
      setHist(i);
      setInput(h[i]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (hist === null) return;
      const i = hist + 1;
      if (i >= h.length) {
        setHist(null);
        setInput("");
      } else {
        setHist(i);
        setInput(h[i]);
      }
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      session.lines = [];
      force((n) => n + 1);
    } else if (e.key === "c" && e.ctrlKey && !window.getSelection()?.toString()) {
      e.preventDefault();
      session.lines.push({ kind: "in", text: input + "^C", prompt: promptFor(session.shell) });
      setInput("");
      force((n) => n + 1);
    }
  };
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-[#20262e] bg-[#0b0e12] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.5)]">
        <div className="flex h-8 items-center gap-1.5 border-b border-[#1c2128] bg-[#11151a] px-3">
          <span className="size-2.5 rounded-full bg-[#3a4049]" />
          <span className="size-2.5 rounded-full bg-[#3a4049]" />
          <span className="size-2.5 rounded-full bg-[#3a4049]" />
          <span className="ml-2 font-mono text-[11px] text-[#7c8692]">ssh {item.data.env.user}@{item.data.env.host}</span>
          <ResetButton onClick={reset} disabled={disabled} />
        </div>
        <div
          ref={box}
          onClick={() => !window.getSelection()?.toString() && field.current?.focus()}
          className="h-[340px] overflow-y-auto px-3.5 py-3 font-mono text-[13px] leading-[1.6] text-[#d5dbe2]"
        >
          {session.lines.map((l, i) =>
            l.kind === "in" ? (
              <div key={i} className="break-all whitespace-pre-wrap">
                <span className="text-[#5fd7a0]">{l.prompt}</span> {l.text}
              </div>
            ) : (
              <div key={i} className={l.kind === "sys" ? "text-[#7c8692]" : "break-all whitespace-pre-wrap"}>
                {l.text}
              </div>
            ),
          )}
          <div className="flex">
            <span className="shrink-0 text-[#5fd7a0]">{promptFor(session.shell)}&nbsp;</span>
            <input
              ref={field}
              value={input}
              disabled={disabled}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              spellCheck={false}
              autoCapitalize="none"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-[#e9edf1] caret-[#5fd7a0] outline-none"
              aria-label="Terminal input"
            />
          </div>
        </div>
      </div>
      <HintBox hint={hint} onGet={getHint} disabled={disabled} />
      <AnswerField label="Answer" value={value?.text ?? ""} onChange={(t) => onChange({ text: t })} disabled={disabled} width="w-56" />
    </div>
  );
}

/** Starts the terminal over. Shared with the door terminal. */
export function ResetButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="Clear the screen and go back to where you started"
      className="ml-auto inline-flex h-6 items-center gap-1 rounded px-2 font-mono text-[11px] text-[#9aa4af] hover:bg-[#1c2128] hover:text-[#e9edf1] disabled:opacity-40"
    >
      <RotateCcw className="size-3" /> Reset
    </button>
  );
}
