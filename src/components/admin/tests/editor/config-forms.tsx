"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { Switch } from "@/components/ui/switch";
import { Field, ListEditor, NumberInput, Segmented, ToggleRow } from "./fields";

export type Cfg = Record<string, unknown>;
type FormProps = { config: Cfg; set: (patch: Cfg) => void };

const LETTERS = "ABCDEFGHIJKL";
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x ?? "")) : []);

function Choices({ config, set, multi }: FormProps & { multi?: boolean }) {
  const options = arr(config.options);
  const answers = multi ? ((config.answers as number[]) ?? []) : [config.answer as number];
  const toggle = (i: number) => {
    if (!multi) return set({ answer: i });
    const s = new Set(answers);
    if (s.has(i)) s.delete(i);
    else s.add(i);
    set({ answers: [...s].sort((a, b) => a - b) });
  };
  return (
    <>
      <Field label="Choices" hint={multi ? "Tick every correct choice." : "Tick the correct choice."}>
        <ListEditor
          items={options}
          min={2}
          addLabel="Add choice"
          placeholder={(i) => `Choice ${LETTERS[i]}`}
          onChange={(next, moved) => {
            // Keep the marked answers on the same rows when rows move or go away.
            if (multi) set({ options: next, answers: answers.map(moved).filter((x) => x >= 0) });
            else set({ options: next, answer: Math.max(0, moved((config.answer as number) ?? 0)) });
          }}
          marker={(i) => (
            <button
              type="button"
              onClick={() => toggle(i)}
              aria-label={`Mark ${LETTERS[i]} correct`}
              className={cn(
                "flex size-6 items-center justify-center rounded-md border font-mono text-xs",
                answers.includes(i) ? "border-accent bg-accent text-white" : "border-line-2 text-ink-3 hover:border-ink-3",
              )}
            >
              {answers.includes(i) ? <Check className="size-3.5" /> : LETTERS[i]}
            </button>
          )}
        />
      </Field>
      <ToggleRow label="Shuffle choices" hint="Each student sees them in a different order." checked={Boolean(config.shuffle)} onChange={(v) => set({ shuffle: v })} />
      {multi && (
        <ToggleRow
          label="Partial credit"
          hint="Right picks minus wrong picks, as a share of the correct ones."
          checked={config.partial !== false}
          onChange={(v) => set({ partial: v })}
        />
      )}
    </>
  );
}

function ShortForm({ config, set }: FormProps) {
  return (
    <>
      <Field label="Accepted answers" hint="Any one of these is marked right. Spacing and case are ignored unless you turn on case.">
        <ListEditor items={arr(config.accept)} onChange={(v) => set({ accept: v })} addLabel="Add answer" placeholder={() => "Answer"} />
      </Field>
      <Field label="Compare as">
        <Segmented
          value={(config.mode as "text" | "list" | "regex") ?? "text"}
          onChange={(v) => set({ mode: v })}
          options={[
            ["text", "Text"],
            ["list", "List of values"],
            ["regex", "Pattern"],
          ]}
        />
      </Field>
      <ToggleRow label="Case sensitive" checked={Boolean(config.caseSensitive)} onChange={(v) => set({ caseSensitive: v })} />
    </>
  );
}

function NumericForm({ config, set }: FormProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Answer">
        <NumberInput value={(config.answer as number) ?? null} onChange={(v) => set({ answer: v ?? undefined })} step="any" />
      </Field>
      <Field label="Allowed error" hint="0 for exact">
        <NumberInput value={(config.tolerance as number) ?? 0} onChange={(v) => set({ tolerance: v ?? 0 })} min={0} step={0.0001} />
      </Field>
      <Field label="Unit">
        <input value={(config.unit as string) ?? ""} onChange={(e) => set({ unit: e.target.value || undefined })} className="field" placeholder="ms" />
      </Field>
    </div>
  );
}

function OrderForm({ config, set }: FormProps) {
  return (
    <>
      <Field label="Items in the correct order" hint="Students see them shuffled.">
        <ListEditor items={arr(config.items)} min={2} onChange={(v) => set({ items: v })} addLabel="Add item" marker={(i) => <span className="num font-mono text-xs text-ink-4">{i + 1}</span>} />
      </Field>
      <ToggleRow label="Partial credit" hint="Credit for each pair of items in the right relative order." checked={config.partial !== false} onChange={(v) => set({ partial: v })} />
    </>
  );
}

