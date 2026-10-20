"use client";

import { useCallback, useEffect, useState } from "react";
import { Play, RotateCcw, LoaderCircle } from "lucide-react";
import { CodeEditor } from "@/components/editor/code-editor";
import { LanguagePicker } from "@/components/editor/language-picker";
import { ExecMeta, ExecOutput } from "@/components/editor/output";
import { Button } from "@/components/ui/button";
import { Split } from "@/components/ui/split";
import { useToast } from "@/components/ui/toast";
import { getLanguage, LANGUAGES } from "@/lib/runner/languages";
import type { ExecResult } from "@/lib/runner";

const KEY = "playground";

function loadDraft(lang: string): string | null {
  try {
    return localStorage.getItem(`${KEY}:code:${lang}`);
  } catch {
    return null;
  }
}

export function Playground() {
  const toast = useToast();
  const [lang, setLang] = useState("python");
  const [code, setCode] = useState(LANGUAGES[0].template);
  const [stdin, setStdin] = useState("");
  const [result, setResult] = useState<ExecResult | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    try {
      const l = localStorage.getItem(`${KEY}:lang`);
      const first = l && getLanguage(l) ? l : "python";
      setLang(first);
      setCode(loadDraft(first) ?? getLanguage(first)!.template);
      setStdin(localStorage.getItem(`${KEY}:stdin`) ?? "");
    } catch {}
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(`${KEY}:code:${lang}`, code);
        localStorage.setItem(`${KEY}:stdin`, stdin);
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [code, stdin, lang]);

  const switchLang = (id: string) => {
    try {
      localStorage.setItem(`${KEY}:code:${lang}`, code);
      localStorage.setItem(`${KEY}:lang`, id);
    } catch {}
    setLang(id);
    setCode(loadDraft(id) ?? getLanguage(id)!.template);
    setResult(null);
  };

  const run = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language: lang, code, stdin, source: "playground" }),
      });
      const j = await res.json();
      if (!res.ok) toast(j.error ?? "Run failed", "error");
      else setResult(j);
    } catch {
      toast("Network error", "error");
    } finally {
      setRunning(false);
    }
  }, [code, lang, stdin, running, toast]);

  const mode = getLanguage(lang)?.mode ?? "text";
  return (
    <div className="flex h-[calc(100dvh-48px)] flex-col lg:h-dvh">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-panel px-3 sm:px-4">
        <h1 className="mr-2 text-md font-semibold">Playground</h1>
        <LanguagePicker value={lang} onChange={switchLang} />
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          icon={<RotateCcw className="size-3.5" />}
          onClick={() => {
            if (confirm("Replace your code with the starter template?")) setCode(getLanguage(lang)!.template);
          }}
        >
          <span className="hidden sm:inline">Reset</span>
        </Button>
        <Button
          variant="accent"
          size="md"
          onClick={run}
          disabled={running}
          icon={running ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-3.5 fill-current" />}
        >
          Run
          <span className="ml-1 hidden text-xs opacity-70 sm:inline">⌘↵</span>
        </Button>
      </div>
      <Split
        className="min-h-0 flex-1"
        storageKey="playground"
        initial={0.62}
        first={
          <CodeEditor
            key={lang}
            value={code}
            onChange={setCode}
            mode={mode}
            className="h-full"
            onRunShortcut={run}
            autoFocus
          />
        }
        second={
          <Split
            direction="column"
            storageKey="playground-io"
            initial={0.35}
            className="h-full"
            first={
              <div className="flex h-full flex-col bg-panel">
                <div className="flex h-9 shrink-0 items-center border-b border-line px-3 text-xs font-medium text-ink-3">Input</div>
                <textarea
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  spellCheck={false}
                  placeholder="stdin"
                  className="min-h-0 flex-1 resize-none bg-panel px-3 py-2 font-mono text-[12.5px] leading-[1.6] outline-none placeholder:text-ink-4"
                />
              </div>
            }
            second={
              <div className="flex h-full flex-col bg-panel">
                <div className="flex h-9 shrink-0 items-center justify-between border-b border-line px-3">
                  <span className="text-xs font-medium text-ink-3">Output</span>
                  {result && <ExecMeta r={result} />}
                </div>
                <div className="min-h-0 flex-1 overflow-auto px-3 py-2.5">
                  {running ? (
                    <div className="flex items-center gap-2 text-sm text-ink-3">
                      <LoaderCircle className="size-3.5 animate-spin" /> Running
                    </div>
                  ) : result ? (
                    <ExecOutput r={result} />
                  ) : (
                    <div className="text-sm text-ink-4">Run your code to see output.</div>
                  )}
                </div>
              </div>
            }
          />
        }
      />
    </div>
  );
}
