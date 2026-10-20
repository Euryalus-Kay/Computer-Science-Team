"use client";

import { RotateCw, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ItemProps } from "../types";
import { Stage, AnswerField, Legend, Chip } from "./common";
import { figureDots, type FigurePattern, type CircuitPub, type PathsPub, type GateOp } from "@/lib/items/widgets/visual";

/* ------------------------------------------------------------- figures */

function DotFigure({ pattern, n }: { pattern: FigurePattern; n: number }) {
  const dots = figureDots(pattern, n);
  const S = 13;
  const maxX = Math.max(...dots.map((d) => d[0]));
  const maxY = Math.max(...dots.map((d) => d[1]));
  const w = (maxX + 1) * S;
  const h = (maxY + 1) * S;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label={`${dots.length} dots`}>
      {dots.map(([x, y], i) => (
        <circle key={i} cx={x * S + S / 2} cy={y * S + S / 2} r={4} fill="var(--ink)" />
      ))}
    </svg>
  );
}

export function Figures({ item, value, onChange, disabled }: ItemProps<{ pattern: FigurePattern; shown: number[]; ask: number }, { value: string }>) {
  const { pattern, shown, ask } = item.data;
  return (
    <div className="space-y-4">
      <Stage>
        <div className="flex flex-wrap items-end gap-x-10 gap-y-6 px-6 py-6">
          {shown.map((n) => (
            <div key={n} className="flex flex-col items-center gap-3">
              <DotFigure pattern={pattern} n={n} />
              <span className="font-mono text-xs text-ink-3">{n}</span>
            </div>
          ))}
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-[78px] w-[78px] items-center justify-center rounded-lg border border-dashed border-line-2 text-2xl text-ink-4">?</div>
            <span className="font-mono text-xs text-ink-3">{ask}</span>
          </div>
        </div>
      </Stage>
      <AnswerField label={`Dots in figure ${ask}`} value={value?.value ?? ""} onChange={(v) => onChange({ value: v })} disabled={disabled} width="w-28" inputMode="numeric" />
    </div>
  );
}

/* --------------------------------------------------------------- gears */

const PITCH = 9;
function gearRadius(teeth: number) {
  return (teeth * PITCH) / (2 * Math.PI);
}

function gearPath(teeth: number, r: number) {
  const ro = r + 3.6;
  const ri = r - 3.6;
  const step = (2 * Math.PI) / teeth;
  const pts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const p = (rad: number, ang: number) => `${(rad * Math.cos(ang)).toFixed(2)},${(rad * Math.sin(ang)).toFixed(2)}`;
    pts.push(p(ri, a), p(ro, a + step * 0.2), p(ro, a + step * 0.48), p(ri, a + step * 0.68));
  }
  return `M${pts.join("L")}Z`;
}

