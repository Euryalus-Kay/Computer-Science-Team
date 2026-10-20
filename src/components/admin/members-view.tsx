"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Search,
  UserPlus,
  MoreHorizontal,
  KeyRound,
  Pencil,
  Ban,
  Trash2,
  Printer,
  Copy,
  RefreshCw,
  Plus,
  Check,
  ShieldCheck,
  MonitorPlay,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { Empty } from "@/components/ui/page";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/format";
import {
  addMembers,
  createGroup,
  deleteGroup,
  deleteMembers,
  regenerateJoinCode,
  resetPassword,
  setGroupMembership,
  setSignup,
  updateMember,
  type Credential,
} from "@/lib/admin/members";

export type MemberRow = {
  id: string;
  name: string;
  username: string;
  role: "admin" | "member";
  isOwner: boolean;
  disabled: boolean;
  grade: string | null;
  notes: string | null;
  mustChangePassword: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  groups: string[];
};
export type GroupRow = { id: string; name: string; color: string };

export const GROUP_TONES: Record<string, Tone> = {
  gray: "neutral",
  green: "green",
  blue: "blue",
  amber: "amber",
  red: "red",
};

export function GroupBadge({ g }: { g: GroupRow }) {
  return <Badge tone={GROUP_TONES[g.color] ?? "neutral"}>{g.name}</Badge>;
}

