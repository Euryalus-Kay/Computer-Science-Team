"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { groupMembers, groups, sessions, users } from "@/lib/db/schema";
import { newCode, newId, newPassphrase } from "@/lib/ids";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { requireAdmin, requireUser } from "@/lib/auth/session";
import { checkName, checkPassword, checkUsername, normalizeUsername, usernameFromName } from "@/lib/auth/validate";
import { saveSettings } from "@/lib/settings";

export type Credential = { id: string; name: string; username: string; password: string };
type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function uniqueUsername(base: string, taken: Set<string>): Promise<string> {
  let candidate = base;
  let n = 2;
  while (taken.has(candidate)) candidate = `${base}${n++}`;
  taken.add(candidate);
  return candidate;
}

/** Accepts lines like "Ada Lovelace" or "Ada Lovelace, ada" or "Ada Lovelace, ada, 11". */
export async function addMembers(input: {
  lines: string;
  groupId?: string | null;
  role?: "member" | "admin";
}): Promise<Result<Credential[]>> {
  await requireAdmin();
  const rows = input.lines
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 300);
  if (rows.length === 0) return { ok: false, error: "Add at least one name." };
  const d = await db();
  const existing = new Set((await d.select({ u: users.username }).from(users)).map((r) => r.u));
  const created: Credential[] = [];
  const values: (typeof users.$inferInsert)[] = [];
  for (const row of rows) {
    const [rawName, rawUser, rawGrade] = row.split(/\s*[,\t]\s*/);
    const name = rawName.replace(/\s+/g, " ").trim();
    const nameErr = checkName(name);
    if (nameErr) return { ok: false, error: `${row}: ${nameErr}` };
    let username: string;
    if (rawUser) {
      username = normalizeUsername(rawUser);
      const err = checkUsername(username);
      if (err) return { ok: false, error: `${row}: ${err}` };
      if (existing.has(username)) return { ok: false, error: `${row}: username "${username}" is taken.` };
      existing.add(username);
    } else {
      username = await uniqueUsername(usernameFromName(name).padEnd(3, "0"), existing);
    }
    const password = newPassphrase();
    const id = newId();
    values.push({
      id,
      name,
      username,
      grade: rawGrade?.trim() || null,
      passwordHash: await hashPassword(password),
      role: input.role ?? "member",
      mustChangePassword: true,
    });
    created.push({ id, name, username, password });
  }
  await d.insert(users).values(values);
  if (input.groupId) {
    await d
      .insert(groupMembers)
      .values(created.map((c) => ({ groupId: input.groupId!, userId: c.id })))
      .onConflictDoNothing();
  }
  revalidatePath("/admin/members");
  return { ok: true, data: created };
}

export async function resetPassword(userId: string): Promise<Result<Credential>> {
  await requireAdmin();
  const d = await db();
  const [u] = await d.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return { ok: false, error: "Member not found." };
  const password = newPassphrase();
  await d
    .update(users)
    .set({ passwordHash: await hashPassword(password), mustChangePassword: true, failedLogins: 0, lockedUntil: null })
    .where(eq(users.id, userId));
  await d.delete(sessions).where(eq(sessions.userId, userId));
  return { ok: true, data: { id: u.id, name: u.name, username: u.username, password } };
}

export async function updateMember(
  userId: string,
  patch: { name?: string; role?: "admin" | "member"; disabled?: boolean; grade?: string | null; notes?: string | null; username?: string },
): Promise<Result> {
  const me = await requireAdmin();
  const d = await db();
  const [u] = await d.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return { ok: false, error: "Member not found." };
  if (u.isOwner && (patch.role === "member" || patch.disabled)) return { ok: false, error: "The owner account can't be demoted or disabled." };
  if (userId === me.user.id && (patch.role === "member" || patch.disabled)) return { ok: false, error: "You can't demote or disable yourself." };
  const set: Partial<typeof users.$inferInsert> = {};
  if (patch.name !== undefined) {
    const err = checkName(patch.name);
    if (err) return { ok: false, error: err };
    set.name = patch.name.trim();
  }
  if (patch.username !== undefined) {
    const un = normalizeUsername(patch.username);
    const err = checkUsername(un);
    if (err) return { ok: false, error: err };
    const [taken] = await d.select({ id: users.id }).from(users).where(and(eq(users.username, un), ne(users.id, userId))).limit(1);
    if (taken) return { ok: false, error: "That username is taken." };
    set.username = un;
  }
  if (patch.role) set.role = patch.role;
  if (patch.disabled !== undefined) set.disabled = patch.disabled;
  if (patch.grade !== undefined) set.grade = patch.grade?.trim() || null;
  if (patch.notes !== undefined) set.notes = patch.notes?.trim() || null;
  await d.update(users).set(set).where(eq(users.id, userId));
  if (patch.disabled) await d.delete(sessions).where(eq(sessions.userId, userId));
  revalidatePath("/admin/members");
  return { ok: true };
}

