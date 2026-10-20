"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { TestSettings } from "@/lib/admin/tests";
import { Field, Group, MarkdownField, NumberInput, Segmented, ToggleRow, fromLocalInput, toLocalInput } from "./fields";

export type Person = { id: string; name: string; username: string };
export type GroupOption = { id: string; name: string };

function code(len = 6) {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(len)), (b) => a[b % a.length]).join("");
}

export function SettingsPanel({
  s,
  set,
  groups,
  people,
}: {
  s: TestSettings;
  set: (patch: Partial<TestSettings>) => void;
  groups: GroupOption[];
  people: Person[];
}) {
  const integ = s.integrity;
  const setInteg = (patch: Partial<TestSettings["integrity"]>) => set({ integrity: { ...integ, ...patch } });
  const live = s.startMode === "live";
  return (
    <div className="card">
      <Group title="Basics">
        <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
          <Field label="Title">
            <input value={s.title} onChange={(e) => set({ title: e.target.value })} className="field" />
          </Field>
          <Field label="Label" hint="Shown on the card, e.g. Practice">
            <input value={s.tag ?? ""} onChange={(e) => set({ tag: e.target.value })} className="field" />
          </Field>
        </div>
        <Field label="Instructions" hint="Shown in the lobby before people start.">
          <MarkdownField value={s.description} onChange={(v) => set({ description: v })} rows={4} />
        </Field>
        <Field label="Link" hint={`/tests/${s.slug || "…"}`}>
          <input value={s.slug} onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} className="field font-mono text-sm" />
        </Field>
      </Group>

      <Group title="Timing">
        <Field label="Start">
          <Segmented
            value={s.startMode}
            onChange={(v) => set({ startMode: v, durationMin: v === "live" && !s.durationMin ? 30 : s.durationMin })}
            options={[
              ["live", "Everyone together"],
              ["open", "On their own"],
            ]}
          />
          <div className="hint">
            {live
              ? "Members wait in the lobby. You press Start on the Monitor tab and everyone begins at once."
              : "Members start whenever the test is open. Each person's clock starts when they press Start."}
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Time limit">
            <div className="flex items-center gap-2">
              <NumberInput value={s.durationMin} onChange={(v) => set({ durationMin: v })} min={1} max={600} placeholder="None" className="w-24" />
              <span className="text-sm text-ink-3">minutes</span>
            </div>
          </Field>
          {!live && (
            <>
              <Field label="Opens">
                <input type="datetime-local" value={toLocalInput(s.opensAt)} onChange={(e) => set({ opensAt: fromLocalInput(e.target.value) })} className="field" />
              </Field>
              <Field label="Closes">
                <input type="datetime-local" value={toLocalInput(s.closesAt)} onChange={(e) => set({ closesAt: fromLocalInput(e.target.value) })} className="field" />
              </Field>
            </>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Attempts per person">
            <NumberInput value={s.maxAttempts} onChange={(v) => set({ maxAttempts: v ?? 1 })} min={1} max={50} className="w-24" />
          </Field>
        </div>
        <ToggleRow label="Shuffle questions" hint="Within each section, so the overall flow stays the same." checked={s.shuffleItems} onChange={(v) => set({ shuffleItems: v })} />
      </Group>

      <Group title="Who can take it">
        <Segmented
          value={s.visibility}
          onChange={(v) => set({ visibility: v, accessCode: v === "code" && !s.accessCode ? code() : s.accessCode })}
          options={[
            ["everyone", "Everyone"],
            ["assigned", "Chosen people"],
            ["code", "Anyone with a code"],
          ]}
        />
        {s.visibility === "assigned" && <Assignees s={s} set={set} groups={groups} people={people} />}
        {s.visibility === "code" && (
          <Field label="Access code" hint="Share it in the room. Members type it in the lobby.">
            <div className="flex items-center gap-2">
              <input
                value={s.accessCode ?? ""}
                onChange={(e) => set({ accessCode: e.target.value.toUpperCase() })}
                className="field w-40 font-mono tracking-[0.2em]"
              />
              <button type="button" onClick={() => set({ accessCode: code() })} className="rounded p-1.5 text-ink-3 hover:bg-panel-3 hover:text-ink" title="New code">
                <RefreshCw className="size-4" />
              </button>
            </div>
          </Field>
        )}
      </Group>

      <Group title="Results">
        <Field label="Members see their score">
          <Segmented
            value={s.showResults}
            onChange={(v) => set({ showResults: v })}
            options={[
              ["after_submit", "Right away"],
              ["after_close", "When it closes"],
              ["never", "Never"],
            ]}
          />
        </Field>
        {s.showResults !== "never" && (
          <Field label="Detail">
            <Segmented
              value={s.resultsDetail}
              onChange={(v) => set({ resultsDetail: v })}
              options={[
                ["score", "Total only"],
                ["full", "Each question"],
              ]}
            />
          </Field>
        )}
        <Field label="Leaderboard">
          <Segmented
            value={s.leaderboard}
            onChange={(v) => set({ leaderboard: v })}
            options={[
              ["off", "Off"],
              ["live", "Live"],
              ["after_close", "After it closes"],
            ]}
          />
        </Field>
      </Group>

      <Group title="Integrity">
        <Field label="Where it runs">
          <Segmented
            value={integ.lockdown}
            onChange={(v) => setInteg({ lockdown: v })}
            options={[
              ["none", "Browser"],
              ["app", "Lab CS app"],
              ["seb", "Safe Exam Browser"],
              ["any", "App or SEB"],
            ]}
          />
          <div className="hint">
            {integ.lockdown === "none"
              ? "Runs in a normal browser tab. Leaving the tab, pasting and other signals are recorded and flagged."
              : integ.lockdown === "seb"
                ? "Members open it in Safe Exam Browser, which the site configures and verifies. Other apps are blocked until they submit."
                : "Members open it in the Lab CS desktop app. It fills the screen, blocks screenshots and other apps, and reports anything unusual."}
          </div>
        </Field>
        {integ.lockdown !== "none" && (
          <Field label="Exit code" hint="Lets you close the app early on a student's computer. Shown on the Monitor tab.">
            <input value={integ.exitCode} onChange={(e) => setInteg({ exitCode: e.target.value.toUpperCase().slice(0, 12) })} className="field w-40 font-mono tracking-[0.2em]" />
          </Field>
        )}
        <div className="space-y-4 pt-1">
          <ToggleRow
            label="Full screen"
            hint="The test opens in full screen. Leaving it is flagged."
            checked={integ.requireFullscreen}
            disabled={integ.lockdown !== "none"}
            onChange={(v) => setInteg({ requireFullscreen: v })}
          />
          <ToggleRow label="Warn when they leave" hint="Shows a notice when someone comes back from another tab or app." checked={integ.warnOnLeave} onChange={(v) => setInteg({ warnOnLeave: v })} />
          <ToggleRow label="Block pasting" hint="Paste is blocked in answers. Attempts are still recorded." checked={integ.blockPaste} onChange={(v) => setInteg({ blockPaste: v })} />
          <ToggleRow
            label="Camera check"
            hint="Looks for a face, extra people and phones on the student's own computer. No video leaves the computer; only flags are saved. Students must agree first."
            checked={integ.camera}
            onChange={(v) => setInteg({ camera: v })}
          />
          {(integ.lockdown === "app" || integ.lockdown === "any") && (
            <ToggleRow
              label="Check for assistant apps"
              hint="The app reports chat, AI and remote-control apps running during the test."
              checked={integ.scanApps !== false}
              onChange={(v) => setInteg({ scanApps: v })}
            />
          )}
        </div>
      </Group>

      <Group title="Reference">
        <Resources s={s} set={set} />
      </Group>
    </div>
  );
}

function Assignees({ s, set, groups, people }: { s: TestSettings; set: (p: Partial<TestSettings>) => void; groups: GroupOption[]; people: Person[] }) {
  const [q, setQ] = useState("");
  const a = s.assignees;
  const chosen = new Set(a.users);
  const matches = useMemo(
    () => (q.trim() ? people.filter((p) => !chosen.has(p.id) && (p.name.toLowerCase().includes(q.toLowerCase()) || p.username.includes(q.toLowerCase()))).slice(0, 8) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, people, a.users],
  );
  return (
    <div className="space-y-4">
      <Field label="Groups">
        {groups.length === 0 ? (
          <div className="text-sm text-ink-3">No groups yet. Make them on the Members page.</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {groups.map((g) => {
              const on = a.groups.includes(g.id);
              return (
                <button
                  type="button"
                  key={g.id}
                  onClick={() => set({ assignees: { ...a, groups: on ? a.groups.filter((x) => x !== g.id) : [...a.groups, g.id] } })}
                  className={cn("h-7 rounded-md border px-2.5 text-sm", on ? "border-ink bg-ink text-panel" : "border-line-2 text-ink-2 hover:border-ink-3")}
                >
                  {g.name}
                </button>
              );
            })}
          </div>
        )}
      </Field>
      <Field label="People">
        <div className="relative">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a person" className="field" />
          {matches.length > 0 && (
            <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-md bg-panel shadow-pop">
              {matches.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => {
                    set({ assignees: { ...a, users: [...a.users, p.id] } });
                    setQ("");
                  }}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-panel-2"
                >
                  {p.name} <span className="text-xs text-ink-4">@{p.username}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {a.users.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {a.users.map((id) => {
              const p = people.find((x) => x.id === id);
              return (
                <span key={id} className="inline-flex h-7 items-center gap-1 rounded-md bg-panel-3 pr-1 pl-2.5 text-sm">
                  {p?.name ?? "Removed member"}
                  <button type="button" onClick={() => set({ assignees: { ...a, users: a.users.filter((x) => x !== id) } })} className="rounded p-0.5 text-ink-3 hover:text-ink" aria-label="Remove">
                    <X className="size-3.5" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </Field>
    </div>
  );
}

function Resources({ s, set }: { s: TestSettings; set: (p: Partial<TestSettings>) => void }) {
  const list = s.resources;
  const update = (i: number, patch: Partial<(typeof list)[number]>) => set({ resources: list.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  return (
    <div className="space-y-3">
      {list.length === 0 && <div className="text-sm text-ink-3">Pages members can open during the test, like a language guide or formula sheet.</div>}
      {list.map((r, i) => (
        <div key={r.id || i} className="rounded-lg border border-line p-3">
          <div className="mb-2 flex items-center gap-2">
            <input value={r.title} onChange={(e) => update(i, { title: e.target.value })} placeholder="Title" className="field field-sm flex-1 font-medium" />
            <button type="button" onClick={() => set({ resources: list.filter((_, j) => j !== i) })} className="rounded p-1.5 text-ink-3 hover:bg-red-soft hover:text-red" aria-label="Remove">
              <Trash2 className="size-4" />
            </button>
          </div>
          <MarkdownField value={r.body} onChange={(v) => update(i, { body: v })} rows={6} />
        </div>
      ))}
      <button
        type="button"
        onClick={() => set({ resources: [...list, { id: "", title: "", body: "" }] })}
        className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-sm text-ink-3 hover:bg-panel-3 hover:text-ink"
      >
        <Plus className="size-3.5" /> Add a page
      </button>
    </div>
  );
}
