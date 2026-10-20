import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Settings2 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getContest, getItems, attemptsFor, userGroupIds, visibleTo, lockdownOk } from "@/lib/tests/attempts";
import { availability } from "@/lib/tests/timing";
import { resultsVisible } from "@/lib/tests/view";
import { renderMarkdown } from "@/lib/markdown";
import { getSettings } from "@/lib/settings";
import { Page } from "@/components/ui/page";
import { TestLobby } from "@/components/tests/lobby";

export async function generateMetadata(props: PageProps<"/tests/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const c = await getContest(slug);
  return { title: c?.title ?? "Test" };
}

export default async function TestPage(props: PageProps<"/tests/[slug]">) {
  const session = await requireUser();
  const { user } = session;
  const { slug } = await props.params;
  const c = await getContest(slug);
  if (!c) notFound();
  const isAdmin = user.role === "admin";
  const groups = await userGroupIds(user.id);
  if (!visibleTo(c, user.id, groups, isAdmin)) notFound();
  const [items, mine, html, settings] = await Promise.all([
    getItems(c.id),
    attemptsFor(c.id, user.id),
    renderMarkdown(c.description),
    getSettings(),
  ]);
  const real = mine.filter((a) => !a.isPreview);
  const active = real.find((a) => a.status === "active") ?? null;
  const showScores = resultsVisible(c);
  const lock = lockdownOk(c, session, false);
  return (
    <Page className="max-w-[860px]">
      <div className="mb-2 flex items-center justify-between">
        <Link href="/tests" className="text-xs text-ink-3 hover:text-ink">
          Tests
        </Link>
        {isAdmin && (
          <Link href={`/admin/tests/${c.id}`} className="inline-flex items-center gap-1 text-xs text-ink-3 hover:text-ink">
            <Settings2 className="size-3.5" /> Manage
          </Link>
        )}
      </div>
      <TestLobby
        test={{
          id: c.id,
          slug: c.slug,
          title: c.title,
          descriptionHtml: html,
          durationMin: c.durationMin,
          questions: items.length,
          points: items.reduce((s, i) => s + i.points, 0),
          startMode: c.startMode,
          lockdown: c.integrity?.lockdown ?? "none",
          camera: Boolean(c.integrity?.camera),
          fullscreen: Boolean(c.integrity?.requireFullscreen),
          needsCode: c.visibility === "code" && !isAdmin,
          maxAttempts: c.maxAttempts,
          timezone: settings.timezone,
        }}
        initialState={availability(c)}
        sessionKind={session.kind}
        lockdownOk={lock.ok}
        isAdmin={isAdmin}
        active={active ? { id: active.id } : null}
        past={real
          .filter((a) => a.status !== "active")
          .map((a) => ({
            id: a.id,
            submittedAt: (a.submittedAt ?? a.startedAt).toISOString(),
            score: showScores ? a.score : null,
            maxScore: a.maxScore,
            status: a.status,
          }))}
      />
    </Page>
  );
}
