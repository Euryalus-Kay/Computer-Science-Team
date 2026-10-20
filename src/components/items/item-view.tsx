"use client";

import type { ComponentType } from "react";
import type { ItemProps } from "./types";
import { Mcq, Multi, Short, Numeric, TextAnswer, Order, Match } from "./generic";
import { Figures, Gears, Circuit, Paths } from "./widgets/visual";
import { Liars, LogicGrid, Stride, Cipher } from "./widgets/logic";
import { RobotTrace, RobotBuild, Rail, Scale, Lights, Network } from "./widgets/machines";
import { TockTrace, TockReverse, TockWrite } from "./widgets/tock";
import { Terminal } from "./widgets/terminal";
import { Lock } from "./widgets/lock";

const WIDGET_VIEWS: Record<string, ComponentType<ItemProps>> = {
  figures: Figures,
  gears: Gears,
  circuit: Circuit,
  paths: Paths,
  liars: Liars,
  "logic-grid": LogicGrid,
  stride: Stride,
  cipher: Cipher,
  "robot-trace": RobotTrace,
  "robot-build": RobotBuild,
  rail: Rail,
  scale: Scale,
  lights: Lights,
  network: Network,
  "tock-trace": TockTrace,
  "tock-reverse": TockReverse,
  "tock-write": TockWrite,
  terminal: Terminal,
  lock: Lock,
};

const GENERIC: Record<string, ComponentType<ItemProps>> = {
  mcq: Mcq,
  multi: Multi,
  short: Short,
  numeric: Numeric,
  text: TextAnswer,
  order: Order,
  match: Match,
};

export function ItemView(props: ItemProps & { widget?: string }) {
  const View = props.item.type === "widget" ? WIDGET_VIEWS[props.widget ?? ""] : GENERIC[props.item.type];
  if (!View) return <div className="text-sm text-red">This question type can&apos;t be shown.</div>;
  return <View {...props} />;
}
