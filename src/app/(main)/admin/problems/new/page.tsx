import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { aiConfigured, getSettings } from "@/lib/settings";
import { Page } from "@/components/ui/page";
import { ProblemEditor } from "@/components/admin/problem-editor";

export const metadata: Metadata = { title: "New problem" };

export default async function NewProblem() {
  await requireAdmin();
  const s = await getSettings();
  return (
    <Page wide>
      <ProblemEditor
        aiAvailable={aiConfigured() && s.aiEnabled}
        initial={{
          id: null,
          slug: "",
          title: "",
          statement: "",
          difficulty: "easy",
          tags: [],
          timeLimitMs: 2000,
          memoryLimitMb: 256,
          checker: "tokens",
          starter: {},
          published: true,
          tests: [],
        }}
      />
    </Page>
  );
}
