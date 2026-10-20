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

/** `values` are the fields sent back after an error, so the form doesn't make people retype them. */
export type FormState = { error?: string; ok?: boolean; values?: Record<string, string> } | undefined;

function safeNext(next: FormDataEntryValue | null): string {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

function field(form: FormData, key: string): string {
  return String(form.get(key) ?? "");
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const values = { username: field(form, "username") };
  const fail = (error: string): FormState => ({ error, values });
  const username = normalizeUsername(values.username);
  const password = field(form, "password");
  if (!username || !password) return fail("Enter your username and password.");
  const d = await db();
  const [user] = await d.select().from(users).where(eq(users.username, username)).limit(1);
  if (!user) return fail("Username or password is incorrect.");
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return fail(`Too many attempts. Try again in ${mins} min.`);
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const failed = user.failedLogins + 1;
    await d
      .update(users)
      .set({ failedLogins: failed, lockedUntil: failed >= 8 ? new Date(Date.now() + 5 * 60_000) : null })
      .where(eq(users.id, user.id));
    return fail("Username or password is incorrect.");
  }
  // Only said once the password is right, so it doesn't reveal which accounts exist.
  if (user.disabled) return fail("This account is turned off. Ask an admin to turn it back on.");
  await createSession(user.id, "web");
  const next = safeNext(form.get("next"));
  // A temporary password from an admin: ask for a new one first, unless they were headed somewhere.
  redirect(user.mustChangePassword && next === "/" ? "/account" : next);
}

export async function joinAction(_: FormState, form: FormData): Promise<FormState> {
  const values = { code: field(form, "code"), name: field(form, "name"), username: field(form, "username") };
  const fail = (error: string): FormState => ({ error, values });
  const s = await getSettings();
  if (!s.signupEnabled) return fail("Sign-up is closed. Ask an admin for an account.");
  const code = values.code.trim().toUpperCase();
  if (!code || code !== s.joinCode.toUpperCase()) return fail("That join code isn't right.");
  const name = values.name.trim();
  const username = normalizeUsername(values.username);
  const password = field(form, "password");
  const err = checkName(name) ?? checkUsername(username) ?? checkPassword(password);
  if (err) return fail(err);
  const d = await db();
  const [exists] = await d.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  if (exists) return fail("That username is taken.");
  const id = newId();
  await d.insert(users).values({ id, username, name, passwordHash: await hashPassword(password), role: "member" });
  await createSession(id, "web");
  redirect("/");
}

export async function setupAction(_: FormState, form: FormData): Promise<FormState> {
  const values = { name: field(form, "name"), username: field(form, "username"), starter: form.get("starter") === "on" ? "on" : "" };
  const d = await db();
  const [{ count }] = await d.select({ count: sql<number>`count(*)::int` }).from(users);
  if (count > 0) return { error: "Setup is already complete." };
  const token = process.env.SETUP_TOKEN;
  if (token && field(form, "token").trim() !== token) return { error: "Setup token is incorrect.", values };
  const name = values.name.trim();
  const username = normalizeUsername(values.username);
  const password = field(form, "password");
  const err = checkName(name) ?? checkUsername(username) ?? checkPassword(password);
  if (err) return { error: err, values: { ...values, token: field(form, "token") } };
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
