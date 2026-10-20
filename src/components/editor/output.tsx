"use client";

import type { ExecResult } from "@/lib/runner";
import { Badge, type Tone } from "@/components/ui/badge";

const STATUS: Record<ExecResult["status"], { label: string; tone: Tone }> = {
  ok: { label: "Finished", tone: "green" },
  compile_error: { label: "Compilation error", tone: "red" },
  runtime_error: { label: "Runtime error", tone: "red" },
  timeout: { label: "Time limit", tone: "amber" },
  memory: { label: "Memory limit", tone: "amber" },
  internal: { label: "Runner error", tone: "neutral" },
};

export function ExecMeta({ r }: { r: ExecResult }) {
  const s = STATUS[r.status];
  return (
    <div className="flex items-center gap-2 text-xs text-ink-3">
      <Badge tone={s.tone}>{s.label}</Badge>
      {r.timeMs !== null && <span className="num">{r.timeMs} ms</span>}
      {r.memoryKb !== null && <span className="num">{(r.memoryKb / 1024).toFixed(1)} MB</span>}
    </div>
  );
}

export function ExecOutput({ r }: { r: ExecResult }) {
  return (
    <div className="space-y-3 font-mono text-[12.5px] leading-[1.6]">
      {r.compileOutput && (
        <pre className="overflow-x-auto rounded-md bg-red-soft p-2.5 whitespace-pre-wrap text-red">{r.compileOutput}</pre>
      )}
      {r.stdout ? (
        <pre className="whitespace-pre-wrap break-words text-ink">{r.stdout}</pre>
      ) : (
        !r.compileOutput && !r.stderr && <div className="text-ink-4">No output</div>
      )}
      {r.stderr && <pre className="whitespace-pre-wrap break-words text-red">{r.stderr}</pre>}
      {r.status === "internal" && r.message && <div className="text-ink-3">{r.message}</div>}
    </div>
  );
}
