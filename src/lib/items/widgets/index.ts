import type { WidgetModule } from "../types";
import { figures, gears, circuit, paths } from "./visual";
import { liars, logicGrid, stride, cipher } from "./logic";
import { robotTrace, robotBuild, rail, scale, lights, network } from "./machines";
import { tockTrace, tockReverse, tockWrite } from "./tock";
import { terminal } from "./terminal";
import { lock } from "./lock";

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
};

export const WIDGET_LABELS: Record<string, string> = {
  figures: "Dot figures",
  gears: "Gear train",
  circuit: "Logic circuit",
  paths: "Grid paths",
  liars: "Who is lying",
  "logic-grid": "Logic grid",
  stride: "Infer a function",
  cipher: "Cipher",
  "robot-trace": "Robot trace",
  "robot-build": "Robot program",
  rail: "Rail yard",
  scale: "Balance scale",
  lights: "Lights",
  network: "Network route",
  "tock-trace": "Tock: trace",
  "tock-reverse": "Tock: find the input",
  "tock-write": "Tock: write a program",
  terminal: "Terminal",
  lock: "Code lock",
};
