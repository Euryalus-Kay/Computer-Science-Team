import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { Page, PageHeader } from "@/components/ui/page";
import { PasswordForm } from "@/components/account/password-form";
import { Avatar } from "@/components/ui/avatar";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const { user } = await requireUser();
  return (
    <Page className="max-w-[720px]">
      <PageHeader title="Account" />
      <div className="card mb-6 flex items-center gap-4 p-4">
        <Avatar name={user.name} size={44} />
        <div>
          <div className="text-md font-semibold">{user.name}</div>
          <div className="font-mono text-sm text-ink-3">@{user.username}</div>
        </div>
      </div>
      <div className="card p-5">
        <h2 className="mb-1 text-md font-semibold">Password</h2>
        {user.mustChangePassword && (
          <p className="mb-4 text-sm text-amber">You are using a temporary password. Pick your own.</p>
        )}
        <PasswordForm />
      </div>
    </Page>
  );
}
