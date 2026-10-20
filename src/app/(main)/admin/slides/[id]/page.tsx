import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { decks, files } from "@/lib/db/schema";
import { Page, PageHeader } from "@/components/ui/page";
import { DeckEditor } from "@/components/slides/deck-editor";
import type { DeckInput } from "@/lib/admin/decks";

export const metadata: Metadata = { title: "Edit slides" };

const STARTER = `# Title

A short subtitle

---

## A point

- One idea per slide
- Code blocks work too

\`\`\`python
print(sum(range(1, 11)))
\`\`\`
`;

export default async function EditDeck(props: PageProps<"/admin/slides/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  const d = await db();
  let initial: DeckInput = { id: null, title: "", kind: "markdown", body: STARTER, url: null, fileId: null, published: true };
  let fileName: string | null = null;
  if (id !== "new") {
    const [row] = await d.select().from(decks).where(eq(decks.id, id)).limit(1);
    if (!row) notFound();
    initial = { id: row.id, title: row.title, kind: row.kind, body: row.body, url: row.url, fileId: row.fileId, published: row.published };
    if (row.fileId) fileName = (await d.select({ name: files.name }).from(files).where(eq(files.id, row.fileId)).limit(1))[0]?.name ?? null;
  }
  return (
    <Page wide>
      <PageHeader crumbs={[{ href: "/admin/slides", label: "Slides" }]} title={initial.id ? initial.title : "New deck"} />
      <DeckEditor initial={initial} fileName={fileName} blob={Boolean(process.env.BLOB_READ_WRITE_TOKEN)} />
    </Page>
  );
}
