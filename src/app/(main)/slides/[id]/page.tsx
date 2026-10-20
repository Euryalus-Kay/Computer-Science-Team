import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Settings2 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { deckView } from "@/lib/decks";
import { Page } from "@/components/ui/page";
import { DeckViewer } from "@/components/slides/deck-viewer";

export async function generateMetadata(props: PageProps<"/slides/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const d = await deckView(id);
  return { title: d?.title ?? "Slides" };
}

export default async function DeckPage(props: PageProps<"/slides/[id]">) {
  const { user } = await requireUser();
  const { id } = await props.params;
  const deck = await deckView(id);
  const isAdmin = user.role === "admin";
  if (!deck || (!deck.published && !isAdmin)) notFound();
  return (
    <Page wide>
      <div className="mb-3 flex items-center justify-between">
        <Link href="/slides" className="text-xs text-ink-3 hover:text-ink">
          Slides
        </Link>
        {isAdmin && (
          <Link href={`/admin/slides/${deck.id}`} className="inline-flex items-center gap-1 text-xs text-ink-3 hover:text-ink">
            <Settings2 className="size-3.5" /> Edit
          </Link>
        )}
      </div>
      <DeckViewer deck={deck} isAdmin={isAdmin} />
    </Page>
  );
}
