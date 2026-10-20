import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { getContest } from "@/lib/tests/attempts";
import { liveSnapshot } from "@/lib/admin/live";
import { getSettings } from "@/lib/settings";
import { LiveMonitor } from "@/components/admin/tests/live-monitor";

export const metadata: Metadata = { title: "Monitor" };

export default async function TestMonitor(props: PageProps<"/admin/tests/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  const c = await getContest(id);
  if (!c) notFound();
  const [snap, settings] = await Promise.all([liveSnapshot(c), getSettings()]);
  return (
    <LiveMonitor
      test={{
        id: c.id,
        status: c.status,
        startMode: c.startMode,
        durationMin: c.durationMin,
        lockdown: c.integrity?.lockdown ?? "none",
        exitCode: c.integrity?.exitCode ?? "",
        timezone: settings.timezone,
      }}
      initial={snap}
    />
  );
}
