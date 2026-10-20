import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { boardPayload } from "@/lib/board";
import { boardOptions } from "@/lib/board-options";
import { BoardApp } from "@/components/board/board";

export const metadata: Metadata = { title: "Board" };

export default async function BoardPage() {
  await requireAdmin();
  const [payload, opts] = await Promise.all([boardPayload(), boardOptions()]);
  return <BoardApp initial={payload} tests={opts.tests} decks={opts.decks} />;
}
