"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, ArrowUp, ArrowDown, ExternalLink, Wand2, ClipboardPaste, Sparkles, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { CodeEditor } from "@/components/editor/code-editor";
import { LanguagePicker } from "@/components/editor/language-picker";
import { cn } from "@/lib/cn";
import { getLanguage, CORE_LANGUAGES } from "@/lib/runner/languages";
import { saveProblem, deleteProblem, previewMarkdown, generateOutputs, type ProblemInput } from "@/lib/admin/problems";

type Test = ProblemInput["tests"][number] & { key: string };
type Tab = "statement" | "tests" | "starter" | "settings";

let keySeq = 0;
const k = () => `t${++keySeq}`;

export function ProblemEditor({ initial, aiAvailable }: { initial: ProblemInput; aiAvailable: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [p, setP] = useState<ProblemInput>(initial);
  const [tests, setTests] = useState<Test[]>(() => initial.tests.map((t) => ({ ...t, key: k() })));
  const [tab, setTab] = useState<Tab>("statement");
  const [preview, setPreview] = useState("");
  const [saving, startSave] = useTransition();
  const [dirty, setDirty] = useState(false);
  const [refOpen, setRefOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const set = <K extends keyof ProblemInput>(key: K, v: ProblemInput[K]) => {
    setP((x) => ({ ...x, [key]: v }));
    setDirty(true);
  };
  const setTest = (i: number, patch: Partial<Test>) => {
    setTests((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)));
    setDirty(true);
  };

  useEffect(() => {
    const t = setTimeout(() => previewMarkdown(p.statement).then(setPreview), 250);
    return () => clearTimeout(t);
  }, [p.statement]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = () =>
    startSave(async () => {
      const r = await saveProblem({ ...p, tests: tests.map(({ key: _key, ...t }) => t) });
      if (!r.ok) return toast(r.error, "error");
      setDirty(false);
      toast("Saved");
      if (!p.id && r.data) router.replace(`/admin/problems/${r.data.id}`);
      else router.refresh();
      if (r.data) setP((x) => ({ ...x, id: r.data!.id, slug: r.data!.slug }));
    });

  const samples = tests.filter((t) => t.sample).length;
  const tabs: { id: Tab; label: string }[] = [
    { id: "statement", label: "Statement" },
    { id: "tests", label: `Tests · ${tests.length}` },
    { id: "starter", label: "Starter code" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="pb-16">
      <div className="sticky top-0 z-30 -mx-4 mb-5 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8 lg:top-0">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs text-ink-3">
              <Link href="/admin/problems" className="hover:text-ink">
                Problems
              </Link>{" "}
              / {p.id ? "Edit" : "New"}
            </div>
            <div className="truncate text-lg font-semibold">{p.title || "Untitled problem"}</div>
          </div>
          {aiAvailable && (
            <Button icon={<Sparkles className="size-4" />} onClick={() => setAiOpen(true)}>
              Draft with Claude
            </Button>
          )}
          {p.id && (
            <Link
              href={`/problems/${p.slug}`}
              target="_blank"
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm text-ink-2 hover:bg-panel-3"
            >
              <ExternalLink className="size-3.5" /> Open
            </Link>
          )}
          <Button variant="primary" onClick={save} disabled={saving} icon={<Save className="size-4" />}>
            {saving ? "Saving…" : dirty ? "Save" : "Saved"}
          </Button>
        </div>
        <div className="mt-3 flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "h-7 rounded-md px-2.5 text-sm",
                tab === t.id ? "bg-panel-3 font-medium text-ink" : "text-ink-3 hover:text-ink",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "statement" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_200px_160px]">
            <div>
              <label className="label">Title</label>
              <input value={p.title} onChange={(e) => set("title", e.target.value)} className="field" placeholder="Running Total" />
            </div>
            <div>
              <label className="label">Topics</label>
              <input
                value={p.tags.join(", ")}
                onChange={(e) => set("tags", e.target.value.split(",").map((s) => s.trimStart()))}
                className="field"
                placeholder="arrays, greedy"
              />
            </div>
            <div>
              <label className="label">Difficulty</label>
              <select value={p.difficulty} onChange={(e) => set("difficulty", e.target.value as ProblemInput["difficulty"])} className="field">
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="label">Statement</label>
              <textarea
                value={p.statement}
                onChange={(e) => set("statement", e.target.value)}
                className="field min-h-[480px] resize-y font-mono text-[13px] leading-6"
                placeholder={"Describe the task.\n\n## Input\n...\n\n## Output\n..."}
              />
              <div className="hint">Markdown. Use ## Input and ## Output sections. Examples come from sample tests.</div>
            </div>
            <div>
              <div className="label">Preview</div>
              <div className="card min-h-[480px] p-5">
                <div className="prose" dangerouslySetInnerHTML={{ __html: preview }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "tests" && (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="text-sm text-ink-3">
              {samples} shown as examples, {tests.length - samples} hidden
            </div>
            <div className="flex-1" />
            <Button size="sm" icon={<ClipboardPaste className="size-3.5" />} onClick={() => setBulkOpen(true)}>
              Paste many
            </Button>
            <Button size="sm" icon={<Wand2 className="size-3.5" />} onClick={() => setRefOpen(true)} disabled={!tests.length}>
              Fill outputs from solution
            </Button>
            <Button
              size="sm"
              variant="primary"
              icon={<Plus className="size-3.5" />}
              onClick={() => {
                setTests((ts) => [...ts, { key: k(), input: "", output: "", sample: ts.length === 0 }]);
                setDirty(true);
              }}
            >
              Add test
            </Button>
          </div>
          <div className="space-y-3">
            {tests.map((t, i) => (
              <TestCard
                key={t.key}
                index={i}
                test={t}
                onChange={(patch) => setTest(i, patch)}
                onMove={(dir) => {
                  setTests((ts) => {
                    const n = [...ts];
                    const j = i + dir;
                    if (j < 0 || j >= n.length) return ts;
                    [n[i], n[j]] = [n[j], n[i]];
                    return n;
                  });
                  setDirty(true);
                }}
                onRemove={() => {
                  setTests((ts) => ts.filter((_, j) => j !== i));
                  setDirty(true);
                }}
              />
            ))}
            {tests.length === 0 && <div className="card p-8 text-center text-sm text-ink-3">No tests yet.</div>}
          </div>
        </div>
      )}

      {tab === "starter" && <StarterTab starter={p.starter} onChange={(s) => set("starter", s)} />}

      {tab === "settings" && (
        <div className="card max-w-xl divide-y divide-line">
          <Row label="URL">
            <div className="flex items-center gap-1 text-sm text-ink-3">
              /problems/
              <input value={p.slug} onChange={(e) => set("slug", e.target.value)} className="field field-sm w-56 font-mono" placeholder="auto" />
            </div>
          </Row>
          <Row label="Time limit" hint="Python gets 3×, Java and JavaScript 2×.">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={250}
                step={250}
                value={p.timeLimitMs}
                onChange={(e) => set("timeLimitMs", Number(e.target.value))}
                className="field field-sm w-28"
              />
              <span className="text-sm text-ink-3">ms</span>
            </div>
          </Row>
          <Row label="Memory">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={16}
                value={p.memoryLimitMb}
                onChange={(e) => set("memoryLimitMb", Number(e.target.value))}
                className="field field-sm w-28"
              />
              <span className="text-sm text-ink-3">MB</span>
            </div>
          </Row>
          <Row label="Output check">
            <select value={p.checker} onChange={(e) => set("checker", e.target.value as ProblemInput["checker"])} className="field field-sm w-56">
              <option value="tokens">Tokens (ignore spacing)</option>
              <option value="lines">Lines (trim line ends)</option>
              <option value="exact">Exact</option>
              <option value="float">Numbers within 1e-6</option>
            </select>
          </Row>
          <Row label="Visible in practice" hint="Off keeps it for tests only.">
            <Switch checked={p.published} onChange={(v) => set("published", v)} />
          </Row>
          {p.id && (
            <Row label="Delete">
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 className="size-3.5" />}
                onClick={async () => {
                  if (!confirm("Delete this problem and its submissions?")) return;
                  await deleteProblem(p.id!);
                  router.push("/admin/problems");
                }}
              >
                Delete problem
              </Button>
            </Row>
          )}
        </div>
      )}

      <ReferenceDialog
        open={refOpen}
        onClose={() => setRefOpen(false)}
        inputs={tests.map((t) => t.input)}
        timeLimitMs={p.timeLimitMs}
        onOutputs={(outs) => {
          setTests((ts) => ts.map((t, i) => ({ ...t, output: outs[i] ?? t.output })));
          setDirty(true);
        }}
      />
      <BulkDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onAdd={(added) => {
          setTests((ts) => [...ts, ...added.map((t) => ({ ...t, key: k() }))]);
          setDirty(true);
        }}
      />
      {aiAvailable && (
        <AiDraftDialog
          open={aiOpen}
          onClose={() => setAiOpen(false)}
          onDraft={(draft) => {
            setP((x) => ({
              ...x,
              title: draft.title,
              statement: draft.statement,
              difficulty: draft.difficulty,
              tags: draft.tags,
            }));
            setTests(draft.tests.map((t) => ({ ...t, key: k() })));
            setDirty(true);
            setTab("statement");
          }}
        />
      )}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-ink-3">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function TestCard({
  index,
  test,
  onChange,
  onMove,
  onRemove,
}: {
  index: number;
  test: Test;
  onChange: (p: Partial<Test>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const big = test.input.length + test.output.length > 20000;
  const [expanded, setExpanded] = useState(!big);
  return (
    <div className="card">
      <div className="flex h-10 items-center gap-3 border-b border-line px-3">
        <span className="num font-mono text-xs text-ink-3">#{index + 1}</span>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={test.sample} onChange={(e) => onChange({ sample: e.target.checked })} className="accent-[var(--ink)]" />
          Example
        </label>
        {big && (
          <span className="text-xs text-ink-3">
            {(test.input.length / 1024).toFixed(0)} KB in · {(test.output.length / 1024).toFixed(0)} KB out
          </span>
        )}
        <div className="flex-1" />
        {big && (
          <Button size="xs" variant="ghost" onClick={() => setExpanded((e) => !e)}>
            {expanded ? "Collapse" : "Edit"}
          </Button>
        )}
        <button onClick={() => onMove(-1)} className="rounded p-1 text-ink-4 hover:bg-panel-3 hover:text-ink" aria-label="Move up">
          <ArrowUp className="size-3.5" />
        </button>
        <button onClick={() => onMove(1)} className="rounded p-1 text-ink-4 hover:bg-panel-3 hover:text-ink" aria-label="Move down">
          <ArrowDown className="size-3.5" />
        </button>
        <button onClick={onRemove} className="rounded p-1 text-ink-4 hover:bg-red-soft hover:text-red" aria-label="Remove">
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {expanded && (
        <div className="grid gap-px bg-line md:grid-cols-2">
          {(["input", "output"] as const).map((f) => (
            <div key={f} className="bg-panel p-2">
              <div className="mb-1 px-1 text-xs text-ink-3">{f === "input" ? "Input" : "Expected output"}</div>
              <textarea
                value={test[f]}
                onChange={(e) => onChange({ [f]: e.target.value })}
                spellCheck={false}
                rows={Math.min(12, Math.max(3, test[f].split("\n").length))}
                className="w-full resize-y rounded-md bg-panel-2 px-2 py-1.5 font-mono text-[12.5px] leading-[1.55] outline-none focus:ring-2 focus:ring-blue-soft"
              />
            </div>
          ))}
        </div>
      )}
      {test.sample && expanded && (
        <div className="border-t border-line px-3 py-2">
          <input
            value={test.explanation ?? ""}
            onChange={(e) => onChange({ explanation: e.target.value })}
            placeholder="Optional explanation shown under the example"
            className="field field-sm"
          />
        </div>
      )}
    </div>
  );
}

function StarterTab({ starter, onChange }: { starter: Record<string, string>; onChange: (s: Record<string, string>) => void }) {
  const [lang, setLang] = useState("python");
  const value = starter[lang] ?? "";
  const custom = useMemo(() => Object.keys(starter).filter((l) => starter[l]?.trim()), [starter]);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <LanguagePicker value={lang} onChange={setLang} />
        <span className="text-sm text-ink-3">
          {value.trim() ? "Custom starter" : "Using the default template"}
          {custom.length > 0 && ` · custom for ${custom.map((l) => getLanguage(l)?.label).join(", ")}`}
        </span>
        <div className="flex-1" />
        {!value.trim() && (
          <Button size="sm" onClick={() => onChange({ ...starter, [lang]: getLanguage(lang)?.template ?? "" })}>
            Start from template
          </Button>
        )}
        {value.trim() && (
          <Button size="sm" variant="ghost" onClick={() => onChange({ ...starter, [lang]: "" })}>
            Clear
          </Button>
        )}
      </div>
      <div className="card h-[460px] overflow-hidden">
        <CodeEditor
          key={lang}
          value={value}
          onChange={(v) => onChange({ ...starter, [lang]: v })}
          mode={getLanguage(lang)?.mode ?? "text"}
          className="h-full"
          placeholder={getLanguage(lang)?.template.split("\n")[0]}
        />
      </div>
      <div className="hint">Shown to members when they open the problem in this language. {CORE_LANGUAGES.length} core languages are listed first.</div>
    </div>
  );
}

function ReferenceDialog({
  open,
  onClose,
  inputs,
  timeLimitMs,
  onOutputs,
}: {
  open: boolean;
  onClose: () => void;
  inputs: string[];
  timeLimitMs: number;
  onOutputs: (o: string[]) => void;
}) {
  const toast = useToast();
  const [lang, setLang] = useState("python");
  const [code, setCode] = useState("");
  const [pending, start] = useTransition();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Fill outputs from a reference solution"
      width={720}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await generateOutputs(lang, code, inputs, timeLimitMs);
                if (!r.ok) return toast(r.error, "error");
                const errs = r.data!.errors.map((e, i) => (e ? `#${i + 1} ${e}` : null)).filter(Boolean);
                if (errs.length) return toast(`Solution failed on ${errs.length} test(s). ${errs[0]}`, "error");
                onOutputs(r.data!.outputs);
                toast(`Filled ${inputs.length} outputs`);
                onClose();
              })
            }
          >
            {pending ? "Running…" : `Run on ${inputs.length} inputs`}
          </Button>
        </>
      }
    >
      <div className="mb-2">
        <LanguagePicker value={lang} onChange={setLang} />
      </div>
      <div className="h-[340px] overflow-hidden rounded-md border border-line">
        <CodeEditor value={code} onChange={setCode} mode={getLanguage(lang)?.mode} className="h-full" placeholder="Paste a correct solution" />
      </div>
      <div className="hint">Every expected output is replaced with what this program prints.</div>
    </Dialog>
  );
}

