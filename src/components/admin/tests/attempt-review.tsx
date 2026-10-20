"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CircleCheck,
  CircleX,
  CircleDashed,
  Circle,
  ChevronDown,
  ChevronRight,
  Sparkles,
  MoreHorizontal,
  Plus,
  Send,
  Undo2,
  Trash2,
  Check,
  MonitorSmartphone,
  ShieldCheck,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { ItemView } from "@/components/items/item-view";
import { cn } from "@/lib/cn";
import { pts, formatDateTime } from "@/lib/format";
import type { AiReview, AttemptClient, IntegritySummary } from "@/lib/db/schema";
import type { PublicItem } from "@/lib/items/types";
import {
  addAttemptTime,
  aiReviewAttempt,
  deleteAttempt,
  forceSubmit,
  regradeWithAi,
  reopenAttempt,
  setAnswerScore,
  setReviewed,
} from "@/lib/admin/tests";
import { LevelPill, clock } from "./bits";

export type ReviewItem = {
  id: string;
  n: number;
  title: string;
  section: string | null;
  type: string;
  widget?: string;
  points: number;
  grading: string;
  promptHtml: string;
  pub: PublicItem;
  key: string | null;
  rubric: string | null;
  answer: {
    response: unknown;
    state: unknown;
    score: number | null;
    status: string;
    feedback: string | null;
    note: string | null;
    gradedBy: string | null;
    timeSpentMs: number;
    saves: number;
    firstSavedAt: number | null;
  } | null;
  code: { language: string; code: string; verdict: string | null; passed: number; total: number; count: number } | null;
};

type Ev = { id: number; at: number; type: string; label: string; severity: string; item: string | null; data: Record<string, unknown> | null };

type Act = (p: Promise<{ ok: boolean; error?: string }>, done?: string) => void;

const VERDICT: Record<string, { label: string; tone: "neutral" | "amber" | "red" | "green" }> = {
  no_concern: { label: "No concern", tone: "green" },
  minor: { label: "Minor", tone: "neutral" },
  review: { label: "Worth a look", tone: "amber" },
  likely: { label: "Likely outside help", tone: "red" },
};

