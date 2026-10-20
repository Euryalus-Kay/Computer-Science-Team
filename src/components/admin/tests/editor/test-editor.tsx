"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Settings2,
  Plus,
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  ListChecks,
  ListTodo,
  TextCursorInput,
  Hash,
  ArrowDownUp,
  Shuffle,
  PenLine,
  CodeXml,
  Puzzle,
  Sparkles,
  RotateCw,
  TriangleAlert,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem } from "@/components/ui/menu";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { pts } from "@/lib/format";
import { saveTest, draftRubric, regradeTest, type ItemInput, type TestSettings } from "@/lib/admin/tests";
import { WIDGET_LABELS } from "@/lib/items/widgets/labels";
import { INTRO_ITEMS } from "@/content/test-items";
import { ConfigForm, JsonConfig, WIDGET_OPTIONS, type ProblemOption } from "./config-forms";
import { SettingsPanel, type GroupOption, type Person } from "./settings-panel";
import { Field, MarkdownField, NumberInput, Segmented, IconBtn } from "./fields";

type Draft = ItemInput & { key: string };

const TYPES: { type: string; label: string; icon: typeof ListChecks }[] = [
  { type: "mcq", label: "Multiple choice", icon: ListChecks },
  { type: "multi", label: "Checkboxes", icon: ListTodo },
  { type: "short", label: "Short answer", icon: TextCursorInput },
  { type: "numeric", label: "Number", icon: Hash },
  { type: "order", label: "Put in order", icon: ArrowDownUp },
  { type: "match", label: "Match pairs", icon: Shuffle },
  { type: "text", label: "Written answer", icon: PenLine },
  { type: "code", label: "Code problem", icon: CodeXml },
  { type: "widget", label: "Interactive", icon: Puzzle },
];
const TYPE = Object.fromEntries(TYPES.map((t) => [t.type, t]));

let seq = 0;
const key = () => `k${++seq}`;

function blank(type: string, widget?: string): ItemInput {
  const base = { id: null, section: null, title: "", prompt: "", points: 1, grading: "auto" as const, rubric: null, problemId: null };
  switch (type) {
    case "mcq":
      return { ...base, type, config: { options: ["", "", "", ""], answer: 0, shuffle: true } };
    case "multi":
      return { ...base, type, config: { options: ["", "", "", ""], answers: [], shuffle: true, partial: true } };
    case "short":
      return { ...base, type, config: { accept: [""], mode: "text" } };
    case "numeric":
      return { ...base, type, config: { tolerance: 0 } };
    case "order":
      return { ...base, type, config: { items: ["", "", ""], partial: true } };
    case "match":
      return { ...base, type, config: { left: ["", ""], right: ["", ""], answer: [0, 1] } };
    case "text":
      return { ...base, type, points: 3, grading: "ai", config: { maxChars: 3000 } };
    case "code":
      return { ...base, type, points: 10, config: { partial: true } };
    case "widget": {
      const w = widget ?? "figures";
      const sample = INTRO_ITEMS.find((i) => (i.config as { widget?: string })?.widget === w);
      const defaults = Object.fromEntries((WIDGET_OPTIONS[w] ?? []).map((o) => [o.key, o.def]));
      return {
        ...base,
        type,
        title: sample?.title ?? WIDGET_LABELS[w] ?? "",
        prompt: sample?.prompt ?? "",
        points: sample?.points ?? 2,
        config: { ...defaults, ...(sample?.config ?? {}), widget: w },
      };
    }
    default:
      return { ...base, type, config: {} };
  }
}