function BulkDialog({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (t: ProblemInput["tests"]) => void }) {
  const [text, setText] = useState("");
  const parsed = useMemo(() => {
    return text
      .split(/^={3,}\s*$/m)
      .map((block) => block.replace(/^\n+|\n+$/g, ""))
      .filter((b) => b.trim())
      .map((block) => {
        const [input, output = ""] = block.split(/^-{3,}\s*$/m);
        return { input: input.replace(/^\n+/, "").replace(/\n*$/, "\n"), output: output.replace(/^\n+/, "").replace(/\n*$/, "\n"), sample: false };
      });
  }, [text]);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Paste many tests"
      width={640}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!parsed.length}
            onClick={() => {
              onAdd(parsed);
              setText("");
              onClose();
            }}
          >
            Add {parsed.length} test{parsed.length === 1 ? "" : "s"}
          </Button>
        </>
      }
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={14}
        className="field resize-y font-mono text-[12.5px] leading-6"
        placeholder={"3\n1 2 3\n---\n6\n===\n2\n5 5\n---\n10"}
      />
      <div className="hint">Separate input and output with a line of ---. Separate tests with a line of ===. Leave outputs empty to fill them from a solution.</div>
    </Dialog>
  );
}

type Draft = {
  title: string;
  statement: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  tests: ProblemInput["tests"];
};

