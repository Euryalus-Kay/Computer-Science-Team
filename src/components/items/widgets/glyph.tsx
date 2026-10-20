"use client";

import type { ReactNode } from "react";
import type { ItemProps } from "../types";
import { AnswerField, Stage } from "./common";

const OPS: { k: string; v: ReactNode }[] = [
  { k: "7", v: "A number goes on top of the stack." },
  { k: "+ - *", v: <>Take the top two, put the result on top. The lower one comes first, so <G>7 2 -</G> leaves 5.</> },
  { k: ":", v: "Copy the top." },
  { k: "~", v: "Swap the top two." },
  { k: "^", v: <>Pull the third from the top up to the top: <G>1 2 3 ^</G> leaves 2 3 1.</> },
  { k: ".", v: "Take the top off and print it." },
  { k: "3( … )", v: "Run what's inside 3 times." },
];

const EXAMPLES: [string, string][] = [
  ["2 3 + .", "5"],
  ["4 : * .", "16"],
  ["1 2 ~ - .", "1"],
  ["1 3( 2 * ) .", "8"],
];

function G({ children }: { children: ReactNode }) {
  return <code className="rounded bg-panel-3 px-1 py-px font-mono text-[12px] text-ink">{children}</code>;
}

/** A program in Glyph, a made-up stack language, with its one-page manual. */
export function Glyph({ item, value, onChange, disabled }: ItemProps<{ code: string }, { text: string }>) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Stage dark className="self-start">
          <div className="flex h-9 items-center border-b border-[#1f242b] px-3 font-mono text-xs text-[#7c8692]">program.g</div>
          <div className="px-5 py-7 font-mono text-[22px] leading-relaxed tracking-wide break-words text-[#e9edf1]">{item.data.code}</div>
        </Stage>
        <Stage>
          <div className="flex h-9 items-center border-b border-line px-3 text-xs font-medium text-ink-3">Glyph manual</div>
          <div className="space-y-3 px-4 py-3 text-[13px] @container">
            <p className="text-ink-2">Glyph keeps a stack of numbers and reads the program left to right. Stacks are written bottom to top, so in 1 2 3 the top is 3.</p>
            <table className="w-full">
              <tbody>
                {OPS.map((o) => (
                  <tr key={o.k} className="align-top">
                    <td className="w-16 py-1 pr-3 font-mono font-semibold whitespace-nowrap">{o.k}</td>
                    <td className="py-1 text-ink-2">{o.v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="grid gap-x-4 gap-y-1 border-t border-line pt-2.5 font-mono text-[12px] @sm:grid-cols-2">
              {EXAMPLES.map(([code, out]) => (
                <div key={code} className="flex justify-between gap-2">
                  <span>{code}</span>
                  <span className="text-ink-3">prints {out}</span>
                </div>
              ))}
            </div>
          </div>
        </Stage>
      </div>
      <AnswerField label="Printed output" value={value?.text ?? ""} onChange={(t) => onChange({ text: t })} disabled={disabled} width="w-56" placeholder="e.g. 12 or 4 20" />
    </div>
  );
}
