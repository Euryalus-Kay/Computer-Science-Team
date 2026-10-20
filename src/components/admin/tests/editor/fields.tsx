"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { previewTestMarkdown } from "@/lib/admin/tests";

export function Field({ label, hint, children, className }: { label?: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-line px-5 py-5 last:border-b-0">
      <h3 className="mb-4 text-sm font-semibold">{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
  className?: string;
}) {
  return (
    <div className={cn("inline-flex flex-wrap gap-0.5 rounded-md bg-panel-3 p-0.5", className)}>
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn("h-7 rounded-[5px] px-2.5 text-sm text-ink-3", value === v ? "bg-panel font-medium text-ink shadow-card" : "hover:text-ink")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function ToggleRow({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className={cn("flex items-start justify-between gap-6", disabled && "opacity-50")}>
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-ink-3">{hint}</div>}
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} label={label} />
    </div>
  );
}

/** Markdown text with a rendered preview underneath. */
export function MarkdownField({
  value,
  onChange,
  rows = 4,
  placeholder,
  mono,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  mono?: boolean;
}) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [html, setHtml] = useState("");
  useEffect(() => {
    if (tab !== "preview") return;
    let live = true;
    previewTestMarkdown(value).then((h) => live && setHtml(h));
    return () => {
      live = false;
    };
  }, [tab, value]);
  return (
    <div className="overflow-hidden rounded-md border border-line focus-within:border-blue focus-within:shadow-[0_0_0_3px_var(--blue-soft)]">
      <div className="flex items-center gap-3 border-b border-line bg-panel-2 px-2.5 text-xs">
        {(["write", "preview"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn("-mb-px border-b-2 py-1.5 capitalize", tab === t ? "border-ink font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink")}
          >
            {t}
          </button>
        ))}
        <span className="ml-auto text-ink-4">Markdown</span>
      </div>
      {tab === "write" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className={cn("block w-full resize-y bg-panel px-3 py-2 text-[14px] leading-relaxed outline-none", mono && "font-mono text-[13px]")}
        />
      ) : (
        <div className="prose min-h-[80px] bg-panel px-3 py-2.5" dangerouslySetInnerHTML={{ __html: html || "<p></p>" }} />
      )}
    </div>
  );
}

/** An editable list of short strings, e.g. answer choices. */
export function ListEditor({
  items,
  onChange,
  placeholder,
  addLabel = "Add",
  marker,
  min = 0,
}: {
  items: string[];
  /** `moved` maps an old row index to its new one, or -1 if it was removed. */
  onChange: (v: string[], moved: (old: number) => number) => void;
  placeholder?: (i: number) => string;
  addLabel?: string;
  marker?: (i: number) => ReactNode;
  min?: number;
}) {
  const same = (k: number) => k;
  const set = (i: number, v: string) => onChange(items.map((x, j) => (j === i ? v : x)), same);
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const n = [...items];
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n, (k) => (k === i ? j : k === j ? i : k));
  };
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i), (k) => (k === i ? -1 : k > i ? k - 1 : k));
  return (
    <div className="space-y-1.5">
      {items.map((v, i) => (
        <div key={i} className="group flex items-center gap-2">
          {marker && <div className="w-6 shrink-0">{marker(i)}</div>}
          <input value={v} onChange={(e) => set(i, e.target.value)} placeholder={placeholder?.(i)} className="field field-sm flex-1" />
          <div className="flex transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0">
            <IconBtn label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
              <ArrowUp className="size-3.5" />
            </IconBtn>
            <IconBtn label="Move down" onClick={() => move(i, 1)} disabled={i === items.length - 1}>
              <ArrowDown className="size-3.5" />
            </IconBtn>
            <IconBtn label="Remove" onClick={() => remove(i)} disabled={items.length <= min}>
              <Trash2 className="size-3.5" />
            </IconBtn>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ""], same)} className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-sm text-ink-3 hover:bg-panel-3 hover:text-ink">
        <Plus className="size-3.5" /> {addLabel}
      </button>
    </div>
  );
}

export function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded p-1 text-ink-3 hover:bg-panel-3 hover:text-ink disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  className,
  placeholder,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  /** Rounds to this step when the field loses focus. "any" keeps decimals as typed. */
  step?: number | "any";
  className?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));
  useEffect(() => {
    setText((t) => (Number(t) === value || (t === "" && value === null) ? t : value === null ? "" : String(value)));
  }, [value]);
  return (
    <input
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        const t = e.target.value.replace(/[^0-9.\-]/g, "");
        setText(t);
        if (t === "") return onChange(null);
        const n = Number(t);
        if (Number.isFinite(n)) onChange(n);
      }}
      onBlur={() => {
        if (value === null) return;
        let n = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value));
        // toFixed drops float noise such as 0.010000000000000002 from the rounding.
        if (step !== "any") n = Number((Math.round(n / step) * step).toFixed((String(step).split(".")[1] ?? "").length));
        if (n !== value) onChange(n);
        setText(String(n));
      }}
      className={cn("field num", className)}
    />
  );
}

/** "YYYY-MM-DDTHH:mm" in the browser's time zone, for datetime-local inputs. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const t = new Date(v);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}
