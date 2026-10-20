import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/forms";
import { NotConfigured } from "@/components/shell/not-configured";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { orNotConfigured, NOT_CONFIGURED } from "@/lib/db/guard";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const r = await orNotConfigured(async () => {
    const d = await db();
    const [{ count }] = await d.select({ count: sql<number>`count(*)::int` }).from(users);
    return { count, session: await getSession(), settings: await getSettings() };
  });
  if (r === NOT_CONFIGURED) return <NotConfigured />;
  if (r.count === 0) redirect("/setup");
  const { next } = await searchParams;
  if (r.session) redirect(next && next.startsWith("/") ? next : "/");
  return (
    <AuthCard title="Sign in" siteName={r.settings.siteName}>
      <LoginForm next={next} signupEnabled={r.settings.signupEnabled} />
    </AuthCard>
  );
}
