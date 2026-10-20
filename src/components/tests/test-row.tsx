import Link from "next/link";
import { Lock, MonitorSmartphone, Camera, Radio } from "lucide-react";
import type { TestCard } from "@/lib/tests/view";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, pts } from "@/lib/format";

export function StatusBadge({ t, tz }: { t: TestCard; tz: string }) {
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

export function TestRow({ t, tz }: { t: TestCard; tz: string }) {
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

