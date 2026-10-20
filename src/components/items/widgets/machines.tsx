"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Play, RotateCcw, Undo2, Trash2, Plus, Minus, Flag } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ItemProps } from "../types";
import { Stage, Chip } from "./common";
import {
  simulate,
  blockCount,
  railReplay,
  scaleReplay,
  validWeighing,
  press,
  pathCost,
  type Block,
  type RobotWorld,
  type RobotPos,
  type BuildLevel,
  type RailMove,
  type Weighing,
  type NetPub,
} from "@/lib/items/widgets/machines";
import { Button } from "@/components/ui/button";

/* ---------------------------------------------------------- robot grid */

function Robot({ pos, cell }: { pos: RobotPos; cell: number }) {
  return (
    <g
      transform={`translate(${pos.x * cell + cell / 2} ${pos.y * cell + cell / 2}) rotate(${pos.dir * 90})`}
      style={{ transition: "transform 180ms ease" }}
    >
      <circle r={cell * 0.36} fill="var(--accent)" />
      <path d={`M0,${-cell * 0.24} L${cell * 0.17},${cell * 0.12} L0,${cell * 0.04} L${-cell * 0.17},${cell * 0.12} Z`} fill="white" />
    </g>
  );
}

function RobotGrid({
  world,
  pos,
  goal,
  trail,
  pick,
  onPick,
}: {
  world: RobotWorld;
  pos: RobotPos;
  goal?: [number, number];
  trail?: RobotPos[];
  pick?: [number, number] | null;
  onPick?: (c: [number, number]) => void;
}) {
  const C = 42;
  const walls = new Set(world.walls.map(([x, y]) => `${x},${y}`));
  return (
    <svg width={world.w * C + 2} height={world.h * C + 2} viewBox={`-1 -1 ${world.w * C + 2} ${world.h * C + 2}`} className="block">
      {Array.from({ length: world.h }).map((_, y) =>
        Array.from({ length: world.w }).map((__, x) => {
          const wall = walls.has(`${x},${y}`);
          const picked = pick && pick[0] === x && pick[1] === y;
          return (
            <rect
              key={`${x},${y}`}
              x={x * C}
              y={y * C}
              width={C}
              height={C}
              rx={3}
              fill={wall ? "var(--ink-2)" : picked ? "var(--blue-soft)" : "var(--panel)"}
              stroke={picked ? "var(--blue)" : "var(--line)"}
              strokeWidth={picked ? 2 : 1}
              className={cn(onPick && !wall && "cursor-pointer hover:fill-[var(--panel-3)]")}
              onClick={() => !wall && onPick?.([x, y])}
            />
          );
        }),
      )}
      {trail && trail.length > 1 && (
        <polyline
          points={trail.map((p) => `${p.x * C + C / 2},${p.y * C + C / 2}`).join(" ")}
          fill="none"
          stroke="var(--accent)"
          strokeOpacity={0.45}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {goal && (
        <g transform={`translate(${goal[0] * C + C / 2} ${goal[1] * C + C / 2})`} pointerEvents="none">
          <line x1={-6} y1={12} x2={-6} y2={-12} stroke="var(--red)" strokeWidth={2} />
          <path d="M-6,-12 L10,-6 L-6,0 Z" fill="var(--red)" />
        </g>
      )}
      {pick && (
        <circle cx={pick[0] * C + C / 2} cy={pick[1] * C + C / 2} r={6} fill="var(--blue)" pointerEvents="none" />
      )}
      <g pointerEvents="none">
        <Robot pos={pos} cell={C} />
      </g>
    </svg>
  );
}

const OP_LABEL = { F: "Forward", L: "Turn left", R: "Turn right" } as const;

function ProgramView({ program }: { program: Block[] }) {
  return (
    <div className="space-y-1">
      {program.map((b, i) =>
        b.op === "repeat" ? (
          <div key={i} className="rounded-lg border border-blue/30 bg-blue-soft/50 p-1.5">
            <div className="mb-1 px-1 font-mono text-xs font-semibold text-blue">repeat {b.n}</div>
            <div className="ml-2 border-l-2 border-blue/30 pl-2">
              <ProgramView program={b.body} />
            </div>
          </div>
        ) : (
          <div key={i} className="flex h-7 items-center rounded-md border border-line bg-panel px-2.5 font-mono text-[12.5px]">
            {OP_LABEL[b.op]}
          </div>
        ),
      )}
    </div>
  );
}

export function RobotTrace({ item, value, onChange, disabled }: ItemProps<RobotWorld & { program: Block[] }, { cell: [number, number] }>) {
  const world = item.data;
  return (
    <div className="space-y-3">
      <Stage>
        <div className="flex flex-wrap items-start gap-8 px-5 py-5">
          <RobotGrid world={world} pos={world.start} pick={value?.cell ?? null} onPick={disabled ? undefined : (c) => onChange({ cell: c })} />
          <div className="min-w-[180px]">
            <div className="mb-2 text-xs font-medium text-ink-3">Program</div>
            <ProgramView program={world.program} />
          </div>
        </div>
      </Stage>
      <div className="text-sm text-ink-3">
        {value?.cell ? (
          <>
            Marked column {value.cell[0] + 1}, row {value.cell[1] + 1}.
          </>
        ) : (
          "Click the cell where the robot ends."
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- robot build */

type Path = number[]; // index path into nested repeats; [] = root

function getList(program: Block[], path: Path): Block[] {
  let list = program;
  for (const i of path) {
    const b = list[i];
    if (!b || b.op !== "repeat") return program;
    list = b.body;
  }
  return list;
}

function updateList(program: Block[], path: Path, fn: (list: Block[]) => Block[]): Block[] {
  if (!path.length) return fn(program);
  const [head, ...rest] = path;
  return program.map((b, i) => (i === head && b.op === "repeat" ? { ...b, body: updateList(b.body, rest, fn) } : b));
}

function EditableProgram({
  program,
  path,
  target,
  setTarget,
  onChange,
  disabled,
}: {
  program: Block[];
  path: Path;
  target: Path;
  setTarget: (p: Path) => void;
  onChange: (fn: (root: Block[]) => Block[]) => void;
  disabled?: boolean;
}) {
  const list = getList(program, path);
  const isTarget = target.join(",") === path.join(",");
  return (
    <div className="space-y-1">
      {list.map((b, i) =>
        b.op === "repeat" ? (
          <div
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              setTarget([...path, i]);
            }}
            className={cn(
              "rounded-lg border p-1.5",
              target.join(",") === [...path, i].join(",") ? "border-blue bg-blue-soft/60" : "border-blue/30 bg-blue-soft/40",
            )}
          >
            <div className="mb-1 flex items-center gap-1 px-1">
              <span className="font-mono text-xs font-semibold text-blue">repeat</span>
              <button
                type="button"
                disabled={disabled}
                className="rounded p-0.5 text-blue hover:bg-blue/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange((root) => updateList(root, path, (l) => l.map((x, j) => (j === i && x.op === "repeat" ? { ...x, n: Math.max(2, x.n - 1) } : x))));
                }}
                aria-label="Fewer"
              >
                <Minus className="size-3" />
              </button>
              <span className="num w-4 text-center font-mono text-xs font-semibold text-blue">{b.n}</span>
              <button
                type="button"
                disabled={disabled}
                className="rounded p-0.5 text-blue hover:bg-blue/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange((root) => updateList(root, path, (l) => l.map((x, j) => (j === i && x.op === "repeat" ? { ...x, n: Math.min(9, x.n + 1) } : x))));
                }}
                aria-label="More"
              >
                <Plus className="size-3" />
              </button>
              <div className="flex-1" />
              <button
                type="button"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  setTarget(path);
                  onChange((root) => updateList(root, path, (l) => l.filter((_, j) => j !== i)));
                }}
                className="rounded p-0.5 text-ink-4 hover:text-red"
                aria-label="Remove"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
            <div className="ml-2 min-h-7 border-l-2 border-blue/30 pl-2">
              <EditableProgram program={program} path={[...path, i]} target={target} setTarget={setTarget} onChange={onChange} disabled={disabled} />
              {b.body.length === 0 && <div className="py-1 text-xs text-ink-4">Empty. Add blocks while this is selected.</div>}
            </div>
          </div>
        ) : (
          <div key={i} className="group flex h-7 items-center justify-between rounded-md border border-line bg-panel pr-1 pl-2.5 font-mono text-[12.5px]">
            {OP_LABEL[b.op]}
            <button
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                onChange((root) => updateList(root, path, (l) => l.filter((_, j) => j !== i)));
              }}
              className="rounded p-0.5 text-ink-4 opacity-0 group-hover:opacity-100 hover:text-red"
              aria-label="Remove"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        ),
      )}
      {isTarget && path.length === 0 && list.length === 0 && <div className="py-2 text-xs text-ink-4">Add blocks from the buttons above.</div>}
    </div>
  );
}

