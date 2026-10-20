"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { saveSettings, type SiteSettings } from "@/lib/settings";
import { askJson } from "@/lib/ai/client";
import { runOnce } from "@/lib/runner";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const MODELS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"];

export async function updateSettings(patch: Partial<Pick<SiteSettings, "siteName" | "timezone" | "aiEnabled" | "aiModel" | "aiEffort" | "practiceLeaderboard" | "desktopMinVersion">>): Promise<Result> {
  await requireAdmin();
  const clean: Partial<SiteSettings> = {};
  if (patch.siteName !== undefined) {
    const n = patch.siteName.trim();
    if (!n || n.length > 40) return { ok: false, error: "Site name must be 1 to 40 characters." };
    clean.siteName = n;
  }
  if (patch.timezone !== undefined) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: patch.timezone });
      clean.timezone = patch.timezone;
    } catch {
      return { ok: false, error: "Unknown time zone." };
    }
  }
  if (patch.aiEnabled !== undefined) clean.aiEnabled = Boolean(patch.aiEnabled);
  if (patch.aiModel !== undefined) {
    if (!MODELS.includes(patch.aiModel)) return { ok: false, error: "Unknown model." };
    clean.aiModel = patch.aiModel;
  }
  if (patch.aiEffort !== undefined) clean.aiEffort = (["low", "medium", "high"] as const).includes(patch.aiEffort) ? patch.aiEffort : "low";
  if (patch.practiceLeaderboard !== undefined) clean.practiceLeaderboard = Boolean(patch.practiceLeaderboard);
  if (patch.desktopMinVersion !== undefined) {
    if (!/^\d+\.\d+\.\d+$/.test(patch.desktopMinVersion)) return { ok: false, error: "Use a version like 1.0.0." };
    clean.desktopMinVersion = patch.desktopMinVersion;
  }
  await saveSettings(clean);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Adds the starter problems, tests and slides. Skips anything that already exists. */
export async function loadStarterContent(): Promise<Result> {
  const s = await requireAdmin();
  const { seedStarterContent } = await import("@/content/seed");
  await seedStarterContent(s.user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function testClaude(): Promise<Result<{ model: string; ms: number }>> {
  await requireAdmin();
  const t = Date.now();
  try {
    const { data, model } = await askJson<{ answer: number }>({
      system: "Answer with JSON only.",
      prompt: "What is 17 + 25?",
      maxTokens: 200,
      schema: { type: "object", properties: { answer: { type: "number" } }, required: ["answer"], additionalProperties: false },
    });
    if (data.answer !== 42) return { ok: false, error: `Claude answered ${data.answer}.` };
    return { ok: true, data: { model, ms: Date.now() - t } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function testRunner(): Promise<Result<{ provider: string; ms: number; output: string }>> {
  await requireAdmin();
  const t = Date.now();
  const r = await runOnce("python", "import sys\nprint(sum(map(int, sys.stdin.read().split())))", "20 22\n", { timeMs: 3000, memoryMb: 256 });
  if (r.status !== "ok") return { ok: false, error: r.message || r.stderr || r.status };
  return { ok: true, data: { provider: r.provider, ms: Date.now() - t, output: r.stdout.trim() } };
}