export function MembersView({
  meId,
  members,
  groups,
  signupEnabled,
  joinCode,
}: {
  meId: string;
  members: MemberRow[];
  groups: GroupRow[];
  signupEnabled: boolean;
  joinCode: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<MemberRow | null>(null);
  const [creds, setCreds] = useState<Credential[] | null>(null);
  const [pending, start] = useTransition();
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  const filtered = members.filter((m) => {
    if (q) {
      const s = q.toLowerCase();
      if (!m.name.toLowerCase().includes(s) && !m.username.includes(s)) return false;
    }
    if (groupFilter === "none" && m.groups.length) return false;
    if (groupFilter && groupFilter !== "none" && !m.groups.includes(groupFilter)) return false;
    if (roleFilter && m.role !== roleFilter) return false;
    return true;
  });
  const allSelected = filtered.length > 0 && filtered.every((m) => selected.has(m.id));

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function run<T>(p: Promise<{ ok: true; data?: T } | { ok: false; error: string }>, done?: (data?: T) => void) {
    start(async () => {
      const r = await p;
      if (!r.ok) toast(r.error, "error");
      else {
        done?.(r.data);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-[280px]">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-4" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="field field-sm pl-8" />
          </div>
          <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="field field-sm w-auto">
            <option value="">All groups</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
            <option value="none">No group</option>
          </select>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="field field-sm w-auto">
            <option value="">All roles</option>
            <option value="member">Members</option>
            <option value="admin">Admins</option>
          </select>
          <div className="flex-1" />
          <Button variant="primary" icon={<UserPlus className="size-4" />} onClick={() => setAdding(true)}>
            Add members
          </Button>
        </div>

        <div className="card overflow-hidden">
          {filtered.length === 0 ? (
            <Empty title={members.length ? "No matches" : "No members yet"}>
              {members.length ? "Try a different search or filter." : "Add accounts or share the join code."}
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-10">
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={allSelected}
                        onChange={() =>
                          setSelected(allSelected ? new Set() : new Set(filtered.map((m) => m.id)))
                        }
                        className="accent-[var(--ink)]"
                      />
                    </th>
                    <th>Name</th>
                    <th>Username</th>
                    <th>Groups</th>
                    <th>Grade</th>
                    <th>Last seen</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr key={m.id} className={cn(m.disabled && "opacity-55")}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${m.name}`}
                          checked={selected.has(m.id)}
                          onChange={() => toggle(m.id)}
                          className="accent-[var(--ink)]"
                        />
                      </td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={m.name} size={26} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 font-medium text-ink">
                              <span className="truncate">{m.name}</span>
                              {m.role === "admin" && (
                                <span title={m.isOwner ? "Owner" : "Admin"}>
                                  <ShieldCheck className="size-3.5 text-accent" />
                                </span>
                              )}
                            </div>
                            {m.disabled && <div className="text-xs text-ink-3">Disabled</div>}
                          </div>
                        </div>
                      </td>
                      <td className="font-mono text-[12.5px] text-ink-2">{m.username}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {m.groups.map((gid) => {
                            const g = groupById.get(gid);
                            return g ? <GroupBadge key={gid} g={g} /> : null;
                          })}
                        </div>
                      </td>
                      <td className="text-ink-2">{m.grade ?? ""}</td>
                      <td className="whitespace-nowrap text-ink-3">{relativeTime(m.lastSeenAt)}</td>
                      <td>
                        <Menu
                          trigger={({ toggle: t }) => (
                            <button onClick={t} className="rounded p-1 text-ink-3 hover:bg-panel-3 hover:text-ink" aria-label="Actions">
                              <MoreHorizontal className="size-4" />
                            </button>
                          )}
                        >
                          {(close) => (
                            <>
                              <MenuItem
                                icon={<Pencil />}
                                onClick={() => {
                                  close();
                                  setEditing(m);
                                }}
                              >
                                Edit
                              </MenuItem>
                              <MenuItem
                                icon={<KeyRound />}
                                onClick={() => {
                                  close();
                                  run(resetPassword(m.id), (c) => c && setCreds([c]));
                                }}
                              >
                                Reset password
                              </MenuItem>
                              {m.id !== meId && !m.isOwner && (
                                <>
                                  <MenuItem
                                    icon={<ShieldCheck />}
                                    onClick={() => {
                                      close();
                                      run(updateMember(m.id, { role: m.role === "admin" ? "member" : "admin" }));
                                    }}
                                  >
                                    {m.role === "admin" ? "Make member" : "Make admin"}
                                  </MenuItem>
                                  <MenuItem
                                    icon={<Ban />}
                                    onClick={() => {
                                      close();
                                      run(updateMember(m.id, { disabled: !m.disabled }));
                                    }}
                                  >
                                    {m.disabled ? "Enable" : "Disable"}
                                  </MenuItem>
                                  <MenuSeparator />
                                  <MenuItem
                                    danger
                                    icon={<Trash2 />}
                                    onClick={() => {
                                      close();
                                      if (confirm(`Delete ${m.name}? Their attempts and submissions are removed too.`))
                                        run(deleteMembers([m.id]));
                                    }}
                                  >
                                    Delete
                                  </MenuItem>
                                </>
                              )}
                            </>
                          )}
                        </Menu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selected.size > 0 && (
          <div className="animate-in sticky bottom-4 z-20 mx-auto mt-4 flex w-fit flex-wrap items-center gap-2 rounded-lg bg-ink px-3 py-2 text-sm text-panel shadow-pop">
            <span className="px-1 font-medium">{selected.size} selected</span>
            <span className="h-4 w-px bg-panel/20" />
            {groups.length > 0 && (
              <select
                className="h-7 rounded-md border border-panel/20 bg-transparent px-2 text-sm"
                value=""
                onChange={(e) => {
                  const [op, gid] = e.target.value.split(":");
                  if (!gid) return;
                  run(setGroupMembership(gid, [...selected], op === "add"), () => toast(op === "add" ? "Added to group" : "Removed from group"));
                }}
              >
                <option value="" className="text-ink">
                  Groups…
                </option>
                {groups.map((g) => (
                  <option key={"a" + g.id} value={`add:${g.id}`} className="text-ink">
                    Add to {g.name}
                  </option>
                ))}
                {groups.map((g) => (
                  <option key={"r" + g.id} value={`remove:${g.id}`} className="text-ink">
                    Remove from {g.name}
                  </option>
                ))}
              </select>
            )}
            <button
              className="h-7 rounded-md px-2 hover:bg-panel/10"
              onClick={() => {
                if (confirm(`Delete ${selected.size} accounts?`)) run(deleteMembers([...selected]), () => setSelected(new Set()));
              }}
            >
              Delete
            </button>
            <button className="h-7 rounded-md px-2 text-panel/70 hover:bg-panel/10" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <JoinCard signupEnabled={signupEnabled} joinCode={joinCode} run={run} />
        <GroupsCard groups={groups} members={members} run={run} pending={pending} />
      </div>

      <AddMembersDialog
        open={adding}
        onClose={() => setAdding(false)}
        groups={groups}
        onCreated={(c) => {
          setAdding(false);
          setCreds(c);
          router.refresh();
        }}
      />
      {editing && <EditMemberDialog member={editing} onClose={() => setEditing(null)} run={run} />}
      <CredentialsDialog creds={creds} onClose={() => setCreds(null)} />
    </div>
  );
}

type Runner = <T>(
  p: Promise<{ ok: true; data?: T } | { ok: false; error: string }>,
  done?: (data?: T) => void,
) => void;

function JoinCard({ signupEnabled, joinCode, run }: { signupEnabled: boolean; joinCode: string; run: Runner }) {
  const toast = useToast();
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const link = `${origin}/join?code=${joinCode}`;
  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="text-sm font-medium">Self sign-up</div>
        <Switch checked={signupEnabled} onChange={(v) => run(setSignup(v))} label="Allow sign-up" />
      </div>
      <div className={cn("px-4 py-3.5", !signupEnabled && "opacity-50")}>
        <div className="text-xs text-ink-3">Join code</div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="font-mono text-2xl font-semibold tracking-[0.2em]">{joinCode}</div>
          <button
            onClick={() => run(regenerateJoinCode(), () => toast("New code generated"))}
            className="rounded p-1.5 text-ink-3 hover:bg-panel-3 hover:text-ink"
            title="Generate a new code"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            icon={<Copy className="size-3.5" />}
            onClick={() => {
              navigator.clipboard.writeText(link);
              toast("Link copied");
            }}
          >
            Copy link
          </Button>
          <Button
            size="sm"
            icon={<MonitorPlay className="size-3.5" />}
            onClick={() => {
              fetch("/api/board/state", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ view: "join" }),
              }).then(() => toast("Showing on board"));
            }}
          >
            Show on board
          </Button>
        </div>
      </div>
    </div>
  );
}

const COLORS = ["gray", "green", "blue", "amber", "red"];

function GroupsCard({ groups, members, run, pending }: { groups: GroupRow[]; members: MemberRow[]; run: Runner; pending: boolean }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("blue");
  const counts = new Map<string, number>();
  for (const m of members) for (const g of m.groups) counts.set(g, (counts.get(g) ?? 0) + 1);
  return (
    <div className="card">
      <div className="border-b border-line px-4 py-3 text-sm font-medium">Groups</div>
      <div className="divide-y divide-line">
        {groups.map((g) => (
          <div key={g.id} className="group flex items-center justify-between px-4 py-2.5">
            <GroupBadge g={g} />
            <div className="flex items-center gap-2">
              <span className="num text-sm text-ink-3">{counts.get(g.id) ?? 0}</span>
              <button
                onClick={() => confirm(`Delete group "${g.name}"?`) && run(deleteGroup(g.id))}
                className="rounded p-1 text-ink-4 opacity-0 group-hover:opacity-100 hover:bg-panel-3 hover:text-red"
                aria-label={`Delete ${g.name}`}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
        {groups.length === 0 && <div className="px-4 py-3 text-sm text-ink-3">Only admins see groups.</div>}
      </div>
      <form
        className="flex items-center gap-2 border-t border-line px-3 py-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          run(createGroup(name, color), () => setName(""));
        }}
      >
        <div className="flex gap-1">
          {COLORS.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setColor(c)}
              className={cn(
                "size-4 rounded-full ring-offset-2 ring-offset-panel",
                {
                  gray: "bg-ink-4",
                  green: "bg-accent",
                  blue: "bg-blue",
                  amber: "bg-amber",
                  red: "bg-red",
                }[c],
                color === c && "ring-2 ring-line-2",
              )}
              aria-label={c}
            />
          ))}
        </div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New group" className="field field-sm flex-1" />
        <Button type="submit" size="sm" disabled={pending || !name.trim()} icon={<Plus className="size-3.5" />}>
          Add
        </Button>
      </form>
    </div>
  );
}

function AddMembersDialog({
  open,
  onClose,
  groups,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  groups: GroupRow[];
  onCreated: (c: Credential[]) => void;
}) {
  const toast = useToast();
  const [lines, setLines] = useState("");
  const [groupId, setGroupId] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [pending, start] = useTransition();
  const count = lines.split(/\n/).filter((l) => l.trim()).length;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add members"
      width={520}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={pending || count === 0}
            onClick={() =>
              start(async () => {
                const r = await addMembers({ lines, groupId: groupId || null, role });
                if (!r.ok) toast(r.error, "error");
                else {
                  setLines("");
                  onCreated(r.data ?? []);
                }
              })
            }
          >
            {pending ? "Creating…" : count > 1 ? `Create ${count} accounts` : "Create account"}
          </Button>
        </>
      }
    >
      <label className="label">One per line</label>
      <textarea
        value={lines}
        onChange={(e) => setLines(e.target.value)}
        rows={8}
        autoFocus
        placeholder={"Ada Lovelace\nAlan Turing, aturing\nGrace Hopper, ghopper, 11"}
        className="field resize-y font-mono text-[13px] leading-6"
      />
      <div className="hint">Name, optional username, optional grade. Usernames and temporary passwords are generated.</div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="label">Group</label>
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="field">
            <option value="">None</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value as "member" | "admin")} className="field">
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
    </Dialog>
  );
}

function EditMemberDialog({ member, onClose, run }: { member: MemberRow; onClose: () => void; run: Runner }) {
  const [name, setName] = useState(member.name);
  const [username, setUsername] = useState(member.username);
  const [grade, setGrade] = useState(member.grade ?? "");
  const [notes, setNotes] = useState(member.notes ?? "");
  return (
    <Dialog
      open
      onClose={onClose}
      title="Edit member"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => run(updateMember(member.id, { name, username, grade, notes }), onClose)}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="label">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="field" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} className="field font-mono" />
          </div>
          <div>
            <label className="label">Grade</label>
            <input value={grade} onChange={(e) => setGrade(e.target.value)} className="field" placeholder="9–12" />
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="field resize-y" />
          <div className="hint">Visible to admins only.</div>
        </div>
      </div>
    </Dialog>
  );
}

function CredentialsDialog({ creds, onClose }: { creds: Credential[] | null; onClose: () => void }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  if (!creds) return null;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const csv = ["name,username,password", ...creds.map((c) => `"${c.name}",${c.username},${c.password}`)].join("\n");
  return (
    <>
      <Dialog
        open
        onClose={onClose}
        title={creds.length === 1 ? "Sign-in details" : `${creds.length} accounts created`}
        width={560}
        footer={
          <>
            <Button
              icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              onClick={() => {
                navigator.clipboard.writeText(csv);
                setCopied(true);
                toast("Copied as CSV");
              }}
            >
              Copy CSV
            </Button>
            <Button icon={<Printer className="size-4" />} onClick={() => window.print()}>
              Print cards
            </Button>
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-ink-2">Passwords are shown only now. Members are asked to change them after signing in.</p>
        <div className="card overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Password</th>
              </tr>
            </thead>
            <tbody>
              {creds.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}</td>
                  <td className="font-mono text-[12.5px]">{c.username}</td>
                  <td className="font-mono text-[12.5px]">{c.password}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Dialog>
      {typeof document !== "undefined" &&
        createPortal(
          <div className="print-root">
            {creds.map((c) => (
              <div key={c.id} className="print-card">
                <div className="pc-name">{c.name}</div>
                <div className="pc-row">
                  <span>Site</span>
                  <b>{origin.replace(/^https?:\/\//, "")}</b>
                </div>
                <div className="pc-row">
                  <span>Username</span>
                  <b>{c.username}</b>
                </div>
                <div className="pc-row">
                  <span>Password</span>
                  <b>{c.password}</b>
                </div>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
