import type { WidgetModule } from "../types";
import { figures, gears, circuit, paths } from "./visual";
import { liars, logicGrid, stride, cipher } from "./logic";
import { robotTrace, robotBuild, rail, scale, lights, network } from "./machines";
import { tockTrace, tockReverse, tockWrite } from "./tock";
import { terminal } from "./terminal";
import { lock } from "./lock";
import { glyph } from "./glyph";
import { door } from "./door";

export const WIDGETS: Record<string, WidgetModule> = {
  figures,
  gears,
  circuit,
  paths,
  liars,
  "logic-grid": logicGrid,
  stride,
  cipher,
  "robot-trace": robotTrace,
  "robot-build": robotBuild,
  rail,
  scale,
  lights,
  network,
  "tock-trace": tockTrace,
  "tock-reverse": tockReverse,
  "tock-write": tockWrite,
  terminal,
  lock,
  glyph,
  door,
};

export { WIDGET_LABELS } from "./labels";
