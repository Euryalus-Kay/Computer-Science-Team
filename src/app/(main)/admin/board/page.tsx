import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { boardPayload } from "@/lib/board";
import { boardOptions } from "@/lib/board-options";
import { ExternalLink } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { LinkButton } from "@/components/ui/button";
import { BoardRemote } from "@/components/board/remote";

export const metadata: Metadata = { title: "Board remote" };

export default async function BoardRemotePage() {
  await requireAdmin();
  const [payload, opts] = await Promise.all([boardPayload(), boardOptions()]);
  return (
    <Page wide>
      <PageHeader
        title="Board"
        actions={
          <LinkButton href="/board" target="_blank" variant="primary" icon={<ExternalLink className="size-4" />}>
            Open on projector
          </LinkButton>
        }
      />
      <BoardRemote initial={payload} tests={opts.tests} decks={opts.decks} />
    </Page>
  );
}
