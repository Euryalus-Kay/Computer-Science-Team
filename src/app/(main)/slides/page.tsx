import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Presentation, Link2 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listDecks } from "@/lib/decks";
import { splitSlides } from "@/lib/board";
import { getSettings } from "@/lib/settings";
import { formatDate } from "@/lib/format";
import { Page, PageHeader, Empty } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Slides" };

const ICON = { markdown: Presentation, pdf: FileText, link: Link2 };

export default async function SlidesPage() {
  const { user } = await requireUser();
  const isAdmin = user.role === "admin";
  const [rows, settings] = await Promise.all([listDecks(isAdmin), getSettings()]);
  return (
    <Page>
      <PageHeader title="Slides" />
      {rows.length === 0 ? (
        <div className="card">
          <Empty title="No slides yet" icon={<Presentation className="size-6" />} />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((d) => {
            const Icon = ICON[d.kind];
            const count = d.kind === "markdown" ? splitSlides(d.body).length : null;
            return (
              <Link key={d.id} href={`/slides/${d.id}`} className="card group flex flex-col p-4 transition-colors hover:border-line-2">
                <div className="mb-6 flex items-start justify-between gap-2">
                  <Icon className="size-5 text-ink-3" />
                  {!d.published && <Badge tone="outline">Draft</Badge>}
                </div>
                <div className="font-medium group-hover:underline">{d.title}</div>
                <div className="mt-1 text-xs text-ink-3">
                  {formatDate(d.updatedAt, settings.timezone)}
                  {count ? ` · ${count} slides` : d.kind === "pdf" ? " · PDF" : d.kind === "link" ? " · Link" : ""}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Page>
  );
}
