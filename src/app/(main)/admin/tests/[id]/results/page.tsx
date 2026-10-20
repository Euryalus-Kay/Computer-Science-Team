import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { groups } from "@/lib/db/schema";
import { getContest } from "@/lib/tests/attempts";
import { loadResults } from "@/lib/admin/results";
import { aiConfigured, getSettings } from "@/lib/settings";
import { ResultsView } from "@/components/admin/tests/results-view";

export const metadata: Metadata = { title: "Results" };

export default async function TestResults(props: PageProps<"/admin/tests/[id]/results">) {
  await requireAdmin();
  const { id } = await props.params;
  const c = await getContest(id);
  if (!c) notFound();
  const d = await db();
  const [data, gs, settings] = await Promise.all([
    loadResults(c),
    d.select({ id: groups.id, name: groups.name }).from(groups).orderBy(asc(groups.name)),
    getSettings(),
  ]);
  return <ResultsView testId={c.id} data={data} groups={gs} aiReady={aiConfigured() && settings.aiEnabled} />;
}