export function RobotBuild({ item, value, onChange, disabled }: ItemProps<BuildLevel, { program: Block[] }>) {
  const level = item.data;
  const program = value?.program ?? [];
  const [target, setTarget] = useState<Path>([]);
  const [anim, setAnim] = useState<{ path: RobotPos[]; i: number } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const count = blockCount(program);
  const update = (fn: (root: Block[]) => Block[]) => {
    stop();
    onChange({ program: fn(program) });
  };
  const add = (b: Block) => {
    if (count >= level.limit) return;
    update((root) => updateList(root, target, (l) => [...l, b]));
    if (b.op === "repeat") setTarget([...target, getList(program, target).length]);
  };
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setAnim(null);
  };
  const run = () => {
    stop();
    const path = simulate(level, program);
    setAnim({ path, i: 0 });
    timer.current = setInterval(() => {
      setAnim((a) => {
        if (!a) return a;
        if (a.i >= a.path.length - 1) {
          if (timer.current) clearInterval(timer.current);
          timer.current = null;
          return a;
        }
        return { ...a, i: a.i + 1 };
      });
    }, 220);
  };
  useEffect(() => () => stop(), []);
  const pos = anim ? anim.path[anim.i] : level.start;
  const done = anim && anim.i >= anim.path.length - 1;
  const reached = done && pos.x === level.goal[0] && pos.y === level.goal[1];
  return (
    <Stage>
      <div className="flex flex-wrap items-start gap-6 px-5 py-5">
        <div>
          <RobotGrid world={level} pos={pos} goal={level.goal} trail={anim ? anim.path.slice(0, anim.i + 1) : undefined} />
          <div className="mt-3 flex items-center gap-2">
            <Button variant="accent" size="sm" icon={<Play className="size-3.5" />} onClick={run} disabled={!program.length}>
              Run
            </Button>
            <Button size="sm" icon={<RotateCcw className="size-3.5" />} onClick={stop} disabled={!anim}>
              Reset robot
            </Button>
            {done && (
              <span className={cn("text-sm font-medium", reached ? "text-accent" : "text-ink-3")}>
                {reached ? (
                  <span className="inline-flex items-center gap-1">
                    <Flag className="size-3.5" /> Reached the flag
                  </span>
                ) : (
                  "Didn't reach the flag"
                )}
              </span>
            )}
          </div>
        </div>
        <div className="min-w-[230px] flex-1">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-ink-3">Program</span>
            <span className={cn("num font-mono text-xs", count > level.limit ? "text-red" : count === level.limit ? "text-amber" : "text-ink-3")}>
              {count}/{level.limit} blocks
            </span>
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {(["F", "L", "R"] as const).map((op) => (
              <Chip key={op} onClick={() => !disabled && add({ op })} className="h-7 px-2.5 font-mono text-xs">
                + {OP_LABEL[op]}
              </Chip>
            ))}
            <Chip onClick={() => !disabled && add({ op: "repeat", n: 2, body: [] })} className="h-7 border-blue/40 px-2.5 font-mono text-xs text-blue">
              + Repeat
            </Chip>
          </div>
          <div
            onClick={() => setTarget([])}
            className={cn("min-h-[140px] rounded-lg border border-dashed p-2", target.length === 0 ? "border-ink-4" : "border-line")}
          >
            <EditableProgram program={program} path={[]} target={target} setTarget={setTarget} onChange={update} disabled={disabled} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-ink-4">
            <span>New blocks go into the selected box.</span>
            <button type="button" className="hover:text-red" onClick={() => !disabled && update(() => [])}>
              Clear
            </button>
          </div>
        </div>
      </div>
    </Stage>
  );
}

