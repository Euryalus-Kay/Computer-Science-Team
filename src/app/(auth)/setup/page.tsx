import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { AuthCard } from "@/components/auth/auth-card";
import { SetupForm } from "@/components/auth/forms";
import { NotConfigured } from "@/components/shell/not-configured";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { orNotConfigured, NOT_CONFIGURED } from "@/lib/db/guard";

export const metadata: Metadata = { title: "Set up" };

export default async function SetupPage() {
  const r = await orNotConfigured(async () => {
    const d = await db();
    const [{ count }] = await d.select({ count: sql<number>`count(*)::int` }).from(users);
    return count;
  });
  if (r === NOT_CONFIGURED) return <NotConfigured />;
  if (r > 0) redirect("/login");
  return (
    <AuthCard title="Set up the admin account" siteName={DEFAULT_SETTINGS.siteName}>
      <SetupForm needsToken={Boolean(process.env.SETUP_TOKEN)} />
    </AuthCard>
  );
}
