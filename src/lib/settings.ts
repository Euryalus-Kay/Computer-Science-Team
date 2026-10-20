import { cache } from "react";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { newCode } from "@/lib/ids";
import { sql } from "drizzle-orm";

export type SiteSettings = {
  siteName: string;
  timezone: string;
  signupEnabled: boolean;
  joinCode: string;
  aiEnabled: boolean;
  aiModel: string;
  aiEffort: "low" | "medium" | "high";
  practiceLeaderboard: boolean;
  desktopMinVersion: string;
};

export const DEFAULT_SETTINGS: SiteSettings = {
  siteName: process.env.SITE_NAME || "Lab CS",
  timezone: process.env.SITE_TIMEZONE || "America/Chicago",
  signupEnabled: true,
  joinCode: "",
  aiEnabled: true,
  aiModel: "claude-opus-5-5",
  aiEffort: "low",
  practiceLeaderboard: true,
  // 1.0.1 signs its requests with DESKTOP_APP_SECRET; older copies are asked to update.
  desktopMinVersion: "1.0.1",
};

const KEY = "site";

export const getSettings = cache(async (): Promise<SiteSettings> => {
  const d = await db();
  const rows = await d.select().from(settings).where(sql`${settings.key} = ${KEY}`).limit(1);
  const stored = (rows[0]?.value ?? {}) as Partial<SiteSettings>;
  const merged = { ...DEFAULT_SETTINGS, ...stored };
  if (!merged.joinCode) {
    merged.joinCode = newCode(6);
    await saveSettings({ joinCode: merged.joinCode });
  }
  return merged;
});

export async function saveSettings(patch: Partial<SiteSettings>) {
  const d = await db();
  const rows = await d.select().from(settings).where(sql`${settings.key} = ${KEY}`).limit(1);
  const next = { ...((rows[0]?.value ?? {}) as Partial<SiteSettings>), ...patch };
  await d
    .insert(settings)
    .values({ key: KEY, value: next })
    .onConflictDoUpdate({ target: settings.key, set: { value: next, updatedAt: new Date() } });
}

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}