export function AttemptReview({
  testId,
  timezone,
  aiReady,
  attempt,
  user,
  summary,
  items,
  events,
}: {
  testId: string;
  timezone: string;
  aiReady: boolean;
  attempt: {
    id: string;
    status: "active" | "submitted" | "expired";
    preview: boolean;
    score: number;
    maxScore: number;
    startedAt: number;
    submittedAt: number | null;
    remainingMs: number | null;
    reached: number;
    client: AttemptClient;
    reviewed: boolean;
    aiReview: AiReview | null;
    extraSeconds: number;
  };
  user: { id: string; name: string; username: string; grade: string | null };
  summary: IntegritySummary | null;
  items: ReviewItem[];
  events: Ev[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const act: Act = (p, done) =>
    start(async () => {
      const r = await p;
      if (!r.ok) toast(r.error ?? "Something went wrong", "error");
      else if (done) toast(done);
      router.refresh();
    });
  const used = (attempt.submittedAt ?? Date.now()) - attempt.startedAt;
  const answered = items.filter((i) => i.answer && i.answer.status !== "empty").length;
  const ClientIcon = attempt.client.kind === "desktop" ? MonitorSmartphone : attempt.client.kind === "seb" ? ShieldCheck : Globe;

  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-start justify-between gap-5 p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{user.name}</h2>
            <span className="text-sm text-ink-3">@{user.username}</span>
            {attempt.preview && <Badge tone="blue">Preview</Badge>}
            {attempt.status === "active" ? (
              <Badge tone="green" dot>
                Working{attempt.remainingMs !== null ? ` · ${clock(attempt.remainingMs)} left` : ""}
              </Badge>
            ) : (
              <Badge>{attempt.status === "expired" ? "Time ran out" : "Submitted"}</Badge>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-3">
            <span>Started {formatDateTime(attempt.startedAt, timezone)}</span>
            <span>{Math.round(used / 60000)} min used</span>
            <span>
              Reached question {attempt.reached} · {answered} answered
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ClientIcon className="size-3.5" />
              {attempt.client.kind === "desktop"
                ? `Lab CS app${attempt.client.appVersion ? ` ${attempt.client.appVersion}` : ""}`
                : attempt.client.kind === "seb"
                  ? "Safe Exam Browser"
                  : "Browser"}
            </span>
            {attempt.extraSeconds !== 0 && <span>{Math.round(attempt.extraSeconds / 60)} min extra time</span>}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="num text-3xl font-semibold tracking-[-0.02em]">
              {pts(attempt.score)}
              <span className="text-lg font-normal text-ink-4"> / {pts(attempt.maxScore)}</span>
            </div>
            <div className="text-xs text-ink-3">{attempt.maxScore ? Math.round((attempt.score / attempt.maxScore) * 100) : 0}%</div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              icon={attempt.reviewed ? <Check className="size-4" /> : undefined}
              variant={attempt.reviewed ? "secondary" : "primary"}
              disabled={pending}
              onClick={() => act(setReviewed(attempt.id, !attempt.reviewed))}
            >
              {attempt.reviewed ? "Reviewed" : "Mark reviewed"}
            </Button>
            <Menu
              trigger={({ toggle }) => (
                <Button onClick={toggle} className="px-2" aria-label="More">
                  <MoreHorizontal className="size-4" />
                </Button>
              )}
            >
              {(close) => (
                <>
                  {attempt.status === "active" ? (
                    <>
                      <MenuItem icon={<Plus />} onClick={() => (close(), act(addAttemptTime(attempt.id, 300), "Added 5 minutes"))}>
                        Give 5 more minutes
                      </MenuItem>
                      <MenuItem icon={<Send />} onClick={() => (close(), act(forceSubmit(attempt.id), "Submitted"))}>
                        Submit for them
                      </MenuItem>
                    </>
                  ) : (
                    <MenuItem icon={<Undo2 />} onClick={() => (close(), act(reopenAttempt(attempt.id, 5), "Reopened with 5 minutes"))}>
                      Reopen with 5 minutes
                    </MenuItem>
                  )}
                  <MenuSeparator />
                  <MenuItem
                    danger
                    icon={<Trash2 />}
                    onClick={() => {
                      close();
                      if (confirm(`Delete ${user.name}'s attempt? They will be able to take the test again.`)) {
                        start(async () => {
                          await deleteAttempt(attempt.id);
                          router.push(`/admin/tests/${testId}/results`);
                        });
                      }
                    }}
                  >
                    Delete attempt
                  </MenuItem>
                </>
              )}
            </Menu>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-3">
          {items.map((it) => (
            <QuestionCard key={it.id} it={it} attemptId={attempt.id} act={act} pending={pending} aiReady={aiReady} />
          ))}
        </div>
        <div className="space-y-5 xl:sticky xl:top-5 xl:self-start">
          <IntegrityCard summary={summary} review={attempt.aiReview} attemptId={attempt.id} act={act} pending={pending} aiReady={aiReady} />
          <Timeline events={events} startedAt={attempt.startedAt} />
        </div>
      </div>
    </div>
  );
}

function responseText(it: ReviewItem): string | null {
  const r = it.answer?.response as Record<string, unknown> | null | undefined;
  if (!r) return null;
  const data = it.pub.data as Record<string, unknown>;
  if (typeof r.text === "string") return r.text || null;
  if (typeof r.value === "string") return r.value || null;
  if (typeof r.code === "string") return null;
  if (typeof r.choice === "number") {
    const list = (data.options ?? data.names) as string[] | undefined;
    return list?.[r.choice] ?? `Choice ${r.choice + 1}`;
  }
  if (Array.isArray(r.choices)) return (r.choices as number[]).map((i) => (data.options as string[])?.[i] ?? i).join("; ");
  if (Array.isArray(r.order)) {
    const its = data.items as { id: string; text: string }[] | undefined;
    return (r.order as string[]).map((id) => its?.find((x) => x.id === id)?.text ?? id).join(" → ");
  }
  if (it.widget === "gears") return [r.dir === "cw" ? "Clockwise" : r.dir === "ccw" ? "Counterclockwise" : null, r.turns ? `${r.turns} turns` : null].filter(Boolean).join(", ") || null;
  if (it.widget === "circuit" && Array.isArray(r.bits)) return (r.bits as boolean[]).map((b, i) => `${"ABCD"[i]} ${b ? "on" : "off"}`).join(", ");
  if (it.widget === "robot-trace" && Array.isArray(r.cell)) return `column ${(r.cell as number[])[0] + 1}, row ${(r.cell as number[])[1] + 1}`;
  if (it.widget === "network" && Array.isArray(r.path)) return (r.path as string[]).join(" → ");
  if (it.widget === "scale") return r.pick != null ? `Picked coin ${Number(r.pick) + 1} after ${(r.weighings as unknown[])?.length ?? 0} weighings` : null;
  if (it.widget === "lights" && Array.isArray(r.presses)) return `${r.presses.length} presses`;
  if (it.widget === "rail" && Array.isArray(r.moves)) return `${r.moves.length} moves`;
  if (it.widget === "robot-build" && Array.isArray(r.program)) return `Program with ${r.program.length} blocks`;
  return null;
}

function QuestionCard({ it, attemptId, act, pending, aiReady }: { it: ReviewItem; attemptId: string; act: Act; pending: boolean; aiReady: boolean }) {
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(it.answer?.score != null ? String(it.answer.score) : "");
  const [feedback, setFeedback] = useState(it.answer?.feedback ?? "");
  const a = it.answer;
  const st = a?.status ?? "empty";
  const s = a?.score ?? null;
  const Icon = st === "pending" ? CircleDashed : st === "empty" ? Circle : s !== null && s >= it.points ? CircleCheck : s && s > 0 ? CircleDashed : CircleX;
  const tone = st === "pending" ? "text-blue" : st === "empty" ? "text-ink-4" : s !== null && s >= it.points ? "text-accent" : s && s > 0 ? "text-amber" : "text-red";
  const text = responseText(it);
  const changed = score !== (a?.score != null ? String(a.score) : "") || feedback !== (a?.feedback ?? "");
  const lockState = it.widget === "lock" ? (a?.state as { guesses?: { guess: string }[] } | null) : null;

  return (
    <div className="card">
      <div className="flex items-start gap-3 px-4 py-3">
        <Icon className={cn("mt-0.5 size-[18px] shrink-0", tone)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="num font-mono text-xs text-ink-4">{it.n}</span>
            <span className="font-medium">{it.title}</span>
            {it.section && <span className="text-xs text-ink-4">{it.section}</span>}
            {it.grading !== "auto" && <Badge tone={it.grading === "ai" ? "blue" : "outline"}>{it.grading === "ai" ? "Claude" : "By hand"}</Badge>}
          </div>
          <div className="mt-0.5 text-xs text-ink-4">
            {a?.timeSpentMs ? `${Math.round(a.timeSpentMs / 1000)} s on it` : "not opened"}
            {a?.saves ? ` · ${a.saves} save${a.saves === 1 ? "" : "s"}` : ""}
            {a?.gradedBy ? ` · ${a.gradedBy === "ai" ? "graded by Claude" : a.gradedBy === "admin" ? "graded by hand" : "auto-graded"}` : ""}
          </div>

          <dl className="mt-2.5 grid gap-1.5 text-sm">
            {it.type === "code" ? (
              it.code ? (
                <div>
                  <dt className="text-xs text-ink-3">
                    Best submission · {it.code.language} · {it.code.passed}/{it.code.total} tests · {it.code.count} submission{it.code.count === 1 ? "" : "s"}
                  </dt>
                  <dd>
                    <pre className="mt-1 max-h-72 overflow-auto rounded-md bg-[var(--code-bg)] p-3 font-mono text-xs leading-relaxed">{it.code.code}</pre>
                  </dd>
                </div>
              ) : (
                <div className="text-ink-3">No submissions.</div>
              )
            ) : (
              <>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-ink-3">Answer</dt>
                  <dd className={cn("min-w-0 break-words whitespace-pre-wrap", !text && !lockState && "text-ink-4")}>
                    {lockState?.guesses?.length
                      ? lockState.guesses.map((g) => g.guess).join(", ")
                      : typeof (a?.response as { code?: string } | null)?.code === "string"
                        ? <pre className="max-h-60 overflow-auto rounded-md bg-[var(--code-bg)] p-2.5 font-mono text-xs">{(a!.response as { code: string }).code}</pre>
                        : text ?? (a && st !== "empty" ? "See the question" : "Not answered")}
                  </dd>
                </div>
                {it.key && (
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-ink-3">Key</dt>
                    <dd className="min-w-0 break-words text-ink-2">{it.key}</dd>
                  </div>
                )}
              </>
            )}
          </dl>

          {a?.note && (
            <div className="mt-2.5 rounded-md bg-blue-soft/60 px-3 py-2 text-sm text-ink-2">
              <span className="mr-1 inline-flex items-center gap-1 font-medium text-blue">
                <Sparkles className="size-3.5" /> Claude:
              </span>
              {a.note}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 text-xs text-ink-3 hover:text-ink">
              {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
              {open ? "Hide question" : "Show question"}
            </button>
            {(it.type === "text" || it.grading === "ai") && a?.response != null && (
              <Button
                size="xs"
                variant="ghost"
                icon={<Sparkles className="size-3" />}
                disabled={pending || !aiReady}
                onClick={() => act(regradeWithAi(attemptId, it.id), "Graded with Claude")}
              >
                {a.gradedBy === "ai" ? "Grade again with Claude" : "Grade with Claude"}
              </Button>
            )}
          </div>

          {open && (
            <div className="mt-3 rounded-lg border border-line p-4">
              <div className="prose mb-4" dangerouslySetInnerHTML={{ __html: it.promptHtml }} />
              {it.type !== "code" && (
                <ItemView
                  item={it.pub}
                  widget={it.widget}
                  value={(a?.response as never) ?? null}
                  state={(a?.state as never) ?? null}
                  onChange={() => {}}
                  interact={async () => null}
                  disabled
                />
              )}
              {it.rubric && (
                <div className="mt-4 border-t border-line pt-3">
                  <div className="mb-1 text-xs font-medium text-ink-3">Rubric</div>
                  <div className="text-sm whitespace-pre-wrap text-ink-2">{it.rubric}</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="flex items-center gap-1">
            <input
              value={score}
              onChange={(e) => setScore(e.target.value.replace(/[^0-9.]/g, ""))}
              className="field field-sm num w-14 text-right"
              aria-label="Score"
              placeholder="–"
            />
            <span className="num text-sm text-ink-3">/ {pts(it.points)}</span>
          </div>
          {st === "pending" && <span className="text-xs text-blue">needs grading</span>}
        </div>
      </div>
      {(changed || st === "pending" || a?.feedback) && (
        <div className="flex items-center gap-2 border-t border-line px-4 py-2.5">
          <input value={feedback} onChange={(e) => setFeedback(e.target.value)} className="field field-sm flex-1" placeholder="Feedback for the student (optional)" />
          <Button
            size="sm"
            variant="primary"
            disabled={pending || score === "" || !changed}
            onClick={() => act(setAnswerScore(attemptId, it.id, Number(score), feedback || null), "Saved")}
          >
            Save
          </Button>
        </div>
      )}
    </div>
  );
}

function IntegrityCard({
  summary,
  review,
  attemptId,
  act,
  pending,
  aiReady,
}: {
  summary: IntegritySummary | null;
  review: AiReview | null;
  attemptId: string;
  act: Act;
  pending: boolean;
  aiReady: boolean;
}) {
  const s = summary?.stats;
  const v = review ? VERDICT[review.verdict] : null;
  return (
    <div className="card">
      <div className="flex h-11 items-center justify-between border-b border-line px-4">
        <div className="text-sm font-medium">Integrity</div>
        {summary && <LevelPill level={summary.level} />}
      </div>
      <div className="space-y-4 p-4">
        {summary && summary.flags.length > 0 ? (
          <ul className="space-y-2">
            {summary.flags.map((f, i) => (
              <li key={i} className="flex gap-2.5 text-sm">
                <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", f.severity === "high" ? "bg-red" : f.severity === "medium" ? "bg-amber" : "bg-ink-4")} />
                <span className="text-ink-2">{f.message}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-ink-3">Nothing flagged.</div>
        )}
        {s && (
          <div className="grid grid-cols-3 gap-3 border-t border-line pt-3 text-center">
            <Mini label="Left" value={String(s.leaves)} />
            <Mini label="Away" value={s.awayMs >= 60000 ? `${Math.round(s.awayMs / 60000)}m` : `${Math.round(s.awayMs / 1000)}s`} />
            <Mini label="Pastes" value={String(s.pastes)} />
          </div>
        )}
        <div className="border-t border-line pt-3">
          {review && v ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="size-3.5 text-blue" />
                <span className="text-sm font-medium">Claude</span>
                <Badge tone={v.tone}>{v.label}</Badge>
              </div>
              <p className="text-sm text-ink-2">{review.summary}</p>
              {review.evidence.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-xs text-ink-3">
                  {review.evidence.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
          <Button
            size="sm"
            className={cn(review && "mt-3")}
            icon={<Sparkles className="size-3.5" />}
            disabled={pending || !aiReady}
            title={aiReady ? undefined : "Add an Anthropic API key to use Claude"}
            onClick={() => act(aiReviewAttempt(attemptId), "Claude reviewed the log")}
          >
            {review ? "Review again" : "Review with Claude"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="num text-lg font-semibold">{value}</div>
      <div className="text-xs text-ink-3">{label}</div>
    </div>
  );
}

function Timeline({ events, startedAt }: { events: Ev[]; startedAt: number }) {
  const [all, setAll] = useState(false);
  const shown = events.filter((e) => all || e.severity !== "info" || e.type === "start" || e.type === "submit");
  const mmss = (t: number) => {
    const s = Math.max(0, Math.round((t - startedAt) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  return (
    <div className="card flex max-h-[560px] flex-col">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-line px-4">
        <div className="text-sm font-medium">Timeline</div>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-3">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="accent-[var(--ink)]" />
          All events
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-ink-3">No events.</div>
        ) : (
          <ul className="py-1">
            {shown.map((e) => {
              const away = Number(e.data?.awayMs) || 0;
              return (
                <li key={e.id} className="flex gap-3 px-4 py-1.5 text-sm">
                  <span className="num w-11 shrink-0 font-mono text-xs leading-5 text-ink-4">{mmss(e.at)}</span>
                  <span
                    className={cn(
                      "mt-2 size-1.5 shrink-0 rounded-full",
                      e.severity === "high" ? "bg-red" : e.severity === "medium" ? "bg-amber" : e.severity === "low" ? "bg-ink-3" : "bg-line-2",
                    )}
                  />
                  <span className="min-w-0 flex-1 leading-5">
                    <span className={cn(e.severity === "info" && "text-ink-3")}>{e.label}</span>
                    {away >= 1000 && <span className="text-ink-3"> after {Math.round(away / 1000)} s</span>}
                    {e.type === "paste" && e.data?.chars ? <span className="text-ink-3"> ({String(e.data.chars)} chars)</span> : null}
                    {e.item && <span className="block truncate text-xs text-ink-4">{e.item}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
