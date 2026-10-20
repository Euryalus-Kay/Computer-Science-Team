import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { getContest, getItems } from "@/lib/tests/attempts";
import { testStatus } from "@/lib/tests/status";
import { pts } from "@/lib/format";
import { Page, PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { TestTabs } from "@/components/admin/tests/test-tabs";
import { TestHeaderActions } from "@/components/admin/tests/header-actions";

export default async function TestAdminLayout(props: LayoutProps<"/admin/tests/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  const c = await getContest(id);
  if (!c) notFound();
  const items = await getItems(c.id);
  const st = testStatus(c);
  return (
    <Page wide>
      <PageHeader
        crumbs={[{ href: "/admin/tests", label: "Tests" }]}
        title={
          <span className="flex items-center gap-2.5">
            <span className="truncate">{c.title}</span>
            <Badge tone={st.tone} dot={st.live}>
              {st.label}
            </Badge>
          </span>
        }
        meta={
          <>
            <span>{c.startMode === "live" ? "Everyone starts together" : "Members start on their own"}</span>
            {c.durationMin && <span>{c.durationMin} min</span>}
            <span>
              {items.length} questions · {pts(items.reduce((s, i) => s + i.points, 0))} points
            </span>
          </>
        }
        actions={<TestHeaderActions id={c.id} slug={c.slug} status={c.status} title={c.title} />}
      />
      <div className="mb-6">
        <TestTabs id={c.id} />
      </div>
      {props.children}
    </Page>
  );
}
