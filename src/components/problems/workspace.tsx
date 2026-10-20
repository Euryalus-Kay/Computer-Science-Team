"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Play, Send, LoaderCircle, RotateCcw, CircleCheck, CircleX, Clock, Copy } from "lucide-react";
import { CodeEditor } from "@/components/editor/code-editor";
import { LanguagePicker } from "@/components/editor/language-picker";
import { ExecMeta, ExecOutput } from "@/components/editor/output";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Split } from "@/components/ui/split";
import { useMedia } from "@/lib/use-media";
import { useToast } from "@/components/ui/toast";
import { getLanguage, CORE_LANGUAGES } from "@/lib/runner/languages";
import type { ExecResult } from "@/lib/runner";
import type { JudgeOutcome } from "@/lib/problems";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/format";

export type WorkspaceProblem = {
  title: string;
  statementHtml: string;
  samples: { input: string; output: string; explanation?: string | null }[];
  timeLimitMs: number;
  memoryLimitMb: number;
  starter: Record<string, string>;
};

export type SubmissionSummary = {
  id: string;
  language: string;
  verdict: string | null;
  passed: number;
  total: number;
  timeMs: number | null;
  createdAt: string;
};

const VERDICT: Record<string, { label: string; tone: "green" | "red" | "amber" | "neutral" }> = {
  AC: { label: "Accepted", tone: "green" },
  WA: { label: "Wrong answer", tone: "red" },
  TLE: { label: "Time limit exceeded", tone: "amber" },
  MLE: { label: "Memory limit exceeded", tone: "amber" },
  RE: { label: "Runtime error", tone: "red" },
  CE: { label: "Compilation error", tone: "red" },
  IE: { label: "Runner error", tone: "neutral" },
};

export function VerdictBadge({ v }: { v: string | null }) {
  const x = VERDICT[v ?? ""] ?? { label: v ?? "Pending", tone: "neutral" as const };
  return <Badge tone={x.tone}>{x.label}</Badge>;
}

type Panel = "results" | "custom" | "history";
type RunState =
  | { kind: "idle" }
  | { kind: "running"; what: "run" | "submit" | "custom" }
  | { kind: "samples"; outcome: JudgeOutcome }
  | { kind: "submitted"; outcome: JudgeOutcome }
  | { kind: "custom"; result: ExecResult };

