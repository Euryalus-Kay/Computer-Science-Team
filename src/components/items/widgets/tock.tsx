"use client";

import { useMemo, useRef, useState } from "react";
import { Play, BookOpen } from "lucide-react";
import { runTock, type RunResult } from "@/lib/tock";
import { CodeEditor } from "@/components/editor/code-editor";
import { Button } from "@/components/ui/button";
import type { ItemProps } from "../types";
import { Stage, AnswerField } from "./common";

const KW = new Set(["if", "then", "else", "end", "for", "in", "do", "while", "repeat", "times", "say", "read", "and", "or", "not"]);
const BI = new Set(["range", "len", "sum", "max", "min", "abs", "text", "num", "keep", "map", "fold", "take", "sort", "rev", "count"]);

function highlightLine(line: string) {
  const out: { t: string; c?: string }[] = [];
  let i = 0;
  while (i < line.length) {
    const rest = line.slice(i);
    let m: RegExpMatchArray | null;
    let c: string | undefined;
    if (rest[0] === "#") {
      out.push({ t: rest, c: "var(--syn-comment)" });
      break;
    }
    if ((m = rest.match(/^"[^"]*"?/))) c = "var(--syn-string)";
    else if ((m = rest.match(/^\d+/))) c = "var(--syn-number)";
    else if ((m = rest.match(/^[A-Za-z_]\w*/))) {
      const w = m[0];
      c = w === "true" || w === "false" ? "var(--syn-number)" : KW.has(w) ? "var(--syn-keyword)" : BI.has(w) ? "var(--syn-builtin)" : undefined;
    } else if ((m = rest.match(/^(<-|->|\|>|!=|<=|>=|[+\-*/%=<>])/))) c = "var(--syn-operator)";
    else m = rest.match(/^\s+|^./)!;
    out.push({ t: m[0], c });
    i += m[0].length;
  }
  return out;
}

export function TockCode({ code }: { code: string }) {
  const lines = code.split("\n");
  return (
    <div className="overflow-x-auto bg-[var(--editor-bg)] py-3 font-mono text-[13.5px] leading-[1.7]">
      {lines.map((l, i) => (
        <div key={i} className="flex">
          <span className="w-10 shrink-0 pr-3 text-right text-ink-4 select-none">{i + 1}</span>
          <span className="min-w-0 pr-4 whitespace-pre-wrap [overflow-wrap:anywhere]">
            {highlightLine(l).map((p, j) => (
              <span key={j} style={p.c ? { color: p.c } : undefined}>
                {p.t}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

function RefHint() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("labcs:open-reference"))}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-blue hover:underline"
    >
      <BookOpen className="size-3.5" /> Tock reference
    </button>
  );
}

export function TockTrace({ item, value, onChange, disabled }: ItemProps<{ code: string }, { text: string }>) {
  return (
    <div className="space-y-3">
      <Stage>
        <div className="flex h-9 items-center justify-between border-b border-line px-3">
          <span className="font-mono text-xs text-ink-3">program.tock</span>
          <RefHint />
        </div>
        <TockCode code={item.data.code} />
      </Stage>
      <AnswerField label="Printed output" value={value?.text ?? ""} onChange={(t) => onChange({ text: t })} disabled={disabled} width="w-72" />
    </div>
  );
}

export function TockReverse({ item, value, onChange, disabled }: ItemProps<{ code: string; lo: number; hi: number }, { text: string }>) {
  return (
    <div className="space-y-3">
      <Stage>
        <div className="flex h-9 items-center justify-between border-b border-line px-3">
          <span className="font-mono text-xs text-ink-3">check.tock</span>
          <RefHint />
        </div>
        <TockCode code={item.data.code} />
      </Stage>
      <AnswerField
        label={`Input from ${item.data.lo} to ${item.data.hi}`}
        value={value?.text ?? ""}
        onChange={(t) => onChange({ text: t })}
        disabled={disabled}
        width="w-28"
        inputMode="numeric"
      />
    </div>
  );
}

export function TockWrite({ item, value, onChange, disabled, log }: ItemProps<{ sample: { input: string; output: string } }, { code: string }>) {
  const [input, setInput] = useState(item.data.sample.input.trim());
  const [result, setResult] = useState<RunResult | null>(null);
  const code = value?.code ?? "";
  const runs = useRef(0);
  const run = () => {
    const r = runTock(code, input + "\n");
    setResult(r);
    runs.current++;
    log?.("tock_run", { chars: code.length, lines: code.split("\n").length, ok: !r.error });
  };
  const expected = useMemo(() => (input.trim() === item.data.sample.input.trim() ? item.data.sample.output : null), [input, item.data.sample]);
  return (
    <Stage>
      <div className="flex h-9 items-center justify-between border-b border-line px-3">
        <span className="font-mono text-xs text-ink-3">solution.tock</span>
        <RefHint />
      </div>
      <div className="h-[280px] border-b border-line">
        <CodeEditor
          value={code}
          onChange={(c) => onChange({ code: c })}
          mode="tock"
          readOnly={disabled}
          className="h-full"
          tabSize={2}
          placeholder="n <- read"
          onRunShortcut={run}
        />
      </div>
      <div className="grid gap-px bg-line sm:grid-cols-[200px_1fr]">
        <div className="bg-panel p-3">
          <div className="mb-1.5 text-xs font-medium text-ink-3">Input</div>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2} className="field resize-none font-mono text-[13px]" spellCheck={false} />
          <Button size="sm" variant="accent" className="mt-2 w-full" icon={<Play className="size-3.5" />} onClick={run} disabled={!code.trim()}>
            Run
          </Button>
        </div>
        <div className="min-h-[110px] bg-panel p-3">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-ink-3">Output</span>
            {result && !result.error && expected !== null && (
              <span className={result.output.trim() === expected.trim() ? "font-medium text-accent" : "text-red"}>
                {result.output.trim() === expected.trim() ? "Matches the example" : `Example expects ${expected}`}
              </span>
            )}
          </div>
          {result ? (
            <>
              <pre className="font-mono text-[13px] whitespace-pre-wrap">{result.output || (!result.error ? "(nothing printed)" : "")}</pre>
              {result.error && (
                <div className="mt-1 font-mono text-[12.5px] text-red">
                  {result.error.line ? `Line ${result.error.line}: ` : ""}
                  {result.error.message}
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-ink-4">
              Example: input {item.data.sample.input.trim()} prints {item.data.sample.output}
            </div>
          )}
        </div>
      </div>
    </Stage>
  );
}
