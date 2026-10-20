import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { drillStats } from "@/lib/db/schema";
import { TOPICS } from "@/lib/drills/generators";
import { Page, PageHeader } from "@/components/ui/page";

export const metadata: Metadata = { title: "Drills" };

export default async function DrillsPage() {
  const { user } = await requireUser();
  const d = await db();
  const stats = new Map((await d.select().from(drillStats).where(eq(drillStats.userId, user.id))).map((s) => [s.topic, s]));
  return (
    <Page>
      <PageHeader title="Drills" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOPICS.map((t) => {
          const s = stats.get(t.id);
          return (
            <Link key={t.id} href={`/drills/${t.id}`} className="card group flex flex-col p-4 transition-colors hover:border-line-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{t.title}</div>
                  <div className="text-sm text-ink-3">{t.blurb}</div>
                </div>
                <ArrowRight className="size-4 text-ink-4 transition-transform group-hover:translate-x-0.5" />
              </div>
              <div className="mt-6 flex gap-5 text-xs text-ink-3">
                {s ? (
                  <>
                    <span>
                      <span className="num text-base font-semibold text-ink">{s.best}</span> best streak
                    </span>
                    <span>
                      <span className="num text-base font-semibold text-ink">{s.attempted ? Math.round((s.correct / s.attempted) * 100) : 0}%</span> right
                    </span>
                  </>
                ) : (
                  <span>Not tried yet</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </Page>
  );
}
