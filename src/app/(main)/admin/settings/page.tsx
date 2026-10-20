import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { aiConfigured, getSettings } from "@/lib/settings";
import { DESKTOP_VERSION } from "@/lib/desktop";
import { Page, PageHeader } from "@/components/ui/page";
import { SettingsForm } from "@/components/admin/settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireAdmin();
  const s = await getSettings();
  return (
    <Page className="max-w-[760px]">
      <PageHeader title="Settings" />
      <SettingsForm
        initial={{
          siteName: s.siteName,
          timezone: s.timezone,
          aiEnabled: s.aiEnabled,
          aiModel: s.aiModel,
          aiEffort: s.aiEffort,
          practiceLeaderboard: s.practiceLeaderboard,
          desktopMinVersion: s.desktopMinVersion,
        }}
        aiKey={aiConfigured()}
        desktopVersion={DESKTOP_VERSION}
        blob={Boolean(process.env.BLOB_READ_WRITE_TOKEN)}
      />
    </Page>
  );
}
