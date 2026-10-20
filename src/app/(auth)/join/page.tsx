import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { JoinForm } from "@/components/auth/forms";
import { NotConfigured } from "@/components/shell/not-configured";
import { getSession } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { orNotConfigured, NOT_CONFIGURED } from "@/lib/db/guard";

export const metadata: Metadata = { title: "Join" };

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const r = await orNotConfigured(async () => ({ session: await getSession(), settings: await getSettings() }));
  if (r === NOT_CONFIGURED) return <NotConfigured />;
  if (r.session) redirect("/");
  const { code } = await searchParams;
  return (
    <AuthCard title="Create your account" siteName={r.settings.siteName}>
      {r.settings.signupEnabled ? (
        <JoinForm code={code} />
      ) : (
        <div className="space-y-4 text-sm text-ink-2">
          <p>Sign-up is closed right now. Ask an admin to add you.</p>
          <Link href="/login" className="font-medium text-ink hover:underline">
            Back to sign in
          </Link>
        </div>
      )}
    </AuthCard>
  );
}
