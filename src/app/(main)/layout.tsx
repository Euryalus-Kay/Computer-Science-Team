import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { sql } from "drizzle-orm";
import { Sidebar } from "@/components/shell/sidebar";
import { NotConfigured } from "@/components/shell/not-configured";
import { TempPasswordBanner } from "@/components/shell/temp-password";
import { getSession } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { activeAttemptFor } from "@/lib/tests/active";
import { orNotConfigured, NOT_CONFIGURED } from "@/lib/db/guard";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const r = await orNotConfigured(async () => {
    const session = await getSession();
    if (!session) {
      const d = await db();
      const [{ count }] = await d.select({ count: sql<number>`count(*)::int` }).from(users);
      return { session: null, empty: count === 0 } as const;
    }
    const [settings, active] = await Promise.all([getSettings(), activeAttemptFor(session.user.id)]);
    return { session, settings, active, empty: false } as const;
  });
  if (r === NOT_CONFIGURED) return <NotConfigured />;
  if (!r.session) redirect(r.empty ? "/setup" : "/login");
  const collapsed = (await cookies()).get("lcs_nav")?.value === "collapsed";
  const { user } = r.session;
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <Sidebar
        user={{ name: user.name, username: user.username, role: user.role }}
        siteName={r.settings.siteName}
        initialCollapsed={collapsed}
        active={r.active}
      />
      <main className="min-w-0 flex-1">
        {user.mustChangePassword && <TempPasswordBanner />}
        {children}
      </main>
    </div>
  );
}
