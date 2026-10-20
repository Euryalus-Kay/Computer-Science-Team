import type { ReactNode } from "react";

/** Tiny inline formatter for option text: `code` and **bold**. Everything else is plain text. */
export function Inline({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("`"))
      parts.push(
        <code key={i++} className="rounded border border-line bg-panel-3 px-1 py-px font-mono text-[0.88em]">
          {tok.slice(1, -1)}
        </code>,
      );
    else parts.push(<strong key={i++}>{tok.slice(2, -2)}</strong>);
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