/* ----------------------------------------------------------------- rail */

function Car({ n, ghost }: { n: number; ghost?: boolean }) {
  return (
    <div
      className={cn(
        "flex h-10 w-11 shrink-0 items-center justify-center rounded-md border-2 font-mono text-[15px] font-bold shadow-sm",
        ghost ? "border-dashed border-line-2 text-ink-4" : "border-ink bg-panel text-ink",
      )}
    >
      {n}
    </div>
  );
}

export function Rail({ item, value, onChange, disabled }: ItemProps<{ cars: number[] }, { moves: RailMove[] }>) {
  const moves = value?.moves ?? [];
  const s = railReplay(item.data.cars, moves);
  const n = item.data.cars.length;
  const done = s.output.length === n && s.output.every((x, i) => x === i + 1);
  const go = (m: RailMove) => !disabled && onChange({ moves: [...moves, m] });
  return (
    <Stage>
      <div className="space-y-5 px-5 py-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div>
            <div className="mb-1.5 text-xs font-medium text-ink-3">Output</div>
            <div className="flex min-h-12 items-center gap-1.5 overflow-x-auto rounded-lg border border-line bg-panel-2 p-1">
              {s.output.map((c) => (
                <Car key={c} n={c} />
              ))}
            </div>
          </div>
          <div className="mt-5 h-0.5 w-10 bg-ink-3" />
          <div>
            <div className="mb-1.5 text-xs font-medium text-ink-3">Incoming (front on the left)</div>
            <div className="flex min-h-12 items-center gap-1.5 overflow-x-auto rounded-lg border border-line bg-panel-2 p-1">
              {s.input.map((c) => (
                <Car key={c} n={c} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-center">
          <div className="w-[120px]">
            <div className="mb-1.5 text-center text-xs font-medium text-ink-3">Siding (top car leaves first)</div>
            <div className="flex min-h-[120px] flex-col items-center gap-1.5 rounded-lg border border-line bg-panel-2 p-1.5">
              {[...s.siding].reverse().map((c) => (
                <Car key={c} n={c} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button size="sm" onClick={() => go("pass")} disabled={!s.input.length || done}>
            Incoming → Output
          </Button>
          <Button size="sm" onClick={() => go("in")} disabled={!s.input.length || done}>
            Incoming → Siding
          </Button>
          <Button size="sm" onClick={() => go("out")} disabled={!s.siding.length || done}>
            Siding → Output
          </Button>
          <span className="mx-1 h-5 w-px bg-line" />
          <Button size="sm" variant="ghost" icon={<Undo2 className="size-3.5" />} onClick={() => !disabled && onChange({ moves: moves.slice(0, -1) })} disabled={!moves.length}>
            Undo
          </Button>
          <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => !disabled && onChange({ moves: [] })} disabled={!moves.length}>
            Reset
          </Button>
        </div>
        <div className="text-center text-sm">
          {done ? (
            <span className="font-medium text-accent">Sorted.</span>
          ) : (
            <span className="text-ink-3">
              Goal: output reads {Array.from({ length: n }, (_, i) => i + 1).join(" ")}. Moves so far: {moves.length}
            </span>
          )}
        </div>
      </div>
    </Stage>
  );
}

/* ---------------------------------------------------------------- scale */

type Spot = "tray" | "left" | "right";

export function Scale({ item, value, onChange, disabled }: ItemProps<{ coins: number; weighings: number }, { weighings: Weighing[]; pick: number | null }>) {
  const { coins, weighings: max } = item.data;
  const done = value?.weighings ?? [];
  const pick = value?.pick ?? null;
  const [spots, setSpots] = useState<Record<number, Spot>>({});
  const [err, setErr] = useState<string | null>(null);
  const replay = useMemo(() => scaleReplay(coins, done, max), [coins, done, max]);
  const lastTilt = replay.tilts[replay.tilts.length - 1] ?? null;
  const left = Object.entries(spots).filter(([, s]) => s === "left").map(([c]) => Number(c));
  const right = Object.entries(spots).filter(([, s]) => s === "right").map(([c]) => Number(c));
  const used = done.length >= max;
  const cycle = (c: number) => {
    if (disabled || used) return;
    setErr(null);
    setSpots((s) => ({ ...s, [c]: s[c] === "left" ? "right" : s[c] === "right" ? "tray" : "left" }));
  };
  const weighNow = () => {
    const w = { left: left.sort((a, b) => a - b), right: right.sort((a, b) => a - b) };
    const e = validWeighing(w, coins);
    if (e) return setErr(e);
    onChange({ weighings: [...done, w], pick });
    setSpots({});
  };
  const angle = lastTilt === "left-up" ? -9 : lastTilt === "right-up" ? 9 : 0;
  const coin = (c: number, small?: boolean) => {
    const picked = pick === c;
    return (
      <button
        key={c}
        type="button"
        onClick={() => (used ? !disabled && onChange({ weighings: done, pick: c }) : cycle(c))}
        className={cn(
          "flex items-center justify-center rounded-full border-2 font-mono font-bold transition-colors",
          small ? "size-8 text-xs" : "size-10 text-sm",
          picked ? "border-red bg-red-soft text-red" : "border-amber/70 bg-amber-soft text-amber hover:border-amber",
        )}
      >
        {c}
      </button>
    );
  };
  const onPan = (side: Spot) => (side === "left" ? left : right);
  return (
    <Stage>
      <div className="px-5 py-5">
        <div className="mx-auto flex max-w-[520px] flex-col items-center">
          <svg viewBox="0 0 400 150" className="w-full">
            <g transform={`rotate(${angle} 200 40)`} style={{ transition: "transform 500ms cubic-bezier(.3,1.4,.6,1)" }}>
              <line x1={50} y1={40} x2={350} y2={40} stroke="var(--ink-2)" strokeWidth={4} strokeLinecap="round" />
              {[50, 350].map((x) => (
                <g key={x}>
                  <line x1={x} y1={40} x2={x - 34} y2={92} stroke="var(--ink-3)" strokeWidth={1.2} />
                  <line x1={x} y1={40} x2={x + 34} y2={92} stroke="var(--ink-3)" strokeWidth={1.2} />
                  <path d={`M${x - 44},92 Q${x},112 ${x + 44},92 Z`} fill="var(--panel-3)" stroke="var(--ink-3)" />
                </g>
              ))}
            </g>
            <path d="M200,40 L186,140 L214,140 Z" fill="var(--panel-3)" stroke="var(--ink-3)" />
            <circle cx={200} cy={40} r={5} fill="var(--ink-2)" />
          </svg>
          <div className="-mt-3 grid w-full grid-cols-2 gap-10 px-2">
            {(["left", "right"] as const).map((side) => (
              <div key={side} className="flex min-h-9 flex-wrap justify-center gap-1">
                {onPan(side).map((c) => coin(c, true))}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-5 border-t border-line pt-4">
          <div className="mb-2 text-xs font-medium text-ink-3">
            {used ? "Click the coin you think is light." : "Coins (click to put on the left pan, again for right, again to take off)"}
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: coins }, (_, i) => i + 1)
              .filter((c) => used || !spots[c] || spots[c] === "tray")
              .map((c) => coin(c))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {!used && (
              <Button size="sm" variant="primary" onClick={weighNow} disabled={disabled || (!left.length && !right.length)}>
                Weigh ({max - done.length} left)
              </Button>
            )}
            {err && <span className="text-sm text-red">{err}</span>}
            {pick !== null && <span className="text-sm font-medium">Your pick: coin {pick}</span>}
          </div>
          {done.length > 0 && (
            <ol className="mt-4 space-y-1 font-mono text-[12.5px]">
              {done.map((w, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-ink-4">{i + 1}.</span>
                  <span>
                    {w.left.join(" ")} <span className="text-ink-4">vs</span> {w.right.join(" ")}
                  </span>
                  <span className="text-ink-2">
                    {replay.tilts[i] === "balance" ? "balanced" : replay.tilts[i] === "left-up" ? "left side lighter" : "right side lighter"}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Stage>
  );
}

/* --------------------------------------------------------------- lights */

export function Lights({ item, value, onChange, disabled }: ItemProps<{ size: number; start: boolean[]; min: number }, { presses: number[] }>) {
  const { size, start, min } = item.data;
  const presses = value?.presses ?? [];
  const board = presses.reduce((b, i) => press(b, size, i), [...start]);
  const solved = board.every((x) => !x);
  return (
    <Stage>
      <div className="flex flex-wrap items-center gap-8 px-6 py-6">
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${size}, 64px)` }}>
          {board.map((on, i) => (
            <button
              key={i}
              type="button"
              disabled={disabled || solved}
              onClick={() => onChange({ presses: [...presses, i] })}
              className={cn(
                "size-16 rounded-xl border-2 transition-all duration-150 active:scale-95",
                on
                  ? "border-amber bg-[#ffd27a] shadow-[0_0_22px_rgba(255,190,70,0.75),inset_0_-3px_0_rgba(0,0,0,0.08)]"
                  : "border-line-2 bg-panel-3 shadow-[inset_0_2px_3px_rgba(0,0,0,0.08)]",
              )}
              aria-label={on ? "Light on" : "Light off"}
            />
          ))}
        </div>
        <div className="space-y-3">
          <div className="num text-sm">
            <span className="text-2xl font-semibold">{presses.length}</span> <span className="text-ink-3">presses</span>
          </div>
          <div className="text-sm text-ink-3">Best possible: {min}</div>
          {solved ? (
            <div className="text-sm font-medium text-accent">All off.</div>
          ) : (
            <Button size="sm" icon={<RotateCcw className="size-3.5" />} onClick={() => !disabled && onChange({ presses: [] })} disabled={!presses.length}>
              Start over
            </Button>
          )}
        </div>
      </div>
    </Stage>
  );
}

/* -------------------------------------------------------------- network */

export function Network({ item, value, onChange, disabled }: ItemProps<NetPub, { path: string[] }>) {
  const net = item.data;
  const path = value?.path?.length ? value.path : [net.from];
  const pos = new Map(net.nodes.map((n) => [n.id, n]));
  const W = 560;
  const H = 300;
  const X = (x: number) => 20 + (x / 100) * (W - 40);
  const Y = (y: number) => 20 + (y / 100) * (H - 40);
  const last = path[path.length - 1];
  const adjacent = new Set(net.edges.flatMap((e) => (e.a === last ? [e.b] : e.b === last ? [e.a] : [])));
  const inPath = (a: string, b: string) => path.some((p, i) => i > 0 && ((path[i - 1] === a && p === b) || (path[i - 1] === b && p === a)));
  const cost = pathCost(net, path);
  const partial = path.reduce((s, p, i) => {
    if (!i) return 0;
    const e = net.edges.find((x) => (x.a === path[i - 1] && x.b === p) || (x.b === path[i - 1] && x.a === p));
    return s + (e?.w ?? 0);
  }, 0);
  const click = (id: string) => {
    if (disabled) return;
    if (id === last && path.length > 1) return onChange({ path: path.slice(0, -1) });
    if (adjacent.has(id) && !path.includes(id) && last !== net.to) onChange({ path: [...path, id] });
  };
  return (
    <Stage>
      <div className="overflow-x-auto px-3 py-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block w-full max-w-[620px] min-w-[460px]">
          {net.edges.map((e, i) => {
            const a = pos.get(e.a)!;
            const b = pos.get(e.b)!;
            const on = inPath(e.a, e.b);
            const mx = (X(a.x) + X(b.x)) / 2;
            const my = (Y(a.y) + Y(b.y)) / 2;
            return (
              <g key={i}>
                <line x1={X(a.x)} y1={Y(a.y)} x2={X(b.x)} y2={Y(b.y)} stroke={on ? "var(--accent)" : "var(--line-2)"} strokeWidth={on ? 3.5 : 2} />
                <rect x={mx - 11} y={my - 10} width={22} height={20} rx={5} fill="var(--panel)" stroke={on ? "var(--accent)" : "var(--line-2)"} />
                <text x={mx} y={my + 4.5} textAnchor="middle" fontSize={12} fontWeight={600} className="num fill-ink-2 font-mono">
                  {e.w}
                </text>
              </g>
            );
          })}
          {net.nodes.map((n) => {
            const onPath = path.includes(n.id);
            const can = adjacent.has(n.id) && !onPath && last !== net.to;
            const end = n.id === net.from || n.id === net.to;
            return (
              <g key={n.id} onClick={() => click(n.id)} className={cn((can || n.id === last) && !disabled && "cursor-pointer")}>
                <circle
                  cx={X(n.x)}
                  cy={Y(n.y)}
                  r={17}
                  fill={onPath ? "var(--accent)" : "var(--panel)"}
                  stroke={can ? "var(--accent)" : end ? "var(--ink)" : "var(--ink-3)"}
                  strokeWidth={can ? 2.5 : 1.6}
                  strokeDasharray={can ? "4 3" : undefined}
                />
                <text x={X(n.x)} y={Y(n.y) + 5} textAnchor="middle" fontSize={14} fontWeight={700} fill={onPath ? "white" : "var(--ink)"} className="font-mono">
                  {n.id}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-sm">
        <span className="font-mono">{path.join(" → ")}</span>
        <span className="flex items-center gap-3">
          <span className="num text-ink-2">
            Total <b className="text-ink">{cost ?? partial}</b>
            {cost === null && last !== net.to && <span className="text-ink-4"> so far</span>}
          </span>
          <Button size="xs" variant="ghost" onClick={() => !disabled && onChange({ path: [net.from] })} disabled={path.length < 2}>
            Clear
          </Button>
        </span>
      </div>
    </Stage>
  );
}
