import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { groupMembers, groups, users } from "@/lib/db/schema";
import { getSettings } from "@/lib/settings";
import { Page, PageHeader } from "@/components/ui/page";
import { MembersView } from "@/components/admin/members-view";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage() {
  const me = await requireAdmin();
  const d = await db();
  const [rows, groupRows, links, settings] = await Promise.all([
    d.select().from(users).orderBy(asc(users.name)),
    d.select().from(groups).orderBy(asc(groups.name)),
    d.select().from(groupMembers),
    getSettings(),
  ]);
  const byUser = new Map<string, string[]>();
  for (const l of links) byUser.set(l.userId, [...(byUser.get(l.userId) ?? []), l.groupId]);
  const members = rows.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    role: u.role,
    isOwner: u.isOwner,
    disabled: u.disabled,
    grade: u.grade,
    notes: u.notes,
    mustChangePassword: u.mustChangePassword,
    lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    groups: byUser.get(u.id) ?? [],
  }));
  return (
    <Page wide>
      <PageHeader title="Members" meta={<span>{members.length} accounts</span>} />
      <MembersView
        meId={me.user.id}
        members={members}
        groups={groupRows.map((g) => ({ id: g.id, name: g.name, color: g.color }))}
        signupEnabled={settings.signupEnabled}
        joinCode={settings.joinCode}
      />
    </Page>
  );
}
