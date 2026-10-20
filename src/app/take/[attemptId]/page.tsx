import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getAnswers, getItems, loadAttempt, lockdownOk } from "@/lib/tests/attempts";
import { closeAttempt } from "@/lib/tests/close";
import { isExpired, isPaused, remainingMs } from "@/lib/tests/timing";
import { publicItem } from "@/lib/items/engine";
import { renderMarkdown } from "@/lib/markdown";
import { getProblemById, getTests } from "@/lib/problems";
import { resultsVisible } from "@/lib/tests/view";
import { desktopInfo } from "@/lib/lockdown";
import { Runner, type RunnerItem } from "@/components/runner/runner";
import { SubmittedView } from "@/components/runner/submitted";
import { LogoMark } from "@/components/shell/logo";
import { OpenInApp, OpenInSeb } from "@/components/tests/lockdown-launch";
import type { AnyConfig } from "@/lib/items/types";

export const metadata: Metadata = { title: "Test" };

export default async function TakePage(props: PageProps<"/take/[attemptId]">) {
  const session = await requireUser();
  const { attemptId } = await props.params;
  let loaded = await loadAttempt(attemptId);
  if (!loaded || loaded.attempt.userId !== session.user.id) notFound();
  if (loaded.attempt.status === "active" && isExpired(loaded.contest, loaded.attempt)) {
    await closeAttempt(attemptId, "expired");
    loaded = (await loadAttempt(attemptId))!;
  }
  const { attempt, contest } = loaded;
  const items = await getItems(contest.id);

  if (attempt.status !== "active") {
    const answers = await getAnswers(attempt.id);
    return <SubmittedView contest={contest} attempt={attempt} items={items} answers={answers} visible={resultsVisible(contest) || attempt.isPreview} />;
  }

  const lock = lockdownOk(contest, session, attempt.isPreview);
  const fromDesktop = session.kind === "desktop" && desktopInfo(await headers()).ok;
  if (!lock.ok || (session.kind === "desktop" && !fromDesktop && !attempt.isPreview)) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="w-full max-w-md">
          <LogoMark size={26} className="mb-6 text-ink" />
          <h1 className="text-xl font-semibold">{contest.title}</h1>
          <p className="mt-2 mb-6 text-sm text-ink-2">This test continues in lockdown mode. Your answers so far are saved.</p>
          <div className="space-y-3">
            {(contest.integrity.lockdown === "app" || contest.integrity.lockdown === "any") && <OpenInApp target={`/take/${attempt.id}`} />}
            {(contest.integrity.lockdown === "seb" || contest.integrity.lockdown === "any") && <OpenInSeb testId={contest.id} />}
          </div>
          <Link href="/tests" className="mt-8 inline-block text-sm text-ink-3 hover:text-ink">
            Back to tests
          </Link>
        </div>
      </div>
    );
  }

  const byId = new Map(items.map((i) => [i.id, i]));
  const ordered = attempt.order.map((id) => byId.get(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  // Items added after the attempt began go at the end.
  for (const it of items) if (!attempt.order.includes(it.id)) ordered.push(it);
  const runnerItems: RunnerItem[] = await Promise.all(
    ordered.map(async (it) => {
      const pub = await publicItem(it, attempt.seed);
      const r: RunnerItem = { ...pub, widget: it.type === "widget" ? String((it.config as AnyConfig).widget) : undefined };
      if (it.type === "code" && it.problemId) {
        const p = await getProblemById(it.problemId);
        if (p) {
          const samples = await getTests(p.id, true);
          r.problem = {
            title: p.title,
            statementHtml: (pub.promptHtml ?? "") + (await renderMarkdown(p.statement)),
            samples: samples.map((s) => ({ input: s.input, output: s.output, explanation: s.explanation })),
            timeLimitMs: p.timeLimitMs,
            memoryLimitMb: p.memoryLimitMb,
            starter: p.starter,
          };
          r.languages = (it.config as { languages?: string[] }).languages ?? null;
        }
      }
      return r;
    }),
  );
  const answers = await getAnswers(attempt.id);
  const resources = await Promise.all(
    (contest.resources ?? []).map(async (r) => ({ id: r.id, title: r.title, html: await renderMarkdown(r.body) })),
  );
  return (
    <Runner
      attemptId={attempt.id}
      preview={attempt.isPreview}
      contest={{ id: contest.id, slug: contest.slug, title: contest.title, integrity: contest.integrity }}
      items={runnerItems}
      answers={Object.fromEntries(answers.map((a) => [a.itemId, { response: a.response, state: a.state, status: a.status }]))}
      resources={resources}
      remainingMs={remainingMs(contest, attempt)}
      paused={!attempt.isPreview && isPaused(contest)}
      desktop={session.kind === "desktop"}
    />
  );
}
