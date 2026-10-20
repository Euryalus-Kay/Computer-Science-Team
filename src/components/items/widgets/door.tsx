"use client";

import { useEffect, useRef, useState } from "react";
import { DoorClosed, DoorOpen, LoaderCircle } from "lucide-react";
import type { DoorReply, DoorState } from "@/lib/items/widgets/door";
import { cn } from "@/lib/cn";
import type { ItemProps } from "../types";

type Line = { kind: "in" | "out" | "sys"; text: string; prompt?: string };

/** A terminal whose commands run on the server, for the door break-in. */
export function Door({ item, interact, state, disabled }: ItemProps<{ host: string; user: string }, unknown, DoorState>) {
  const { host, user } = item.data;
  const welcome: Line[] = [
    { kind: "sys", text: `Connected to ${host} as ${user}.` },
    { kind: "sys", text: "Type help to see the commands." },
  ];
  const [lines, setLines] = useState<Line[]>(() => [
    ...welcome,
    ...(state?.log ?? []).flatMap((l): Line[] => [{ kind: "in", text: l.i, prompt: l.p }, ...(l.o ? [{ kind: "out" as const, text: l.o }] : [])]),
  ]);
  const [prompt, setPrompt] = useState(() => (state ? promptFor(state) : `${user}@${host}:~$`));
  const [opened, setOpened] = useState(Boolean(state?.opened));
  const [connected, setConnected] = useState(Boolean(state?.connected));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const history = useRef<string[]>(state?.history ?? []);
  const [hist, setHist] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [lines, busy]);

  const run = async () => {
    const cmd = input;
    if (busy) return;
    setInput("");
    setHist(null);
    if (cmd.trim()) history.current = [...history.current, cmd.trim()].slice(-50);
    setLines((ls) => [...ls, { kind: "in", text: cmd, prompt }]);
    setBusy(true);
    try {
      const r = (await interact({ cmd })) as DoorReply;
      if (r.clear) setLines([]);
      else if (r.out) setLines((ls) => [...ls, { kind: "out", text: r.out }]);
      setPrompt(r.prompt);
      setOpened(r.opened);
      setConnected(r.connected);
    } catch {
      setLines((ls) => [...ls, { kind: "sys", text: "Connection hiccup. Try the command again." }]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => field.current?.focus());
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const h = history.current;
    if (e.key === "Enter") {
      e.preventDefault();
      run();
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
    }
  };

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-[#20262e] bg-[#0b0e12] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.5)]">
        <div className="flex h-8 items-center gap-1.5 border-b border-[#1c2128] bg-[#11151a] px-3">
          <span className="size-2.5 rounded-full bg-[#3a4049]" />
          <span className="size-2.5 rounded-full bg-[#3a4049]" />
          <span className="size-2.5 rounded-full bg-[#3a4049]" />
          <span className="ml-2 font-mono text-[11px] text-[#7c8692]">
            ssh {user}@{host}
            {connected && " → door"}
          </span>
        </div>
        <div
          ref={box}
          onClick={() => !window.getSelection()?.toString() && field.current?.focus()}
          className="h-[340px] overflow-y-auto px-3.5 py-3 font-mono text-[13px] leading-[1.6] text-[#d5dbe2]"
        >
          {lines.map((l, i) =>
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
            <span className="shrink-0 text-[#5fd7a0]">{prompt}&nbsp;</span>
            {busy ? (
              <LoaderCircle className="mt-1 size-3.5 animate-spin text-[#7c8692]" />
            ) : (
              <input
                ref={field}
                value={input}
                disabled={disabled}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent text-[#e9edf1] caret-[#5fd7a0] outline-none"
                aria-label="Terminal input"
              />
            )}
          </div>
        </div>
      </div>
      <div className={cn("inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium", opened ? "bg-accent-soft text-accent" : "bg-panel-3 text-ink-3")}>
        {opened ? <DoorOpen className="size-4" /> : <DoorClosed className="size-4" />}
        {opened ? "The door is open" : "The door is locked"}
      </div>
    </div>
  );
}

/** The prompt after a reload, matching promptOf in the door engine. */
function promptFor(s: DoorState) {
  if (s.connected) return "guest@door:~$";
  const home = "/home/guest";
  const dir = s.cwd === home ? "~" : s.cwd.startsWith(home + "/") ? "~" + s.cwd.slice(home.length) : s.cwd;
  return `guest@lab-gate:${dir}$`;
}