export function Statement({ problem, header }: { problem: WorkspaceProblem; header?: ReactNode }) {
  return (
    <div className="h-full overflow-y-auto bg-panel">
      <div className="px-5 py-5 sm:px-6">
        {header}
        <div className="prose" dangerouslySetInnerHTML={{ __html: problem.statementHtml }} />
        {problem.samples.length > 0 && (
          <div className="mt-7">
            <h3 className="mb-3 text-[15px] font-semibold">Examples</h3>
            <div className="space-y-4">
              {problem.samples.map((s, i) => (
                <div key={i} className="overflow-hidden rounded-lg border border-line">
                  <div className="grid sm:grid-cols-2">
                    <IOBlock label={`Input ${problem.samples.length > 1 ? i + 1 : ""}`} text={s.input} />
                    <IOBlock label="Output" text={s.output} className="border-t border-line sm:border-t-0 sm:border-l" />
                  </div>
                  {s.explanation && <div className="border-t border-line bg-panel-2 px-3 py-2 text-sm text-ink-2">{s.explanation}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-6 flex gap-4 text-xs text-ink-3">
          <span>Time limit {problem.timeLimitMs / 1000}s</span>
          <span>Memory {problem.memoryLimitMb} MB</span>
        </div>
      </div>
    </div>
  );
}

function IOBlock({ label, text, className }: { label: string; text: string; className?: string }) {
  const toast = useToast();
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex h-8 items-center justify-between bg-panel-2 px-3 text-xs font-medium text-ink-3">
        {label}
        <button
          onClick={() => {
            navigator.clipboard.writeText(text);
            toast("Copied");
          }}
          className="rounded p-0.5 text-ink-4 hover:text-ink-2"
          aria-label="Copy"
        >
          <Copy className="size-3.5" />
        </button>
      </div>
      <pre className="max-h-64 overflow-auto px-3 py-2 font-mono text-[12.5px] leading-[1.6] whitespace-pre text-ink">{text}</pre>
    </div>
  );
}

export function Workspace({
  problem,
  storageKey,
  runUrl,
  submitUrl,
  initialSubmissions = [],
  allowedLanguages,
  statementHeader,
  onPaste,
  onCopy,
  onSubmitted,
  submitLabel = "Submit",
  height = "h-[calc(100dvh-48px)] lg:h-dvh",
  toolbarLeft,
}: {
  problem: WorkspaceProblem;
  storageKey: string;
  runUrl: string;
  submitUrl: string;
  initialSubmissions?: SubmissionSummary[];
  allowedLanguages?: string[];
  statementHeader?: ReactNode;
  onPaste?: (text: string) => void;
  onCopy?: (text: string) => void;
  onSubmitted?: (outcome: JudgeOutcome) => void;
  submitLabel?: string;
  height?: string;
  toolbarLeft?: ReactNode;
}) {
  const toast = useToast();
  const langs = allowedLanguages?.length ? allowedLanguages : undefined;
  const defaultLang = langs?.[0] ?? "python";
  const [lang, setLang] = useState(defaultLang);
  const templateFor = useCallback(
    (l: string) => problem.starter[l] ?? getLanguage(l)?.template ?? "",
    [problem.starter],
  );
  const [code, setCode] = useState(() => templateFor(defaultLang));
  const [custom, setCustom] = useState(problem.samples[0]?.input ?? "");
  const [panel, setPanel] = useState<Panel>("results");
  // Phones stack the statement above the editor instead of squeezing them side by side.
  const narrow = useMedia("(max-width: 767px)");
  const [state, setState] = useState<RunState>({ kind: "idle" });
  const [subs, setSubs] = useState<SubmissionSummary[]>(initialSubmissions);
  const busy = state.kind === "running";

  useEffect(() => {
    try {
      const l = localStorage.getItem(`ws:${storageKey}:lang`);
      const pick = l && getLanguage(l) && (!langs || langs.includes(l)) ? l : defaultLang;
      setLang(pick);
      setCode(localStorage.getItem(`ws:${storageKey}:code:${pick}`) ?? templateFor(pick));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(`ws:${storageKey}:code:${lang}`, code);
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [code, lang, storageKey]);

  const switchLang = (id: string) => {
    try {
      localStorage.setItem(`ws:${storageKey}:code:${lang}`, code);
      localStorage.setItem(`ws:${storageKey}:lang`, id);
    } catch {}
    setLang(id);
    try {
      setCode(localStorage.getItem(`ws:${storageKey}:code:${id}`) ?? templateFor(id));
    } catch {
      setCode(templateFor(id));
    }
  };

  async function post(url: string, body: object) {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({ error: "Unexpected response" }));
    if (!res.ok) throw new Error(j.error ?? "Request failed");
    return j;
  }

  const run = useCallback(async () => {
    if (busy) return;
    setPanel("results");
    setState({ kind: "running", what: "run" });
    try {
      const j = await post(runUrl, { language: lang, code });
      setState({ kind: "samples", outcome: j.outcome });
    } catch (e) {
      toast((e as Error).message, "error");
      setState({ kind: "idle" });
    }
  }, [busy, runUrl, lang, code, toast]);

  const runCustom = async () => {
    if (busy) return;
    setState({ kind: "running", what: "custom" });
    try {
      const j = await post(runUrl, { language: lang, code, input: custom });
      setState({ kind: "custom", result: j.result });
    } catch (e) {
      toast((e as Error).message, "error");
      setState({ kind: "idle" });
    }
  };

  const submit = useCallback(async () => {
    if (busy) return;
    setPanel("results");
    setState({ kind: "running", what: "submit" });
    try {
      const j = await post(submitUrl, { language: lang, code });
      setState({ kind: "submitted", outcome: j.outcome });
      if (j.id) {
        setSubs((s) => [
          {
            id: j.id,
            language: lang,
            verdict: j.outcome.verdict,
            passed: j.outcome.passed,
            total: j.outcome.total,
            timeMs: j.outcome.timeMs,
            createdAt: new Date().toISOString(),
          },
          ...s,
        ]);
      }
      onSubmitted?.(j.outcome);
    } catch (e) {
      toast((e as Error).message, "error");
      setState({ kind: "idle" });
    }
  }, [busy, submitUrl, lang, code, toast, onSubmitted]);

  const loadSubmission = async (id: string) => {
    const res = await fetch(`/api/submissions/${id}`);
    if (!res.ok) return toast("Couldn't load that submission", "error");
    const s = await res.json();
    if (!confirm("Replace the editor contents with this submission?")) return;
    if (s.language !== lang) switchLang(s.language);
    setCode(s.code);
  };

  const mode = getLanguage(lang)?.mode ?? "text";
  const tabs: { id: Panel; label: string }[] = [
    { id: "results", label: "Results" },
    { id: "custom", label: "Custom input" },
    { id: "history", label: `Submissions${subs.length ? ` · ${subs.length}` : ""}` },
  ];

  return (
    <div className={cn("flex flex-col", height)}>
      <Split
        key={narrow ? "stacked" : "side"}
        className="min-h-0 flex-1"
        direction={narrow ? "column" : "row"}
        storageKey={narrow ? "workspace-stacked" : "workspace"}
        initial={narrow ? 0.36 : 0.42}
        min={narrow ? 0.15 : 0.25}
        max={narrow ? 0.75 : 0.7}
        first={<Statement problem={problem} header={statementHeader} />}
        second={
          <div className="flex h-full flex-col">
            <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-panel px-3">
              {toolbarLeft}
              <LanguagePicker value={lang} onChange={switchLang} allowed={langs ?? undefined} size="sm" />
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="sm"
                title="Reset to starter code"
                icon={<RotateCcw className="size-3.5" />}
                onClick={() => confirm("Reset to the starter code?") && setCode(templateFor(lang))}
              />
              <Button
                size="sm"
                onClick={run}
                disabled={busy}
                icon={state.kind === "running" && state.what === "run" ? <LoaderCircle className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
              >
                Run
              </Button>
              <Button
                size="sm"
                variant="accent"
                onClick={submit}
                disabled={busy}
                icon={state.kind === "running" && state.what === "submit" ? <LoaderCircle className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              >
                {submitLabel}
              </Button>
            </div>
            <Split
              direction="column"
              className="min-h-0 flex-1"
              storageKey="workspace-io"
              initial={0.62}
              min={0.25}
              max={0.85}
              first={
                <CodeEditor
                  key={lang}
                  value={code}
                  onChange={setCode}
                  mode={mode}
                  className="h-full"
                  onRunShortcut={run}
                  onSubmitShortcut={submit}
                  onPaste={onPaste}
                  onCopy={onCopy}
                />
              }
              second={
                <div className="flex h-full flex-col bg-panel">
                  <div className="flex h-9 shrink-0 items-center gap-1 border-b border-line px-2">
                    {tabs.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setPanel(t.id)}
                        className={cn(
                          "h-7 rounded-md px-2.5 text-xs font-medium",
                          panel === t.id ? "bg-panel-3 text-ink" : "text-ink-3 hover:text-ink",
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto p-3">
                    {panel === "results" && <ResultsPanel state={state} />}
                    {panel === "custom" && (
                      <div className="grid h-full gap-3 md:grid-cols-2">
                        <div className="flex min-h-[120px] flex-col">
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className="text-xs font-medium text-ink-3">Input</span>
                            <Button size="xs" onClick={runCustom} disabled={busy} icon={<Play className="size-3" />}>
                              Run
                            </Button>
                          </div>
                          <textarea
                            value={custom}
                            onChange={(e) => setCustom(e.target.value)}
                            spellCheck={false}
                            className="field min-h-0 flex-1 resize-none font-mono text-[12.5px]"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="mb-1.5 flex h-6 items-center justify-between">
                            <span className="text-xs font-medium text-ink-3">Output</span>
                            {state.kind === "custom" && <ExecMeta r={state.result} />}
                          </div>
                          {state.kind === "running" && state.what === "custom" ? (
                            <Spinner />
                          ) : state.kind === "custom" ? (
                            <ExecOutput r={state.result} />
                          ) : null}
                        </div>
                      </div>
                    )}
                    {panel === "history" && <History subs={subs} onLoad={loadSubmission} />}
                  </div>
                </div>
              }
            />
          </div>
        }
      />
    </div>
  );
}

function Spinner({ label = "Running" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-ink-3">
      <LoaderCircle className="size-3.5 animate-spin" /> {label}
    </div>
  );
}

function ResultsPanel({ state }: { state: RunState }) {
  if (state.kind === "idle") return <div className="text-sm text-ink-4">Run checks your code on the examples. Submit runs every test.</div>;
  if (state.kind === "running")
    return <Spinner label={state.what === "submit" ? "Judging" : "Running examples"} />;
  if (state.kind === "custom") return <div className="text-sm text-ink-4">See the Custom input tab.</div>;
  const o = state.outcome;
  const compile = o.verdict === "CE" ? o.compileOutput || o.details.find((d) => d.message)?.message : null;
  if (state.kind === "submitted") {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className={cn("text-lg font-semibold", o.verdict === "AC" ? "text-accent" : "text-red")}>{VERDICT[o.verdict]?.label}</span>
          <span className="num text-sm text-ink-2">
            {o.passed}/{o.total} tests
          </span>
          {o.timeMs !== null && (
            <span className="num flex items-center gap-1 text-sm text-ink-3">
              <Clock className="size-3.5" /> {o.timeMs} ms
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {o.details.map((d, i) => (
            <span
              key={i}
              title={`${d.sample ? "Example" : "Test"} ${i + 1}: ${VERDICT[d.verdict]?.label ?? d.verdict}`}
              className={cn(
                "num inline-flex h-6 min-w-6 items-center justify-center rounded px-1.5 font-mono text-[11px]",
                d.verdict === "AC" ? "bg-accent-soft text-accent-ink" : "bg-red-soft text-red",
              )}
            >
              {i + 1}
            </span>
          ))}
        </div>
        {compile && <pre className="overflow-x-auto rounded-md bg-red-soft p-2.5 font-mono text-[12px] whitespace-pre-wrap text-red">{compile}</pre>}
        <SampleDetails details={o.details.filter((d) => d.sample && d.verdict !== "AC")} />
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        {o.verdict === "AC" ? <CircleCheck className="size-4 text-accent" /> : <CircleX className="size-4 text-red" />}
        <span className="font-medium">
          {o.passed}/{o.total} examples passed
        </span>
      </div>
      {compile && <pre className="overflow-x-auto rounded-md bg-red-soft p-2.5 font-mono text-[12px] whitespace-pre-wrap text-red">{compile}</pre>}
      {!compile && <SampleDetails details={o.details} />}
    </div>
  );
}

function SampleDetails({ details }: { details: JudgeOutcome["details"] }) {
  if (!details.length) return null;
  return (
    <div className="space-y-2.5">
      {details.map((d, i) => (
        <div key={i} className="overflow-hidden rounded-md border border-line">
          <div className="flex h-8 items-center justify-between bg-panel-2 px-3 text-xs">
            <span className="font-medium text-ink-2">Example {i + 1}</span>
            <VerdictBadge v={d.verdict} />
          </div>
          <div className="grid gap-px bg-line md:grid-cols-3">
            {(
              [
                ["Input", d.input],
                ["Expected", d.expected],
                ["Your output", d.output],
              ] as const
            ).map(([label, text]) => (
              <div key={label} className="min-w-0 bg-panel">
                <div className="px-3 pt-2 text-[11px] font-medium text-ink-3">{label}</div>
                <pre className="max-h-40 overflow-auto px-3 pt-1 pb-2 font-mono text-[12px] leading-[1.55] whitespace-pre">{text || " "}</pre>
              </div>
            ))}
          </div>
          {d.message && <pre className="border-t border-line bg-red-soft px-3 py-2 font-mono text-[12px] whitespace-pre-wrap text-red">{d.message}</pre>}
        </div>
      ))}
    </div>
  );
}

function History({ subs, onLoad }: { subs: SubmissionSummary[]; onLoad: (id: string) => void }) {
  const byLang = useMemo(() => subs, [subs]);
  if (!subs.length) return <div className="text-sm text-ink-4">No submissions yet.</div>;
  return (
    <table className="table">
      <tbody>
        {byLang.map((s) => (
          <tr key={s.id} className="row-link" onClick={() => onLoad(s.id)}>
            <td>
              <VerdictBadge v={s.verdict} />
            </td>
            <td className="num text-ink-2">
              {s.passed}/{s.total}
            </td>
            <td className="text-ink-2">{getLanguage(s.language)?.label ?? s.language}</td>
            <td className="num text-ink-3">{s.timeMs !== null ? `${s.timeMs} ms` : ""}</td>
            <td className="text-right text-ink-3">{relativeTime(s.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export { CORE_LANGUAGES };
