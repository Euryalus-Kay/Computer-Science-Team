import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ArrowRight, Pin, SquareTerminal, Target, Presentation, Timer } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { decks } from "@/lib/db/schema";
import { testsForUser } from "@/lib/tests/view";
import { listProblems } from "@/lib/problems";
import { postsForHome } from "@/lib/posts";
import { getSettings } from "@/lib/settings";
import { formatDate, relativeTime } from "@/lib/format";
import { Page } from "@/components/ui/page";
import { TestRow } from "@/components/tests/test-row";
import { Difficulty } from "@/components/problems/difficulty";

export default async function Home() {
  const { user } = await requireUser();
  const d = await db();
  const [tests, problems, posts, settings, recentDecks] = await Promise.all([
    testsForUser(user.id, user.role === "admin"),
    listProblems(user.id),
    postsForHome(8),
    getSettings(),
    d.select({ id: decks.id, title: decks.title, updatedAt: decks.updatedAt }).from(decks).where(eq(decks.published, true)).orderBy(desc(decks.updatedAt)).limit(3),
  ]);
  const active = tests.find((t) => t.mine.status === "active");
  const upcoming = tests
    .filter((t) => t.mine.status !== "done" && ["open", "waiting", "countdown", "scheduled"].includes(t.availability.state))
    .slice(0, 5);
  const solved = problems.filter((p) => p.solved).length;
  const next = problems.find((p) => !p.solved && p.tried) ?? problems.find((p) => !p.solved);
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: settings.timezone });

  return (
    <Page>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-[-0.015em]">Hi, {user.name.split(" ")[0]}</h1>
        <div className="text-sm text-ink-3">{today}</div>
      </div>

      {active && (
        <Link
          href={`/take/${active.mine.attemptId}`}
          className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-accent/30 bg-accent-soft px-5 py-4 text-accent-ink hover:border-accent/60"
        >
          <span className="flex items-center gap-3">
            <Timer className="size-5" />
            <span>
              <span className="block font-medium">{active.title}</span>
              <span className="text-sm opacity-80">In progress</span>
            </span>
          </span>
          <span className="flex items-center gap-1 text-sm font-medium">
            Resume <ArrowRight className="size-4" />
          </span>
        </Link>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-medium text-ink-3">Tests</h2>
              <Link href="/tests" className="text-xs text-ink-3 hover:text-ink">
                All tests
              </Link>
            </div>
            <div className="card divide-y divide-line overflow-hidden">
              {upcoming.length ? (
                upcoming.map((t) => <TestRow key={t.id} t={t} tz={settings.timezone} />)
              ) : (
                <div className="px-4 py-6 text-sm text-ink-3">Nothing open right now.</div>
              )}
            </div>
          </section>

          {posts.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-medium text-ink-3">Announcements</h2>
              <div className="card divide-y divide-line">
                {posts.map((p) => (
                  <article key={p.id} className="px-5 py-4">
                    <div className="mb-1.5 flex items-center gap-2 text-xs text-ink-3">
                      {p.pinned && <Pin className="size-3.5 text-accent" />}
                      {p.author ?? "Admin"} · {relativeTime(p.createdAt)}
                    </div>
                    <div className="prose" dangerouslySetInnerHTML={{ __html: p.html }} />
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <section className="card p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-medium">Practice</h2>
              <span className="num text-xs text-ink-3">
                {solved} / {problems.length} solved
              </span>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-panel-3">
              <div className="h-full rounded-full bg-accent" style={{ width: `${problems.length ? (solved / problems.length) * 100 : 0}%` }} />
            </div>
            {next && (
              <Link href={`/problems/${next.slug}`} className="group mt-4 flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2.5 hover:bg-panel-2">
                <span className="min-w-0">
                  <span className="block text-xs text-ink-3">{next.tried ? "Keep going" : "Up next"}</span>
                  <span className="block truncate text-sm font-medium group-hover:underline">{next.title}</span>
                </span>
                <Difficulty value={next.difficulty} />
              </Link>
            )}
          </section>

          <section className="card divide-y divide-line">
            {[
              { href: "/playground", label: "Playground", icon: SquareTerminal },
              { href: "/drills", label: "Drills", icon: Target },
              { href: "/slides", label: "Slides", icon: Presentation },
            ].map((l) => (
              <Link key={l.href} href={l.href} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-panel-2">
                <l.icon className="size-4 text-ink-3" />
                <span className="flex-1">{l.label}</span>
                <ArrowRight className="size-3.5 text-ink-4" />
              </Link>
            ))}
          </section>

          {recentDecks.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-medium text-ink-3">Latest slides</h2>
              <div className="card divide-y divide-line">
                {recentDecks.map((dk) => (
                  <Link key={dk.id} href={`/slides/${dk.id}`} className="block px-4 py-2.5 hover:bg-panel-2">
                    <div className="truncate text-sm font-medium">{dk.title}</div>
                    <div className="text-xs text-ink-3">{formatDate(dk.updatedAt, settings.timezone)}</div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </Page>
  );
}
