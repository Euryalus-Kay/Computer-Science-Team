import { Marked } from "marked";
import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { createHash } from "node:crypto";

const tockGrammar = {
  name: "tock",
  scopeName: "source.tock",
  patterns: [
    { match: "#.*$", name: "comment.line.number-sign.tock" },
    { begin: '"', end: '"', name: "string.quoted.double.tock" },
    { match: "\\b(if|then|else|end|for|in|do|while|repeat|times|say|read|and|or|not)\\b", name: "keyword.control.tock" },
    { match: "\\b(true|false)\\b", name: "constant.language.tock" },
    {
      match: "\\b(range|len|sum|max|min|abs|text|num|keep|map|fold|take|sort|rev|count)\\b",
      name: "support.function.tock",
    },
    { match: "\\b\\d+\\b", name: "constant.numeric.tock" },
    { match: "<-|->|\\|>|!=|<=|>=|[+\\-*/%=<>]", name: "keyword.operator.tock" },
  ],
};

const LANG_ALIASES: Record<string, string> = {
  py: "python",
  python3: "python",
  "c++": "cpp",
  cc: "cpp",
  js: "javascript",
  ts: "typescript",
  sh: "bash",
  shell: "bash",
  console: "bash",
  kt: "kotlin",
  cs: "csharp",
  rb: "ruby",
  pseudo: "tock",
  pseudocode: "tock",
};

let highlighter: Promise<HighlighterCore> | null = null;
function getHighlighter() {
  highlighter ??= createHighlighterCore({
    themes: [import("shiki/themes/github-light.mjs"), import("shiki/themes/github-dark.mjs")],
    langs: [
      import("shiki/langs/python.mjs"),
      import("shiki/langs/java.mjs"),
      import("shiki/langs/cpp.mjs"),
      import("shiki/langs/c.mjs"),
      import("shiki/langs/javascript.mjs"),
      import("shiki/langs/typescript.mjs"),
      import("shiki/langs/go.mjs"),
      import("shiki/langs/rust.mjs"),
      import("shiki/langs/bash.mjs"),
      import("shiki/langs/json.mjs"),
      import("shiki/langs/sql.mjs"),
      import("shiki/langs/kotlin.mjs"),
      import("shiki/langs/csharp.mjs"),
      import("shiki/langs/ruby.mjs"),
      tockGrammar as never,
    ],
    engine: createJavaScriptRegexEngine(),
  });
  return highlighter;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const cache = new Map<string, string>();

/**
 * Renders trusted-author markdown to HTML. Raw HTML in the source is escaped,
 * links open safely, and fenced code is highlighted for light and dark themes.
 */
export async function renderMarkdown(md: string): Promise<string> {
  if (!md) return "";
  const key = createHash("sha1").update(md).digest("hex");
  const hit = cache.get(key);
  if (hit) return hit;
  const hl = await getHighlighter();
  const loaded = new Set(hl.getLoadedLanguages());
  const marked = new Marked({ gfm: true, breaks: false, async: false });
  marked.use({
    renderer: {
      html({ text }) {
        return escapeHtml(text);
      },
      code({ text, lang }) {
        const raw = (lang ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
        const name = LANG_ALIASES[raw] ?? raw;
        if (name && loaded.has(name)) {
          return hl.codeToHtml(text, {
            lang: name,
            themes: { light: "github-light", dark: "github-dark" },
            defaultColor: false,
          });
        }
        return `<pre><code>${escapeHtml(text)}</code></pre>`;
      },
      link({ href, title, tokens }) {
        const inner = this.parser.parseInline(tokens);
        const safe = /^(https?:|mailto:|\/|#)/i.test(href) ? href : "#";
        const ext = /^https?:/i.test(safe);
        return `<a href="${escapeHtml(safe)}"${title ? ` title="${escapeHtml(title)}"` : ""}${ext ? ' target="_blank" rel="noopener noreferrer"' : ""}>${inner}</a>`;
      },
      image({ href, title, text }) {
        const safe = /^(https?:|\/|data:image\/)/i.test(href) ? href : "";
        return safe ? `<img src="${escapeHtml(safe)}" alt="${escapeHtml(text)}"${title ? ` title="${escapeHtml(title)}"` : ""} loading="lazy" />` : "";
      },
    },
  });
  const html = marked.parse(md) as string;
  if (cache.size > 300) cache.delete(cache.keys().next().value as string);
  cache.set(key, html);
  return html;
}

/** Highlights a single block of code (used for test prompts and slide snippets). */
export async function highlightCode(code: string, lang: string): Promise<string> {
  const hl = await getHighlighter();
  const name = LANG_ALIASES[lang] ?? lang;
  if (!hl.getLoadedLanguages().includes(name)) return `<pre><code>${escapeHtml(code)}</code></pre>`;
  return hl.codeToHtml(code, { lang: name, themes: { light: "github-light", dark: "github-dark" }, defaultColor: false });
}
