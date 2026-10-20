import { makeRng, itemSeed } from "./rng";
import { WIDGETS } from "./widgets";
import * as G from "./generic";
import type { AnyConfig, Generated, GradeResult, PublicItem } from "./types";
import type { contestItems } from "@/lib/db/schema";
import { renderMarkdown } from "@/lib/markdown";

export type ItemRow = typeof contestItems.$inferSelect;

function resolveConfig(item: ItemRow, attemptSeed: number) {
  const cfg = (item.config ?? {}) as AnyConfig;
  const seedKey = typeof cfg.seedKey === "string" ? cfg.seedKey : item.id;
  const rng = makeRng(itemSeed(attemptSeed, seedKey));
  let config: AnyConfig = cfg;
  if (Array.isArray(cfg.variants) && cfg.variants.length) {
    const v = rng.pick(cfg.variants);
    config = { ...cfg, ...v, vars: { ...(cfg.vars ?? {}), ...((v.vars as Record<string, string | number>) ?? {}) } };
  }
  return { rng, config };
}

/** Builds this attempt's version of an item: public data, secret key, prompt variables. */
export function generateItem(item: ItemRow, attemptSeed: number): Generated {
  const { rng, config } = resolveConfig(item, attemptSeed);
  let g: Generated;
  switch (item.type) {
    case "mcq":
      g = G.genMcq(rng, config as never);
      break;
    case "multi":
      g = G.genMulti(rng, config as never);
      break;
    case "short":
      g = G.genShort(rng, config as never);
      break;
    case "numeric":
      g = G.genNumeric(rng, config as never);
      break;
    case "order":
      g = G.genOrder(rng, config as never);
      break;
    case "match":
      g = G.genMatch(rng, config as never);
      break;
    case "text":
      g = G.genText(rng, config as never);
      break;
    case "code":
      g = { pub: { problemId: item.problemId, languages: (config.languages as string[]) ?? null }, key: {} };
      break;
    case "widget": {
      const w = WIDGETS[String(config.widget)];
      if (!w) throw new Error(`Unknown widget ${config.widget}`);
      g = w.generate(rng, config);
      break;
    }
    default:
      g = { pub: {}, key: {} };
  }
  return { ...g, vars: { ...(config.vars ?? {}), ...(g.vars ?? {}) } };
}

export function fillVars(text: string, vars: Record<string, string | number> | undefined) {
  if (!vars) return text;
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export async function publicItem(item: ItemRow, attemptSeed: number): Promise<PublicItem> {
  const g = generateItem(item, attemptSeed);
  return {
    id: item.id,
    type: item.type as PublicItem["type"],
    title: item.title,
    section: item.section,
    points: item.points,
    grading: item.grading,
    promptHtml: await renderMarkdown(fillVars(item.prompt, g.vars)),
    data: g.pub,
  };
}

/** True when a person or Claude has to look at the answer. */
export function needsReview(item: ItemRow): boolean {
  return item.type === "text" || item.grading === "ai" || item.grading === "manual";
}

export function gradeItem(item: ItemRow, attemptSeed: number, response: unknown, state: unknown): GradeResult {
  if (needsReview(item)) return { fraction: null };
  if (item.type === "code") return { fraction: null };
  const g = generateItem(item, attemptSeed);
  const r = response as never;
  switch (item.type) {
    case "mcq":
      return G.gradeMcq(g.pub, g.key as never, r);
    case "multi":
      return G.gradeMulti(g.pub, g.key as never, r);
    case "short":
      return G.gradeShort(g.pub, g.key as never, r);
    case "numeric":
      return G.gradeNumeric(g.pub, g.key as never, r);
    case "order":
      return G.gradeOrder(g.pub, g.key as never, r);
    case "match":
      return G.gradeMatch(g.pub, g.key as never, r);
    case "widget": {
      const w = WIDGETS[String((item.config as AnyConfig).widget)];
      return w.grade(g.pub, g.key, r, state as never);
    }
    default:
      return { fraction: 0 };
  }
}

export function interactItem(item: ItemRow, attemptSeed: number, state: unknown, action: unknown) {
  if (item.type !== "widget") return null;
  const w = WIDGETS[String((item.config as AnyConfig).widget)];
  if (!w?.interact) return null;
  const g = generateItem(item, attemptSeed);
  return w.interact(g.pub, g.key, state as never, action);
}

/** A readable answer key for admins reviewing an attempt. */
export function describeAnswer(item: ItemRow, attemptSeed: number): string | null {
  try {
    const g = generateItem(item, attemptSeed);
    const key = g.key as Record<string, unknown>;
    const pub = g.pub as Record<string, unknown>;
    switch (item.type) {
      case "mcq":
        return String((pub.options as string[])[key.answer as number]);
      case "multi":
        return (key.answers as number[]).map((i) => (pub.options as string[])[i]).join("; ");
      case "short":
        return (key.accept as string[]).join(" or ");
      case "numeric":
        return String(key.answer);
      case "order":
        return (key.order as string[])
          .map((id) => (pub.items as { id: string; text: string }[]).find((x) => x.id === id)?.text)
          .join(" → ");
      case "match":
        return (pub.left as string[])
          .map((l, i) => `${l} → ${(pub.right as { id: number; text: string }[]).find((x) => x.id === (key.answer as number[])[i])?.text}`)
          .join("; ");
      case "text":
        return (key.reference as string) ?? null;
      case "widget": {
        const w = WIDGETS[String((item.config as AnyConfig).widget)];
        return w.describeKey ? w.describeKey(g.pub, g.key) : null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}
