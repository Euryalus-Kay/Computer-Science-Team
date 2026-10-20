import type { Metadata } from "next";
import Link from "next/link";
import { Lock, MonitorSmartphone, Camera, Radio } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { testsForUser, type TestCard } from "@/lib/tests/view";
import { getSettings } from "@/lib/settings";
import { Page, PageHeader, Empty } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { pts } from "@/lib/format";

export const metadata: Metadata = { title: "Tests" };

function StatusBadge({ t, tz }: { t: TestCard; tz: string }) {
  const a = t.availability;
  if (t.mine.status === "active") return <Badge tone="blue" dot>In progress</Badge>;
  if (t.mine.status === "done") return <Badge tone="neutral">Submitted</Badge>;
  switch (a.state) {
    case "open":
      return t.startMode === "live" ? (
        <Badge tone="green" dot>
          Live
        </Badge>
      ) : (
        <Badge tone="green">Open</Badge>
      );
    case "waiting":
    case "countdown":
      return <Badge tone="amber">Waiting to start</Badge>;
    case "scheduled":
      return <Badge tone="outline">Opens {formatDateTime(a.opensAt, tz)}</Badge>;
    case "draft":
      return <Badge tone="outline">Draft</Badge>;
    default:
      return <Badge tone="neutral">Closed</Badge>;
  }
}

function Row({ t, tz }: { t: TestCard; tz: string }) {
  return (
    <Link href={`/tests/${t.slug}`} className="group flex items-center gap-4 px-4 py-3.5 hover:bg-panel-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-ink group-hover:underline">{t.title}</span>
          {t.locked && <Lock className="size-3.5 text-ink-4" aria-label="Needs a code" />}
          {t.lockdown !== "none" && <MonitorSmartphone className="size-3.5 text-ink-4" aria-label="Lockdown" />}
          {t.camera && <Camera className="size-3.5 text-ink-4" aria-label="Camera check" />}
          {t.startMode === "live" && t.availability.state !== "closed" && <Radio className="size-3.5 text-ink-4" aria-label="Starts together" />}
        </div>
        <div className="num mt-0.5 text-xs text-ink-3">
          {t.questions} questions
          {t.durationMin ? ` · ${t.durationMin} min` : ""}
          {t.tag ? ` · ${t.tag}` : ""}
        </div>
      </div>
      {t.mine.status === "done" && t.mine.score !== null && (
        <span className="num text-sm font-medium text-ink-2">
          {pts(t.mine.score)}/{pts(t.mine.maxScore)}
        </span>
      )}
      <StatusBadge t={t} tz={tz} />
    </Link>
  );
}

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
            <Row key={t.id} t={t} tz={s.timezone} />
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
