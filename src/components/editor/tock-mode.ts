import type { StreamParser } from "@codemirror/language";

const KEYWORDS = new Set(["if", "then", "else", "end", "for", "in", "do", "while", "repeat", "times", "say", "read", "and", "or", "not"]);
const BUILTINS = new Set(["range", "len", "sum", "max", "min", "abs", "text", "num", "keep", "map", "fold", "take", "sort", "rev", "count"]);

/** Syntax highlighting for Tock, the made-up language in the intro test. */
export const tockMode: StreamParser<object> = {
  name: "tock",
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.peek() === "#") {
      stream.skipToEnd();
      return "comment";
    }
    if (stream.match(/^"(?:[^"\\]|\\.)*"?/)) return "string";
    if (stream.match(/^\d+/)) return "number";
    if (stream.match(/^(<-|->|\|>|!=|<=|>=)/)) return "operator";
    if (stream.match(/^[A-Za-z_][A-Za-z0-9_]*/)) {
      const w = stream.current();
      if (w === "true" || w === "false") return "atom";
      if (KEYWORDS.has(w)) return "keyword";
      if (BUILTINS.has(w)) return "builtin";
      return "variableName";
    }
    if (stream.match(/^[+\-*/%=<>]/)) return "operator";
    stream.next();
    return null;
  },
  languageData: { commentTokens: { line: "#" } },
};
