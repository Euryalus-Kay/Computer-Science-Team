"use server";

import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { hashPassword, verifyPassword } from "./password";
import { createSession, destroySession } from "./session";
import { checkName, checkPassword, checkUsername, normalizeUsername } from "./validate";
import { getSettings } from "@/lib/settings";

export type FormState = { error?: string; ok?: boolean } | undefined;

function safeNext(next: FormDataEntryValue | null): string {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const username = normalizeUsername(String(form.get("username") ?? ""));
  const password = String(form.get("password") ?? "");
  if (!username || !password) return { error: "Enter your username and password." };
  const d = await db();
  const [user] = await d.select().from(users).where(eq(users.username, username)).limit(1);
  if (!user || user.disabled) return { error: "Username or password is incorrect." };
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return { error: `Too many attempts. Try again in ${mins} min.` };
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const failed = user.failedLogins + 1;
    await d
      .update(users)
      .set({ failedLogins: failed, lockedUntil: failed >= 8 ? new Date(Date.now() + 5 * 60_000) : null })
      .where(eq(users.id, user.id));
    return { error: "Username or password is incorrect." };
  }
  await createSession(user.id, "web");
  redirect(safeNext(form.get("next")));
}

export async function joinAction(_: FormState, form: FormData): Promise<FormState> {
  const s = await getSettings();
  if (!s.signupEnabled) return { error: "Sign-up is closed. Ask an admin for an account." };
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  if (!code || code !== s.joinCode.toUpperCase()) return { error: "That join code isn't right." };
  const name = String(form.get("name") ?? "").trim();
  const username = normalizeUsername(String(form.get("username") ?? ""));
  const password = String(form.get("password") ?? "");
  const err = checkName(name) ?? checkUsername(username) ?? checkPassword(password);
  if (err) return { error: err };
  const d = await db();
  const [exists] = await d.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  if (exists) return { error: "That username is taken." };
  const id = newId();
  await d.insert(users).values({ id, username, name, passwordHash: await hashPassword(password), role: "member" });
  await createSession(id, "web");
  redirect("/");
}

export async function setupAction(_: FormState, form: FormData): Promise<FormState> {
  const d = await db();
  const [{ count }] = await d.select({ count: sql<number>`count(*)::int` }).from(users);
  if (count > 0) return { error: "Setup is already complete." };
  const token = process.env.SETUP_TOKEN;
  if (token && String(form.get("token") ?? "") !== token) return { error: "Setup token is incorrect." };
  const name = String(form.get("name") ?? "").trim();
  const username = normalizeUsername(String(form.get("username") ?? ""));
  const password = String(form.get("password") ?? "");
  const err = checkName(name) ?? checkUsername(username) ?? checkPassword(password);
  if (err) return { error: err };
  const id = newId();
  await d.insert(users).values({
    id,
    username,
    name,
    passwordHash: await hashPassword(password),
    role: "admin",
    isOwner: true,
  });
  if (form.get("starter") === "on") {
    const { seedStarterContent } = await import("@/content/seed");
    await seedStarterContent(id);
  }
  await createSession(id, "web");
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