export function Gears({ item, value, onChange, disabled }: ItemProps<{ teeth: number[]; turns: number; labels: string[] }, { dir?: string; turns?: string }>) {
  const { teeth, labels } = item.data;
  const radii = teeth.map(gearRadius);
  const pad = 24;
  const xs: number[] = [];
  let x = pad + radii[0] + 4;
  radii.forEach((r, i) => {
    if (i > 0) x += radii[i - 1] + r;
    xs.push(x);
  });
  const width = xs[xs.length - 1] + radii[radii.length - 1] + pad + 4;
  const maxR = Math.max(...radii);
  const cy = maxR + 22;
  const height = cy + maxR + 40;
  return (
    <div className="space-y-4">
      <Stage>
        <div className="overflow-x-auto px-4 py-4">
          <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="mx-auto block max-w-none">
            {teeth.map((t, i) => {
              const r = radii[i];
              const phase = i % 2 ? 180 / t : 0;
              return (
                <g key={i} transform={`translate(${xs[i]} ${cy})`}>
                  <g style={i === 0 ? { animation: "gear-spin 9s linear infinite", transformBox: "fill-box", transformOrigin: "center" } : undefined}>
                    <g transform={`rotate(${phase})`}>
                      <path d={gearPath(t, r)} fill={i === 0 ? "var(--accent-soft)" : "var(--panel-3)"} stroke={i === 0 ? "var(--accent)" : "var(--ink-3)"} strokeWidth={1.2} />
                      <circle r={Math.max(3, r * 0.18)} fill="var(--panel)" stroke="var(--ink-3)" strokeWidth={1} />
                    </g>
                  </g>
                  <text y={-r - 9} textAnchor="middle" className="fill-ink font-mono" fontSize={13} fontWeight={600}>
                    {labels[i]}
                  </text>
                  <text y={r + 20} textAnchor="middle" className="fill-ink-3" fontSize={11}>
                    {t} teeth
                  </text>
                </g>
              );
            })}
            <g transform={`translate(${xs[0]} ${cy})`}>
              <path
                d={`M ${-radii[0] - 12} -6 A ${radii[0] + 12} ${radii[0] + 12} 0 0 1 -6 ${-radii[0] - 12}`}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={1.6}
                markerEnd="url(#gear-arrow)"
              />
            </g>
            <defs>
              <marker id="gear-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" />
              </marker>
            </defs>
          </svg>
        </div>
        <style>{`@keyframes gear-spin { to { transform: rotate(360deg); } }`}</style>
      </Stage>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink-2">Gear {labels[labels.length - 1]} turns</span>
          <Chip active={value?.dir === "cw"} onClick={() => !disabled && onChange({ ...value, dir: "cw" })}>
            <RotateCw className="size-3.5" /> Clockwise
          </Chip>
          <Chip active={value?.dir === "ccw"} onClick={() => !disabled && onChange({ ...value, dir: "ccw" })}>
            <RotateCcw className="size-3.5" /> Counterclockwise
          </Chip>
        </div>
        <AnswerField label="Full turns" value={value?.turns ?? ""} onChange={(v) => onChange({ ...value, turns: v })} disabled={disabled} width="w-24" inputMode="numeric" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- circuit */

function gateShape(op: GateOp, x: number, y: number) {
  const w = 58;
  const h = 46;
  const t = y - h / 2;
  const b = y + h / 2;
  if (op === "AND") return { d: `M${x},${t} H${x + 30} A${h / 2},${h / 2} 0 0 1 ${x + 30},${b} H${x} Z`, out: x + 30 + h / 2, inset: 0 };
  const body = `M${x},${t} Q${x + 16},${y} ${x},${b} Q${x + 38},${b} ${x + w},${y} Q${x + 38},${t} ${x},${t} Z`;
  if (op === "OR") return { d: body, out: x + w, inset: 7 };
  return { d: `${body} M${x - 7},${t} Q${x + 9},${y} ${x - 7},${b}`, out: x + w, inset: 7 };
}

export function Circuit({ item, value, onChange, disabled }: ItemProps<CircuitPub, { bits: boolean[] }>) {
  const { ops, neg } = item.data;
  const bits = value?.bits ?? [false, false, false, false];
  const toggle = (i: number) => {
    if (disabled) return;
    const n = [...bits];
    n[i] = !n[i];
    onChange({ bits: n });
  };
  const SW = [44, 100, 170, 226];
  const G1 = { x: 210, y: 72 };
  const G2 = { x: 210, y: 198 };
  const G3 = { x: 380, y: 135 };
  const g1 = gateShape(ops[0], G1.x, G1.y);
  const g2 = gateShape(ops[1], G2.x, G2.y);
  const g3 = gateShape(ops[2], G3.x, G3.y);
  const on = "var(--accent)";
  const off = "var(--ink-4)";
  const bubble = (cx: number, cy: number, key: string) => <circle key={key} cx={cx} cy={cy} r={4.5} fill="var(--panel)" stroke="var(--ink-2)" strokeWidth={1.5} />;
  const inputs: [number, number, number, boolean][] = [
    [SW[0], G1.y - 12, G1.x + g1.inset, neg.a],
    [SW[1], G1.y + 12, G1.x + g1.inset, neg.b],
    [SW[2], G2.y - 12, G2.x + g2.inset, neg.c],
    [SW[3], G2.y + 12, G2.x + g2.inset, neg.d],
  ];
  return (
    <div className="space-y-3">
      <Stage>
        <div className="overflow-x-auto px-2 py-3">
          <svg viewBox="0 0 560 270" className="mx-auto block w-full max-w-[620px] min-w-[460px]">
            {/* input wires */}
            {inputs.map(([sy, gy, gx, n], i) => (
              <g key={i}>
                <polyline points={`92,${sy} 150,${sy} 150,${gy} ${gx - (n ? 9 : 0)},${gy}`} fill="none" stroke={bits[i] ? on : off} strokeWidth={2} />
                {n && bubble(gx - 4.5, gy, `nb${i}`)}
              </g>
            ))}
            {/* gate 1 & 2 outputs into gate 3 */}
            <polyline
              points={`${g1.out + (neg.g1 ? 9 : 0)},${G1.y} 330,${G1.y} 330,${G3.y - 12} ${G3.x + g3.inset},${G3.y - 12}`}
              fill="none"
              stroke="var(--ink-3)"
              strokeWidth={2}
            />
            <polyline
              points={`${g2.out + (neg.g2 ? 9 : 0)},${G2.y} 330,${G2.y} 330,${G3.y + 12} ${G3.x + g3.inset},${G3.y + 12}`}
              fill="none"
              stroke="var(--ink-3)"
              strokeWidth={2}
            />
            {neg.g1 && bubble(g1.out + 4.5, G1.y, "g1")}
            {neg.g2 && bubble(g2.out + 4.5, G2.y, "g2")}
            {/* output to lamp */}
            <line x1={g3.out + (neg.out ? 9 : 0)} y1={G3.y} x2={500} y2={G3.y} stroke="var(--ink-3)" strokeWidth={2} />
            {neg.out && bubble(g3.out + 4.5, G3.y, "out")}
            {[
              [g1, G1, ops[0]],
              [g2, G2, ops[1]],
              [g3, G3, ops[2]],
            ].map(([g, pos, op], i) => (
              <g key={i}>
                <path d={(g as { d: string }).d} fill="var(--panel-2)" stroke="var(--ink)" strokeWidth={1.8} strokeLinejoin="round" />
                <text x={(pos as { x: number }).x + 24} y={(pos as { y: number }).y + 4} textAnchor="middle" fontSize={10.5} fontWeight={600} className="fill-ink-2 font-mono">
                  {op as string}
                </text>
              </g>
            ))}
            {/* lamp */}
            <g transform={`translate(${520} ${G3.y})`}>
              <circle r={18} fill="var(--panel-3)" stroke="var(--ink-2)" strokeWidth={1.6} />
              <path d="M-7,4 L-3,-5 L0,3 L3,-5 L7,4" fill="none" stroke="var(--ink-3)" strokeWidth={1.4} />
              <text y={36} textAnchor="middle" fontSize={11} className="fill-ink-3">
                lamp
              </text>
            </g>
            {/* switches */}
            {SW.map((y, i) => (
              <g key={i} onClick={() => toggle(i)} className={cn(!disabled && "cursor-pointer")} role="switch" aria-checked={bits[i]}>
                <text x={14} y={y + 4.5} fontSize={14} fontWeight={600} className="fill-ink font-mono">
                  {"ABCD"[i]}
                </text>
                <rect x={36} y={y - 12} width={56} height={24} rx={12} fill={bits[i] ? on : "var(--panel-3)"} stroke={bits[i] ? on : "var(--line-2)"} />
                <circle cx={bits[i] ? 80 : 48} cy={y} r={8.5} fill="white" stroke="rgba(0,0,0,0.12)" />
                <text x={bits[i] ? 56 : 72} y={y + 4} fontSize={10.5} fontWeight={600} textAnchor="middle" fill={bits[i] ? "white" : "var(--ink-3)"} className="font-mono">
                  {bits[i] ? "ON" : "OFF"}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </Stage>
      <Legend
        items={[
          { k: <b className="font-mono text-ink-2">AND</b>, v: "on when both inputs are on" },
          { k: <b className="font-mono text-ink-2">OR</b>, v: "on when at least one input is on" },
          { k: <b className="font-mono text-ink-2">XOR</b>, v: "on when exactly one input is on" },
          { k: <span className="inline-block size-2.5 rounded-full border-[1.5px] border-ink-2" />, v: "flips the signal" },
        ]}
      />
    </div>
  );
}

/* --------------------------------------------------------------- paths */

export function Paths({ item, value, onChange, disabled }: ItemProps<PathsPub, { value: string }>) {
  const { rows, cols, blocked } = item.data;
  const C = 46;
  const set = new Set(blocked.map(([r, c]) => `${r},${c}`));
  return (
    <div className="space-y-4">
      <Stage>
        <div className="flex flex-wrap items-center gap-8 px-6 py-6">
          <svg width={cols * C + 2} height={rows * C + 2} viewBox={`-1 -1 ${cols * C + 2} ${rows * C + 2}`}>
            <defs>
              <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="6" stroke="var(--ink-3)" strokeWidth="1.4" />
              </pattern>
            </defs>
            {Array.from({ length: rows }).map((_, r) =>
              Array.from({ length: cols }).map((__, c) => {
                const b = set.has(`${r},${c}`);
                return <rect key={`${r},${c}`} x={c * C} y={r * C} width={C} height={C} fill={b ? "url(#hatch)" : "var(--panel)"} stroke="var(--line-2)" />;
              }),
            )}
            <text x={C / 2} y={C / 2 + 5} textAnchor="middle" fontSize={14} fontWeight={700} className="fill-accent font-mono">
              S
            </text>
            <text x={(cols - 0.5) * C} y={(rows - 0.5) * C + 5} textAnchor="middle" fontSize={14} fontWeight={700} className="fill-accent font-mono">
              E
            </text>
          </svg>
          <div className="space-y-2 text-sm text-ink-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-ink">→ ↓</span> moves only
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block size-4 rounded-sm border border-line-2" style={{ background: "repeating-linear-gradient(45deg, var(--ink-3) 0 1.4px, transparent 1.4px 5px)" }} />
              blocked
            </div>
          </div>
        </div>
      </Stage>
      <AnswerField label="Number of paths" value={value?.value ?? ""} onChange={(v) => onChange({ value: v })} disabled={disabled} width="w-28" inputMode="numeric" />
    </div>
  );
}
