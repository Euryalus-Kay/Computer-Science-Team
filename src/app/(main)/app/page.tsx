import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { DESKTOP_VERSION } from "@/lib/desktop";
import { Page, PageHeader } from "@/components/ui/page";
import { AppSetup } from "@/components/tests/app-setup";

export const metadata: Metadata = { title: "Desktop app" };

export default async function AppPage() {
  const { user } = await requireUser();
  return (
    <Page className="max-w-[760px]">
      <PageHeader title="Lab CS app" meta={<span>Version {DESKTOP_VERSION}</span>} />
      <AppSetup lastUsed={user.desktopSeenAt?.toISOString() ?? null} />
    </Page>
  );
}
