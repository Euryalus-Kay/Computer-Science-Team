import Anthropic from "@anthropic-ai/sdk";
import { aiConfigured, getSettings } from "@/lib/settings";

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic({ maxRetries: 2, timeout: 120_000 });
  return client;
}

export class AiUnavailable extends Error {}

/**
 * One structured-output call to Claude. Uses the server-side fallback so a request
 * declined by a safety classifier is retried on another model instead of failing.
 */
export async function askJson<T>(opts: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
}): Promise<{ data: T; model: string }> {
  if (!aiConfigured()) throw new AiUnavailable("Add ANTHROPIC_API_KEY to enable Claude.");
  const s = await getSettings();
  if (!s.aiEnabled) throw new AiUnavailable("Claude is turned off in settings.");
  const res = await getClient().beta.messages.create({
    model: s.aiModel || "claude-opus-5-5",
    max_tokens: opts.maxTokens ?? 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    // Everything Claude writes here ends up on the site, which never uses em dashes.
    system: `${opts.system}\n\nNever use em dashes. Use commas, colons, parentheses or periods instead.`,
    messages: [{ role: "user", content: opts.prompt }],
    output_config: {
      effort: opts.effort ?? s.aiEffort ?? "low",
      format: { type: "json_schema", schema: opts.schema },
    },
  });
  if (res.stop_reason === "refusal") throw new Error("Claude declined this request.");
  if (res.stop_reason === "max_tokens") throw new Error("Claude's answer was cut off.");
  const text = res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  return { data: JSON.parse(text) as T, model: res.model };
}
