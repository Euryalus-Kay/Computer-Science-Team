import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { drillStats } from "@/lib/db/schema";
import { TOPIC_BY_ID } from "@/lib/drills/generators";
import { Page } from "@/components/ui/page";
import { DrillSession } from "@/components/drills/drill-session";

export async function generateMetadata(props: PageProps<"/drills/[topic]">): Promise<Metadata> {
  const { topic } = await props.params;
  return { title: TOPIC_BY_ID.get(topic)?.title ?? "Drills" };
}

export default async function DrillPage(props: PageProps<"/drills/[topic]">) {
  const { user } = await requireUser();
  const { topic } = await props.params;
  const t = TOPIC_BY_ID.get(topic);
  if (!t) notFound();
  const d = await db();
  const [s] = await d
    .select()
    .from(drillStats)
    .where(and(eq(drillStats.userId, user.id), eq(drillStats.topic, topic)))
    .limit(1);
  return (
    <Page className="max-w-[720px]">
      <DrillSession topic={t.id} title={t.title} best={s?.best ?? 0} />
    </Page>
  );
}
