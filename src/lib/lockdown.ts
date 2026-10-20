import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const DESKTOP_HEADER = "x-labcs-desktop";
export const DESKTOP_SIG_HEADER = "x-labcs-sig";

/**
 * Requests from the desktop app carry its version and, when DESKTOP_APP_SECRET is
 * set on both sides, a short-lived HMAC so a browser extension can't fake the header.
 */
export function desktopInfo(headers: Headers): { ok: boolean; version: string | null } {
  const raw = headers.get(DESKTOP_HEADER);
  if (!raw) return { ok: false, version: null };
  const version = raw.split(";")[0]?.trim() || null;
  const secret = process.env.DESKTOP_APP_SECRET;
  if (!secret) return { ok: true, version };
  const sig = headers.get(DESKTOP_SIG_HEADER) ?? "";
  const [ts, mac] = sig.split(".");
  const t = Number(ts);
  if (!t || Math.abs(Date.now() - t) > 10 * 60_000 || !mac) return { ok: false, version };
  const expected = createHmac("sha256", secret).update(`${version}.${ts}`).digest("hex");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return { ok: a.length === b.length && timingSafeEqual(a, b), version };
}

/** Safe Exam Browser adds these headers to every request it makes. */
export function sebInfo(headers: Headers, url: string, configKey?: string | null): { ok: boolean; verified: boolean } {
  const ua = headers.get("user-agent") ?? "";
  const configHash = headers.get("x-safeexambrowser-configkeyhash");
  const requestHash = headers.get("x-safeexambrowser-requesthash");
  const looksLikeSeb = /\bSEB\//.test(ua) || Boolean(configHash || requestHash);
  if (!looksLikeSeb) return { ok: false, verified: false };
  if (!configKey) return { ok: true, verified: false };
  const clean = url.split("#")[0];
  const expected = createHash("sha256").update(clean + configKey).digest("hex");
  return { ok: configHash?.toLowerCase() === expected, verified: true };
}

/** Rebuilds the public URL of a request behind a proxy (Vercel sets x-forwarded-*). */
export function publicUrl(req: Request): string {
  const u = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? u.host;
  const proto = req.headers.get("x-forwarded-proto") ?? u.protocol.replace(":", "");
  return `${proto}://${host}${u.pathname}${u.search}`;
}
