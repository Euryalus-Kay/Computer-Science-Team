import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";
import { newToken, sha256 } from "@/lib/ids";

export const SESSION_COOKIE = "lcs_session";
const SESSION_DAYS = 30;

export type SessionUser = typeof users.$inferSelect;
export type Session = {
  id: string;
  kind: "web" | "desktop" | "seb";
  user: SessionUser;
  meta: { sebConfigKey?: string; appVersion?: string } | null;
};

export async function requestMeta() {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  const ip = (fwd ? fwd.split(",")[0] : h.get("x-real-ip")) ?? null;
  return { ip: ip?.trim() ?? null, userAgent: h.get("user-agent") };
}

/** Creates a session row and sets the cookie. Only callable from actions and route handlers. */
export async function createSession(userId: string, kind: Session["kind"] = "web", meta?: { sebConfigKey?: string; appVersion?: string }) {
  const token = newToken();
  const req = await requestMeta();
  const d = await db();
  await d.insert(sessions).values({
    id: sha256(token),
    userId,
    kind,
    expiresAt: new Date(Date.now() + SESSION_DAYS * 864e5),
    ip: req.ip,
    userAgent: req.userAgent?.slice(0, 400) ?? null,
    meta: meta ?? null,
  });
  await d.update(users).set({ lastSeenAt: new Date(), failedLogins: 0, lockedUntil: null }).where(eq(users.id, userId));
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  return token;
}

async function lookup(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  const d = await db();
  const rows = await d
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row || row.user.disabled) return null;
  // Touch at most every 5 minutes to keep writes low.
  if (Date.now() - row.session.lastSeenAt.getTime() > 5 * 60_000) {
    const now = new Date();
    await d.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, row.session.id));
    await d.update(users).set({ lastSeenAt: now }).where(eq(users.id, row.user.id));
  }
  return { id: row.session.id, kind: row.session.kind, user: row.user, meta: row.session.meta ?? null };
}

export const getSession = cache(async (): Promise<Session | null> => {
  const jar = await cookies();
  return lookup(jar.get(SESSION_COOKIE)?.value);
});

/** For route handlers that receive a Request directly. */
export async function sessionFromRequest(req: Request): Promise<Session | null> {
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return lookup(m ? decodeURIComponent(m[1]) : undefined);
}

export async function requireUser(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export async function requireAdmin(): Promise<Session> {
  const s = await requireUser();
  if (s.user.role !== "admin") redirect("/");
  return s;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const d = await db();
    await d.delete(sessions).where(eq(sessions.id, sha256(token)));
  }
  jar.delete(SESSION_COOKIE);
}

export function isAdmin(s: Session | null): boolean {
  return s?.user.role === "admin";
}