export function TestEditor({
  id,
  initial,
  items: initialItems,
  problems,
  groups,
  people,
  attemptCount,
  aiReady,
}: {
  id: string;
  initial: TestSettings;
  items: ItemInput[];
  problems: ProblemOption[];
  groups: GroupOption[];
  people: Person[];
  attemptCount: number;
  aiReady: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [settings, setSettings] = useState(initial);
  const [items, setItems] = useState<Draft[]>(() => initialItems.map((i) => ({ ...i, key: key() })));
  const [sel, setSel] = useState<string>("settings");
  const [dirty, setDirty] = useState(false);
  const [saving, startSave] = useTransition();
  const [regrading, startRegrade] = useTransition();

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Cmd/Ctrl+S saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const setS = (patch: Partial<TestSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    setDirty(true);
  };
  const setItem = (k: string, patch: Partial<Draft>) => {
    setItems((list) => list.map((i) => (i.key === k ? { ...i, ...patch } : i)));
    setDirty(true);
  };
  const add = (type: string, widget?: string) => {
    const at = items.findIndex((i) => i.key === sel);
    const section = at >= 0 ? items[at].section : (items[items.length - 1]?.section ?? null);
    const d: Draft = { ...blank(type, widget), section, key: key() };
    setItems((list) => (at >= 0 ? [...list.slice(0, at + 1), d, ...list.slice(at + 1)] : [...list, d]));
    setSel(d.key);
    setDirty(true);
  };
  const move = (k: string, dir: -1 | 1) => {
    setItems((list) => {
      const i = list.findIndex((x) => x.key === k);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const n = [...list];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
    setDirty(true);
  };
  const duplicate = (k: string) => {
    const i = items.findIndex((x) => x.key === k);
    if (i < 0) return;
    const d: Draft = { ...structuredClone(items[i]), id: null, key: key(), title: items[i].title ? `${items[i].title} (copy)` : "" };
    setItems((list) => [...list.slice(0, i + 1), d, ...list.slice(i + 1)]);
    setSel(d.key);
    setDirty(true);
  };
  const remove = (k: string) => {
    const i = items.findIndex((x) => x.key === k);
    setItems((list) => list.filter((x) => x.key !== k));
    setSel(items[i + 1]?.key ?? items[i - 1]?.key ?? "settings");
    setDirty(true);
  };

  function save() {
    startSave(async () => {
      const r = await saveTest(
        id,
        settings,
        items.map(({ key: _k, ...rest }) => rest),
      );
      if (!r.ok) {
        toast(r.error, "error");
        const m = r.error.match(/^Question (\d+)/);
        if (m) setSel(items[Number(m[1]) - 1]?.key ?? sel);
        return;
      }
      const ids = r.data?.ids ?? [];
      setItems((list) => list.map((it, i) => ({ ...it, id: ids[i] ?? it.id })));
      if (r.data?.slug) setSettings((s) => ({ ...s, slug: r.data!.slug }));
      setDirty(false);
      toast("Saved");
      router.refresh();
    });
  }

  const total = items.reduce((s, i) => s + (Number(i.points) || 0), 0);
  const current = items.find((i) => i.key === sel) ?? null;
  const sections = useMemo(() => [...new Set(items.map((i) => i.section).filter(Boolean) as string[])], [items]);

  return (
    <div>
      <div className="sticky top-0 z-30 -mx-4 mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-bg/90 px-4 py-2.5 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="flex items-center gap-3 text-sm">
          <Segmented
            value={settings.status}
            onChange={(v) => setS({ status: v })}
            options={[
              ["draft", "Draft"],
              ["published", "Published"],
            ]}
          />
          <span className="text-ink-3">
            {items.length} questions · {pts(total)} points
          </span>
        </div>
        <div className="flex items-center gap-3">
          {dirty && <span className="text-xs text-ink-3">Unsaved changes</span>}
          <Button variant="primary" onClick={save} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {attemptCount > 0 && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber/30 bg-amber-soft px-4 py-2.5 text-sm">
          <span className="flex items-center gap-2 text-amber">
            <TriangleAlert className="size-4 shrink-0" />
            {attemptCount} {attemptCount === 1 ? "person has" : "people have"} taken this test. Fixed an answer key? Save, then regrade.
          </span>
          <Button
            size="sm"
            icon={<RotateCw className="size-3.5" />}
            disabled={regrading || dirty}
            onClick={() =>
              startRegrade(async () => {
                const r = await regradeTest(id);
                toast(r.ok ? `Regraded ${r.data?.attempts ?? 0} attempts` : r.error, r.ok ? "default" : "error");
                router.refresh();
              })
            }
          >
            Regrade
          </Button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-[68px] lg:max-h-[calc(100dvh-88px)] lg:self-start lg:overflow-y-auto">
          <div className="card p-1.5">
            <button
              onClick={() => setSel("settings")}
              className={cn("flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-sm", sel === "settings" ? "bg-panel-3 font-medium" : "text-ink-2 hover:bg-panel-2")}
            >
              <Settings2 className="size-4 text-ink-3" /> Settings
            </button>
            <div className="my-1.5 h-px bg-line" />
            {items.length === 0 && <div className="px-2.5 py-3 text-sm text-ink-3">No questions yet.</div>}
            {items.map((it, i) => {
              const showSection = it.section && it.section !== items[i - 1]?.section;
              const T = TYPE[it.type];
              return (
                <div key={it.key}>
                  {showSection && <div className="px-2.5 pt-2.5 pb-1 text-xs font-medium text-ink-4">{it.section}</div>}
                  <button
                    onClick={() => setSel(it.key)}
                    className={cn(
                      "flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm",
                      sel === it.key ? "bg-panel-3 font-medium" : "text-ink-2 hover:bg-panel-2",
                    )}
                  >
                    <span className="num w-5 shrink-0 font-mono text-xs text-ink-4">{i + 1}</span>
                    {T && <T.icon className="size-3.5 shrink-0 text-ink-4" />}
                    <span className="min-w-0 flex-1 truncate">{it.title || T?.label || "Question"}</span>
                    <span className="num text-xs text-ink-4">{pts(it.points)}</span>
                  </button>
                </div>
              );
            })}
            <div className="mt-1.5 border-t border-line pt-1.5">
              <AddMenu onAdd={add} />
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          {sel === "settings" || !current ? (
            <SettingsPanel s={settings} set={setS} groups={groups} people={people} />
          ) : (
            <ItemPanel
              key={current.key}
              it={current}
              n={items.indexOf(current) + 1}
              count={items.length}
              set={(p) => setItem(current.key, p)}
              onMove={(d) => move(current.key, d)}
              onDuplicate={() => duplicate(current.key)}
              onRemove={() => remove(current.key)}
              problems={problems}
              sections={sections}
              aiReady={aiReady}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function AddMenu({ onAdd }: { onAdd: (type: string, widget?: string) => void }) {
  const [widgets, setWidgets] = useState(false);
  return (
    <Menu
      align="start"
      className="w-[240px]"
      trigger={({ toggle }) => (
        <button onClick={toggle} className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-sm text-ink-2 hover:bg-panel-2 hover:text-ink">
          <Plus className="size-4" /> Add question
        </button>
      )}
    >
      {(close) =>
        widgets ? (
          <div className="max-h-[360px] overflow-y-auto">
            <button onClick={() => setWidgets(false)} className="flex h-8 w-full items-center gap-1 px-2 text-xs text-ink-3 hover:text-ink">
              <ChevronDown className="size-3 rotate-90" /> Back
            </button>
            {Object.entries(WIDGET_LABELS).map(([w, label]) => (
              <MenuItem
                key={w}
                onClick={() => {
                  close();
                  setWidgets(false);
                  onAdd("widget", w);
                }}
              >
                {label}
              </MenuItem>
            ))}
          </div>
        ) : (
          TYPES.map((t) => (
            <MenuItem
              key={t.type}
              icon={<t.icon />}
              onClick={() => {
                if (t.type === "widget") return setWidgets(true);
                close();
                onAdd(t.type);
              }}
            >
              <span className="flex flex-1 items-center justify-between">
                {t.label}
                {t.type === "widget" && <ChevronRight className="size-3.5 text-ink-4" />}
              </span>
            </MenuItem>
          ))
        )
      }
    </Menu>
  );
}

function ItemPanel({
  it,
  n,
  count,
  set,
  onMove,
  onDuplicate,
  onRemove,
  problems,
  sections,
  aiReady,
}: {
  it: Draft;
  n: number;
  count: number;
  set: (p: Partial<Draft>) => void;
  onMove: (d: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  problems: ProblemOption[];
  sections: string[];
  aiReady: boolean;
}) {
  const toast = useToast();
  const [advanced, setAdvanced] = useState(false);
  const [drafting, startDraft] = useTransition();
  const T = TYPE[it.type];
  const setConfig = (patch: Record<string, unknown>) => set({ config: { ...it.config, ...patch } });
  const canAuto = it.type !== "text";
  const reviewable = it.type === "text" || it.type === "short" || it.type === "numeric";
  const reference = (it.config.reference as string) ?? "";

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="num font-mono text-sm text-ink-4">{n}</span>
          {T && <T.icon className="size-4 text-ink-3" />}
          <span className="text-sm font-medium">{it.type === "widget" ? (WIDGET_LABELS[String(it.config.widget)] ?? "Interactive") : T?.label}</span>
          {it.grading === "ai" && <Badge tone="blue">Graded by Claude</Badge>}
          {it.grading === "manual" && <Badge tone="outline">Graded by hand</Badge>}
        </div>
        <div className="flex items-center">
          <IconBtn label="Move up" onClick={() => onMove(-1)} disabled={n === 1}>
            <ArrowUp className="size-4" />
          </IconBtn>
          <IconBtn label="Move down" onClick={() => onMove(1)} disabled={n === count}>
            <ArrowDown className="size-4" />
          </IconBtn>
          <IconBtn label="Duplicate" onClick={onDuplicate}>
            <Copy className="size-4" />
          </IconBtn>
          <IconBtn label="Delete" onClick={onRemove}>
            <Trash2 className="size-4" />
          </IconBtn>
        </div>
      </div>

      <div className="space-y-5 px-5 py-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_200px_110px]">
          <Field label="Title" hint="Short. Admins see it; members see it above the question.">
            <input value={it.title} onChange={(e) => set({ title: e.target.value })} className="field" />
          </Field>
          <Field label="Section">
            <input value={it.section ?? ""} onChange={(e) => set({ section: e.target.value || null })} list="sections" className="field" placeholder="None" />
            <datalist id="sections">
              {sections.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="Points">
            <NumberInput value={it.points} onChange={(v) => set({ points: v ?? 0 })} min={0} max={1000} step={0.5} />
          </Field>
        </div>

        {it.type === "widget" && (
          <Field label="Interactive question">
            <select
              value={String(it.config.widget)}
              onChange={(e) => {
                const b = blank("widget", e.target.value);
                set({ config: b.config, title: it.title && it.title !== WIDGET_LABELS[String(it.config.widget)] ? it.title : b.title, prompt: it.prompt || b.prompt });
              }}
              className="field"
            >
              {Object.entries(WIDGET_LABELS).map(([w, label]) => (
                <option key={w} value={w}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field
          label={it.type === "code" ? "Note above the problem" : "Question"}
          hint={it.type === "widget" ? "Words in {{double braces}} are filled in with each student's numbers." : undefined}
        >
          <MarkdownField value={it.prompt} onChange={(v) => set({ prompt: v })} rows={it.type === "code" ? 2 : 4} />
        </Field>

        <ConfigForm type={it.type} config={it.config} set={setConfig} problemId={it.problemId} setProblem={(p) => set({ problemId: p })} problems={problems} />

        {(reviewable || it.grading !== "auto") && (
          <div className="space-y-4 rounded-lg border border-line bg-panel-2 p-4">
            <Field label="Graded by">
              <Segmented
                value={it.grading}
                onChange={(v) => set({ grading: v })}
                options={[...(canAuto ? ([["auto", "Answer key"]] as ["auto", string][]) : []), ["ai", "Claude"], ["manual", "Me"]]}
              />
              <div className="hint">
                {it.grading === "ai"
                  ? `Claude scores each answer from 0 to ${pts(it.points)} using your rubric when the student submits. You can change any score.`
                  : it.grading === "manual"
                    ? "Answers wait for you on the Results tab."
                    : "Marked right or wrong against the accepted answers."}
              </div>
            </Field>
            {it.grading !== "auto" && (
              <>
                <Field label="Rubric" hint="One line per score works well, e.g. 3: …, 2: …">
                  <textarea value={it.rubric ?? ""} onChange={(e) => set({ rubric: e.target.value })} rows={5} className="field resize-y text-sm" />
                </Field>
                <Field label="Model answer" hint="Optional. Claude compares against it.">
                  <textarea value={reference} onChange={(e) => setConfig({ reference: e.target.value || undefined })} rows={3} className="field resize-y text-sm" />
                </Field>
                <Button
                  size="sm"
                  icon={<Sparkles className="size-3.5" />}
                  disabled={drafting || !aiReady || !it.prompt.trim()}
                  title={aiReady ? undefined : "Add an Anthropic API key to use Claude"}
                  onClick={() =>
                    startDraft(async () => {
                      const r = await draftRubric(it.prompt, it.points, reference || undefined);
                      if (!r.ok || !r.data) return toast(r.ok ? "No draft" : r.error, "error");
                      set({ rubric: r.data.rubric, config: { ...it.config, reference: reference || r.data.reference } });
                      toast("Rubric drafted. Read it over before saving.");
                    })
                  }
                >
                  {drafting ? "Drafting…" : "Draft rubric with Claude"}
                </Button>
              </>
            )}
          </div>
        )}

        <div>
          <button onClick={() => setAdvanced((a) => !a)} className="inline-flex items-center gap-1 text-xs text-ink-3 hover:text-ink">
            {advanced ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            Advanced
          </button>
          {advanced && (
            <div className="mt-3">
              <JsonConfig config={it.config} onChange={(c) => set({ config: c })} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