function MatchForm({ config, set }: FormProps) {
  const left = arr(config.left);
  const right = arr(config.right);
  const answer = (config.answer as number[]) ?? left.map((_, i) => i);
  const pairs = left.map((l, i) => ({ l, r: right[answer[i]] ?? "" }));
  const used = new Set(answer);
  const extras = right.filter((_, i) => !used.has(i));
  const write = (ps: { l: string; r: string }[], ex: string[]) =>
    set({ left: ps.map((p) => p.l), right: [...ps.map((p) => p.r), ...ex], answer: ps.map((_, i) => i) });
  return (
    <>
      <Field label="Pairs" hint="The right side is shuffled for each student.">
        <div className="space-y-1.5">
          {pairs.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={p.l} onChange={(e) => write(pairs.map((x, j) => (j === i ? { ...x, l: e.target.value } : x)), extras)} className="field field-sm flex-1" placeholder="Left" />
              <span className="text-ink-4">→</span>
              <input value={p.r} onChange={(e) => write(pairs.map((x, j) => (j === i ? { ...x, r: e.target.value } : x)), extras)} className="field field-sm flex-1" placeholder="Right" />
              <button type="button" onClick={() => write(pairs.filter((_, j) => j !== i), extras)} className="px-1 text-xs text-ink-4 hover:text-red" aria-label="Remove pair">
                Remove
              </button>
            </div>
          ))}
          <button type="button" onClick={() => write([...pairs, { l: "", r: "" }], extras)} className="h-7 rounded-md px-1.5 text-sm text-ink-3 hover:bg-panel-3 hover:text-ink">
            + Add pair
          </button>
        </div>
      </Field>
      <Field label="Extra choices on the right" hint="Optional decoys that match nothing.">
        <ListEditor items={extras} onChange={(ex) => write(pairs, ex)} addLabel="Add decoy" />
      </Field>
    </>
  );
}

function TextForm({ config, set }: FormProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
      <Field label="Placeholder">
        <input value={(config.placeholder as string) ?? ""} onChange={(e) => set({ placeholder: e.target.value || undefined })} className="field" />
      </Field>
      <Field label="Max characters">
        <NumberInput value={(config.maxChars as number) ?? 3000} onChange={(v) => set({ maxChars: v ?? 3000 })} min={50} max={20000} />
      </Field>
    </div>
  );
}

export type ProblemOption = { id: string; title: string; difficulty: string };

function CodeForm({ config, set, problemId, setProblem, problems }: FormProps & { problemId: string | null; setProblem: (id: string | null) => void; problems: ProblemOption[] }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => problems.filter((p) => p.title.toLowerCase().includes(q.toLowerCase())), [problems, q]);
  const picked = problems.find((p) => p.id === problemId);
  return (
    <>
      <Field label="Problem" hint="Students solve it in the editor. Hidden tests decide the score.">
        <div className="overflow-hidden rounded-md border border-line">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={picked ? picked.title : "Search problems"} className="w-full border-b border-line bg-panel-2 px-3 py-2 text-sm outline-none" />
          <div className="max-h-56 overflow-y-auto">
            {list.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => setProblem(p.id)}
                className={cn("flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-panel-2", p.id === problemId && "bg-blue-soft/60 font-medium")}
              >
                <span>{p.title}</span>
                <span className="text-xs text-ink-4 capitalize">{p.difficulty}</span>
              </button>
            ))}
            {list.length === 0 && <div className="px-3 py-3 text-sm text-ink-3">No problems match.</div>}
          </div>
        </div>
      </Field>
      <ToggleRow label="Partial credit" hint="Score is the share of hidden tests passed." checked={config.partial !== false} onChange={(v) => set({ partial: v })} />
    </>
  );
}

/* ---------------------------------------------------------------- widgets */

type Opt = { key: string; label: string; kind: "select" | "number"; options?: [string, string][]; min?: number; max?: number; def: string | number };