function AiDraftDialog({ open, onClose, onDraft }: { open: boolean; onClose: () => void; onDraft: (d: Draft) => void }) {
  const toast = useToast();
  const [idea, setIdea] = useState("");
  const [difficulty, setDifficulty] = useState<Draft["difficulty"]>("easy");
  const [pending, start] = useTransition();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Draft a problem with Claude"
      width={560}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={pending || !idea.trim()}
            icon={<Sparkles className="size-4" />}
            onClick={() =>
              start(async () => {
                const res = await fetch("/api/ai/draft-problem", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ idea, difficulty }),
                });
                const j = await res.json();
                if (!res.ok) return toast(j.error ?? "Draft failed", "error");
                onDraft(j);
                toast("Draft ready. Review the statement and tests before saving.");
                onClose();
              })
            }
          >
            {pending ? "Drafting… (about 30 s)" : "Draft"}
          </Button>
        </>
      }
    >
      <label className="label">Idea</label>
      <textarea
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        rows={5}
        className="field resize-y"
        placeholder="Count how many times a robot crosses its own path on a grid walk"
      />
      <div className="mt-3">
        <label className="label">Difficulty</label>
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Draft["difficulty"])} className="field w-48">
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>
      <div className="hint mt-3">
        Claude writes the statement, a reference solution and test inputs. The solution runs on the judge to produce expected outputs.
      </div>
    </Dialog>
  );
}
