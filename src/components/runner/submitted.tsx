import Link from "next/link";
import { CircleCheck, CircleX, CircleDashed, Clock } from "lucide-react";
import { LogoMark } from "@/components/shell/logo";
import { LinkButton } from "@/components/ui/button";
import { pts, humanDuration } from "./submitted-util";
import type { AnswerRow, AttemptRow, ContestRow } from "@/lib/tests/attempts";
import type { ItemRow } from "@/lib/items/engine";
import { DesktopDone } from "./desktop-done";

export function SubmittedView({
  contest,
  attempt,
  items,
  answers,
  visible,
}: {
  contest: ContestRow;
  attempt: AttemptRow;
  items: ItemRow[];
  answers: AnswerRow[];
  visible: boolean;
}) {
  const byItem = new Map(answers.map((a) => [a.itemId, a]));
  const used = (attempt.submittedAt ?? new Date()).getTime() - attempt.startedAt.getTime();
  const full = visible && contest.resultsDetail === "full";
  const ordered = attempt.order.length ? attempt.order.map((id) => items.find((i) => i.id === id)).filter(Boolean) as ItemRow[] : items;
  const pending = answers.some((a) => a.status === "pending");
  return (
    <div className="min-h-dvh">
      <header className="flex h-14 items-center gap-3 border-b border-line bg-panel px-4">
        <LogoMark size={22} className="text-ink" />
        <span className="font-semibold">{contest.title}</span>
      </header>
      <div className="mx-auto max-w-[760px] px-5 py-10">
        <DesktopDone />
        <div className="card p-6">
          <div className="flex items-start gap-4">
            <CircleCheck className="mt-0.5 size-6 text-accent" />
            <div className="flex-1">
              <h1 className="text-lg font-semibold">{attempt.status === "expired" ? "Time ran out. Your answers were submitted." : "Submitted"}</h1>
              <div className="mt-1 flex items-center gap-1.5 text-sm text-ink-3">
                <Clock className="size-3.5" /> {humanDuration(used)} used
                {attempt.isPreview && <span className="ml-2 rounded bg-blue-soft px-1.5 py-px text-xs font-medium text-blue">Preview</span>}
              </div>
            </div>
            {visible && (
              <div className="text-right">
                <div className="num text-3xl font-semibold tracking-[-0.02em]">
                  {pts(attempt.score)}
                  <span className="text-lg font-normal text-ink-3"> / {pts(attempt.maxScore)}</span>
                </div>
                {pending && <div className="text-xs text-amber">Some answers are still being graded</div>}
              </div>
            )}
          </div>
          {!visible && <p className="mt-4 text-sm text-ink-2">Your coach will share results later.</p>}
        </div>

        {full && (
          <div className="card mt-6 divide-y divide-line">
            {ordered.map((it, i) => {
              const a = byItem.get(it.id);
              const score = a?.score ?? null;
              const Icon = a?.status === "pending" ? CircleDashed : score !== null && score >= it.points ? CircleCheck : score && score > 0 ? CircleDashed : CircleX;
              const tone = a?.status === "pending" ? "text-amber" : score !== null && score >= it.points ? "text-accent" : score && score > 0 ? "text-amber" : "text-ink-4";
              return (
                <div key={it.id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="num w-6 font-mono text-xs text-ink-4">{i + 1}</span>
                    <Icon className={`size-4 shrink-0 ${tone}`} />
                    <span className="min-w-0 flex-1 truncate text-sm">{it.title || `Question ${i + 1}`}</span>
                    <span className="num text-sm text-ink-2">
                      {a?.status === "pending" ? "pending" : `${pts(score ?? 0)} / ${pts(it.points)}`}
                    </span>
                  </div>
                  {a?.feedback && <div className="mt-1.5 ml-[52px] text-sm text-ink-2">{a.feedback}</div>}
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-6 flex gap-2">
          <LinkButton href="/tests">Back to tests</LinkButton>
          <Link href="/" className="inline-flex h-8 items-center px-3 text-sm text-ink-3 hover:text-ink">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
