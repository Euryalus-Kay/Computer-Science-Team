"use client";

import { useEffect, useRef, useState } from "react";
import { runCommand, complete, type Shell, type TerminalEnv } from "@/lib/items/widgets/terminal";
import type { ItemProps } from "../types";
import { AnswerField } from "./common";

type Line = { kind: "in" | "out" | "sys"; text: string; prompt?: string };
type Session = { shell: Shell; lines: Line[] };

// One shell per environment, shared by every terminal question in the attempt.
const sessions = new Map<string, Session>();
function sessionFor(env: TerminalEnv): Session {
  const key = `${env.host}:${JSON.stringify(env.fs).length}`;
  let s = sessions.get(key);
  if (!s) {
    s = {
      shell: { env, cwd: env.home, history: [] },
      lines: [
        { kind: "sys", text: `Connected to ${env.host} as ${env.user}.` },
        { kind: "sys", text: "Type help to see the commands." },
      ],
    };
    sessions.set(key, s);
  }
  return s;
}

function promptFor(sh: Shell) {
  const dir = sh.cwd === sh.env.home ? "~" : sh.cwd.startsWith(sh.env.home + "/") ? "~" + sh.cwd.slice(sh.env.home.length) : sh.cwd;
  return `${sh.env.user}@${sh.env.host}:${dir}$`;
}

export function Terminal({ item, value, onChange, disabled }: ItemProps<{ env: TerminalEnv; ask: string }, { text: string }>) {
  const session = sessionFor(item.data.env);
  const [, force] = useState(0);
  const [input, setInput] = useState("");
  const [hist, setHist] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  });
  const exec = () => {
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
      <AnswerField label="Answer" value={value?.text ?? ""} onChange={(t) => onChange({ text: t })} disabled={disabled} width="w-56" />
    </div>
  );
}