export async function deleteMembers(ids: string[]): Promise<Result> {
  const me = await requireAdmin();
  const d = await db();
  const targets = await d.select().from(users).where(inArray(users.id, ids));
  if (targets.some((t) => t.isOwner)) return { ok: false, error: "The owner account can't be deleted." };
  if (ids.includes(me.user.id)) return { ok: false, error: "You can't delete yourself." };
  await d.delete(users).where(inArray(users.id, ids));
  revalidatePath("/admin/members");
  return { ok: true };
}

export async function createGroup(name: string, color = "gray"): Promise<Result<{ id: string }>> {
  await requireAdmin();
  const n = name.trim();
  if (!n) return { ok: false, error: "Name the group." };
  const d = await db();
  const id = newId(10);
  await d.insert(groups).values({ id, name: n.slice(0, 40), color });
  revalidatePath("/admin/members");
  return { ok: true, data: { id } };
}

export async function renameGroup(id: string, name: string, color?: string): Promise<Result> {
  await requireAdmin();
  const d = await db();
  await d
    .update(groups)
    .set({ name: name.trim().slice(0, 40), ...(color ? { color } : {}) })
    .where(eq(groups.id, id));
  revalidatePath("/admin/members");
  return { ok: true };
}

export async function deleteGroup(id: string): Promise<Result> {
  await requireAdmin();
  const d = await db();
  await d.delete(groups).where(eq(groups.id, id));
  revalidatePath("/admin/members");
  return { ok: true };
}

export async function setGroupMembership(groupId: string, userIds: string[], member: boolean): Promise<Result> {
  await requireAdmin();
  const d = await db();
  if (userIds.length === 0) return { ok: true };
  if (member) {
    await d
      .insert(groupMembers)
      .values(userIds.map((userId) => ({ groupId, userId })))
      .onConflictDoNothing();
  } else {
    await d.delete(groupMembers).where(and(eq(groupMembers.groupId, groupId), inArray(groupMembers.userId, userIds)));
  }
  revalidatePath("/admin/members");
  return { ok: true };
}

export async function setSignup(enabled: boolean): Promise<Result> {
  await requireAdmin();
  await saveSettings({ signupEnabled: enabled });
  revalidatePath("/admin/members");
  return { ok: true };
}

export async function regenerateJoinCode(): Promise<Result<{ code: string }>> {
  await requireAdmin();
  const code = newCode(6);
  await saveSettings({ joinCode: code });
  revalidatePath("/admin/members");
  return { ok: true, data: { code } };
}

export async function changeOwnPassword(current: string, next: string): Promise<Result> {
  const s = await requireUser();
  const err = checkPassword(next);
  if (err) return { ok: false, error: err };
  if (!(await verifyPassword(current, s.user.passwordHash))) return { ok: false, error: "Current password is incorrect." };
  const d = await db();
  await d
    .update(users)
    .set({ passwordHash: await hashPassword(next), mustChangePassword: false })
    .where(eq(users.id, s.user.id));
  await d.delete(sessions).where(and(eq(sessions.userId, s.user.id), ne(sessions.id, s.id)));
  return { ok: true };
}

export async function memberCount(): Promise<number> {
  const d = await db();
  const [{ n }] = await d.select({ n: sql<number>`count(*)::int` }).from(users);
  return n;
}
