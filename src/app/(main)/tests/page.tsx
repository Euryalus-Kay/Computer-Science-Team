import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { testsForUser, type TestCard } from "@/lib/tests/view";
import { getSettings } from "@/lib/settings";
import { Page, PageHeader, Empty } from "@/components/ui/page";
import { TestRow } from "@/components/tests/test-row";

export const metadata: Metadata = { title: "Tests" };

export default async function TestsPage() {
  const { user } = await requireUser();
  const [tests, s] = await Promise.all([testsForUser(user.id, user.role === "admin"), getSettings()]);
  const now = tests.filter((t) => t.mine.status === "active" || (t.availability.state === "open" && t.mine.status !== "done"));
  const soon = tests.filter((t) => !now.includes(t) && ["waiting", "countdown", "scheduled"].includes(t.availability.state) && t.mine.status !== "done");
  const past = tests.filter((t) => !now.includes(t) && !soon.includes(t));
  const block = (title: string, list: TestCard[]) =>
    list.length > 0 && (
      <section className="mb-7">
        <h2 className="mb-2 text-sm font-medium text-ink-3">{title}</h2>
        <div className="card divide-y divide-line overflow-hidden">
          {list.map((t) => (
            <TestRow key={t.id} t={t} tz={s.timezone} />
          ))}
        </div>
      </section>
    );
  return (
    <Page>
      <PageHeader title="Tests" />
      {tests.length === 0 ? (
        <div className="card">
          <Empty title="No tests yet">Tests your coaches post show up here.</Empty>
        </div>
      ) : (
        <>
          {block("Available", now)}
          {block("Coming up", soon)}
          {block("Past", past)}
        </>
      )}
    </Page>
  );
}
