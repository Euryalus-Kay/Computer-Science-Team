"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, CircleCheck, CircleDashed } from "lucide-react";
import { Difficulty } from "./difficulty";
import { Empty } from "@/components/ui/page";
import { cn } from "@/lib/cn";

type Row = {
  slug: string;
  title: string;
  difficulty: string;
  tags: string[];
  solvers: number;
  attempts: number;
  solved: boolean;
  tried: boolean;
};

export function ProblemList({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [diff, setDiff] = useState("");
  const [status, setStatus] = useState("");
  const [tag, setTag] = useState("");
  const tags = useMemo(() => [...new Set(rows.flatMap((r) => r.tags))].sort(), [rows]);
  const shown = rows.filter(
    (r) =>
      (!q || r.title.toLowerCase().includes(q.toLowerCase())) &&
      (!diff || r.difficulty === diff) &&
      (!tag || r.tags.includes(tag)) &&
      (!status || (status === "solved" ? r.solved : status === "tried" ? r.tried && !r.solved : !r.tried)),
  );
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-[280px]">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-4" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="field field-sm pl-8" />
        </div>
        <select value={diff} onChange={(e) => setDiff(e.target.value)} className="field field-sm w-auto">
          <option value="">Any difficulty</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <select value={tag} onChange={(e) => setTag(e.target.value)} className="field field-sm w-auto">
          <option value="">Any topic</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="field field-sm w-auto">
          <option value="">Any status</option>
          <option value="solved">Solved</option>
          <option value="tried">Attempted</option>
          <option value="new">Not started</option>
        </select>
      </div>
      <div className="card overflow-hidden">
        {shown.length === 0 ? (
          <Empty title={rows.length ? "No matches" : "No problems yet"} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th className="w-10" />
                <th>Title</th>
                <th className="hidden md:table-cell">Topics</th>
                <th>Difficulty</th>
                <th className="hidden text-right sm:table-cell">Solved by</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.slug} className="row-link" onClick={() => router.push(`/problems/${r.slug}`)}>
                  <td>
                    {r.solved ? (
                      <CircleCheck className="size-4 text-accent" aria-label="Solved" />
                    ) : r.tried ? (
                      <CircleDashed className="size-4 text-amber" aria-label="Attempted" />
                    ) : null}
                  </td>
                  <td>
                    <Link href={`/problems/${r.slug}`} className={cn("font-medium text-ink hover:underline")} onClick={(e) => e.stopPropagation()}>
                      {r.title}
                    </Link>
                  </td>
                  <td className="hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {r.tags.slice(0, 3).map((t) => (
                        <span key={t} className="rounded bg-panel-3 px-1.5 py-0.5 text-xs text-ink-2">
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <Difficulty value={r.difficulty} />
                  </td>
                  <td className="num hidden text-right text-ink-2 sm:table-cell">{r.solvers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