export const WIDGET_OPTIONS: Record<string, Opt[]> = {
  "tock-trace": [
    {
      key: "kind",
      label: "Program",
      kind: "select",
      def: "range-sum",
      options: [
        ["range-sum", "Loop over a range"],
        ["index", "List positions"],
        ["pipe", "Pipes"],
        ["while", "While loop"],
        ["fold", "Fold"],
      ],
    },
  ],
  "tock-write": [
    {
      key: "task",
      label: "Task",
      kind: "select",
      def: "has7",
      options: [
        ["has7", "Count numbers containing a 7"],
        ["steps", "Steps to reach 1"],
        ["pairs", "Pairs with a sum divisible by 3"],
      ],
    },
    { key: "tests", label: "Hidden tests", kind: "number", min: 1, max: 10, def: 5 },
  ],
  terminal: [
    {
      key: "ask",
      label: "Question",
      kind: "select",
      def: "most-failed",
      options: [
        ["most-failed", "User with the most failed logins"],
        ["door-code", "Door code from the notes"],
        ["archive", "Word hidden in the archive"],
      ],
    },
  ],
  scale: [
    { key: "coins", label: "Coins", kind: "number", min: 3, max: 27, def: 9 },
    { key: "weighings", label: "Weighings", kind: "number", min: 1, max: 4, def: 2 },
  ],
  lock: [
    { key: "digits", label: "Digits", kind: "number", min: 3, max: 6, def: 4 },
    { key: "maxGuesses", label: "Tries", kind: "number", min: 3, max: 15, def: 8 },
  ],
  rail: [{ key: "cars", label: "Cars", kind: "number", min: 4, max: 9, def: 6 }],
};

function WidgetForm({ config, set }: FormProps) {
  const opts = WIDGET_OPTIONS[String(config.widget)] ?? [];
  if (!opts.length) return <div className="text-sm text-ink-3">This question builds a new version for every student. It has no settings.</div>;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {opts.map((o) => (
        <Field key={o.key} label={o.label}>
          {o.kind === "select" ? (
            <select value={String(config[o.key] ?? o.def)} onChange={(e) => set({ [o.key]: e.target.value })} className="field">
              {o.options!.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          ) : (
            <NumberInput value={(config[o.key] as number) ?? (o.def as number)} onChange={(v) => set({ [o.key]: v ?? o.def })} min={o.min} max={o.max} />
          )}
        </Field>
      ))}
    </div>
  );
}

export function ConfigForm({
  type,
  config,
  set,
  problemId,
  setProblem,
  problems,
}: FormProps & { type: string; problemId: string | null; setProblem: (id: string | null) => void; problems: ProblemOption[] }) {
  switch (type) {
    case "mcq":
      return <Choices config={config} set={set} />;
    case "multi":
      return <Choices config={config} set={set} multi />;
    case "short":
      return <ShortForm config={config} set={set} />;
    case "numeric":
      return <NumericForm config={config} set={set} />;
    case "order":
      return <OrderForm config={config} set={set} />;
    case "match":
      return <MatchForm config={config} set={set} />;
    case "text":
      return <TextForm config={config} set={set} />;
    case "code":
      return <CodeForm config={config} set={set} problemId={problemId} setProblem={setProblem} problems={problems} />;
    case "widget":
      return <WidgetForm config={config} set={set} />;
    default:
      return null;
  }
}

/** Raw JSON for everything the forms don't cover, such as per-student variants. */
export function JsonConfig({ config, onChange }: { config: Cfg; onChange: (c: Cfg) => void }) {
  const [text, setText] = useState(() => JSON.stringify(config, null, 2));
  const [err, setErr] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const shown = focused ? text : JSON.stringify(config, null, 2);
  return (
    <div>
      <textarea
        value={shown}
        onFocus={() => {
          setText(JSON.stringify(config, null, 2));
          setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setText(e.target.value);
          try {
            const v = JSON.parse(e.target.value);
            if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Must be an object");
            setErr(null);
            onChange(v);
          } catch (x) {
            setErr((x as Error).message);
          }
        }}
        rows={8}
        spellCheck={false}
        className="field resize-y font-mono text-[12.5px] leading-relaxed"
      />
      {err ? <div className="hint text-red">{err}</div> : <div className="hint">Add &quot;variants&quot; to give students different numbers, then use {"{{name}}"} in the prompt.</div>}
    </div>
  );
}

export function SwitchInline({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <Switch checked={checked} onChange={onChange} label={label} />
      {label}
    </label>
  );
}
