import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Presentation } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { listDecks } from "@/lib/decks";
import { splitSlides } from "@/lib/board";
import { getSettings } from "@/lib/settings";
import { formatDate } from "@/lib/format";
import { Page, PageHeader, Empty } from "@/components/ui/page";
import { LinkButton } from "@/components/ui/button";
import { RowLink } from "@/components/ui/row-link";
import { DeckPublish } from "@/components/slides/deck-publish";

export const metadata: Metadata = { title: "Manage slides" };

const KIND = { markdown: "Slides", pdf: "PDF", link: "Link" };

export default async function AdminSlides() {
  await requireAdmin();
  const [rows, settings] = await Promise.all([listDecks(true), getSettings()]);
  const add = (
    <LinkButton href="/admin/slides/new" variant="primary" icon={<Plus className="size-4" />}>
      New deck
    </LinkButton>
  );
  return (
    <Page wide>
      <PageHeader title="Slides" meta={<span>{rows.length} decks</span>} actions={add} />
      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <Empty title="No slides yet" icon={<Presentation className="size-6" />} action={add} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th className="text-right">Slides</th>
                <th className="hidden md:table-cell">Updated</th>
                <th>Visible</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <RowLink key={d.id} href={`/admin/slides/${d.id}`}>
                  <td>
                    <Link href={`/admin/slides/${d.id}`} className="font-medium hover:underline">
                      {d.title}
                    </Link>
                  </td>
                  <td className="text-ink-2">{KIND[d.kind]}</td>
                  <td className="num text-right text-ink-2">{d.kind === "markdown" ? splitSlides(d.body).length : "–"}</td>
                  <td className="hidden text-ink-3 md:table-cell">{formatDate(d.updatedAt, settings.timezone)}</td>
                  <td>
                    <DeckPublish id={d.id} published={d.published} />
                  </td>
                </RowLink>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Page>
  );
}
