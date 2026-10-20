/**
 * Tock: a small made-up language used in the intro logic test.
 * Members learn it from a one-page reference, so semantics are deliberately simple
 * but a little different from Python or Java (1-based lists, inclusive ranges, pipes).
 */

export type TockValue = number | string | boolean | TockValue[] | TockFn;
type TockFn = { kind: "fn"; name: string; call: (args: TockValue[], line: number) => TockValue };

export class TockError extends Error {
  constructor(
    public line: number,
    message: string,
  ) {
    super(message);
  }
}

/* ------------------------------------------------------------------ lexer */

type Tok =
  | { t: "num"; v: number; line: number }
  | { t: "str"; v: string; line: number }
  | { t: "id"; v: string; line: number }
  | { t: "kw"; v: string; line: number }
  | { t: "op"; v: string; line: number }
  | { t: "nl"; line: number }
  | { t: "eof"; line: number };

const KEYWORDS = new Set(["if", "then", "else", "end", "for", "in", "do", "while", "repeat", "times", "say", "read", "and", "or", "not", "true", "false"]);
const OPS = ["<-", "->", "|>", "!=", "<=", ">=", "=", "<", ">", "+", "-", "*", "/", "%", "(", ")", "[", "]", ","];

function lex(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  let line = 1;
  const push = (t: Tok) => toks.push(t);
  while (i < src.length) {
    const c = src[i];
    if (c === "\n" || c === ";") {
      if (toks.length && toks[toks.length - 1].t !== "nl") push({ t: "nl", line });
      if (c === "\n") line++;
      i++;
      continue;
    }
    if (c === " " || c === "\t" || c === "\r") {
      i++;
      continue;
    }
    if (c === "#") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9]/.test(src[j])) j++;
      push({ t: "num", v: Number(src.slice(i, j)), line });
      i = j;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let s = "";
      while (j < src.length && src[j] !== '"') {
        if (src[j] === "\n") throw new TockError(line, "Text is missing its closing quote");
        if (src[j] === "\\" && j + 1 < src.length) {
          const n = src[j + 1];
          s += n === "n" ? "\n" : n;
          j += 2;
        } else s += src[j++];
      }
      if (j >= src.length) throw new TockError(line, "Text is missing its closing quote");
      push({ t: "str", v: s, line });
      i = j + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      const w = src.slice(i, j);
      push(KEYWORDS.has(w) ? { t: "kw", v: w, line } : { t: "id", v: w, line });
      i = j;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (op) {
      push({ t: "op", v: op, line });
      i += op.length;
      continue;
    }
    throw new TockError(line, `Unexpected character "${c}"`);
  }
  push({ t: "nl", line });
  push({ t: "eof", line });
  return toks;
}

/* ----------------------------------------------------------------- parser */

type Expr =
  | { k: "num"; v: number; line: number }
  | { k: "str"; v: string; line: number }
  | { k: "bool"; v: boolean; line: number }
  | { k: "read"; line: number }
  | { k: "var"; name: string; line: number }
  | { k: "list"; items: Expr[]; line: number }
  | { k: "bin"; op: string; a: Expr; b: Expr; line: number }
  | { k: "not"; e: Expr; line: number }
  | { k: "neg"; e: Expr; line: number }
  | { k: "index"; target: Expr; index: Expr; line: number }
  | { k: "call"; fn: Expr; args: Expr[]; line: number }
  | { k: "lambda"; params: string[]; body: Expr; line: number }
  | { k: "pipe"; value: Expr; fn: Expr; line: number };

type Stmt =
  | { k: "say"; args: Expr[]; line: number }
  | { k: "assign"; name: string; value: Expr; line: number }
  | { k: "setIndex"; name: string; index: Expr; value: Expr; line: number }
  | { k: "if"; cond: Expr; then: Stmt[]; else: Stmt[] | null; line: number }
  | { k: "for"; name: string; iter: Expr; body: Stmt[]; line: number }
  | { k: "while"; cond: Expr; body: Stmt[]; line: number }
  | { k: "repeat"; count: Expr; body: Stmt[]; line: number };

class Parser {
  i = 0;
  constructor(private toks: Tok[]) {}
  peek(o = 0) {
    return this.toks[Math.min(this.i + o, this.toks.length - 1)];
  }
  next() {
    return this.toks[this.i++];
  }
  isKw(v: string, o = 0) {
    const t = this.peek(o);
    return t.t === "kw" && t.v === v;
  }
  isOp(v: string, o = 0) {
    const t = this.peek(o);
    return t.t === "op" && t.v === v;
  }
  expectKw(v: string) {
    const t = this.next();
    if (t.t !== "kw" || t.v !== v) throw new TockError(t.line, `Expected "${v}" ${describe(t)}`);
  }
  expectOp(v: string) {
    const t = this.next();
    if (t.t !== "op" || t.v !== v) throw new TockError(t.line, `Expected "${v}" ${describe(t)}`);
  }
  skipNl() {
    while (this.peek().t === "nl") this.i++;
  }

  program(): Stmt[] {
    const body = this.block([]);
    const t = this.peek();
    if (t.t !== "eof") throw new TockError(t.line, `Unexpected ${tokText(t)}`);
    return body;
  }

  /** Statements until one of `stops` keywords (or EOF). */
  block(stops: string[]): Stmt[] {
    const out: Stmt[] = [];
    this.skipNl();
    while (true) {
      const t = this.peek();
      if (t.t === "eof") break;
      if (t.t === "kw" && stops.includes(t.v)) break;
      out.push(this.stmt());
      const after = this.peek();
      if (after.t === "nl") this.skipNl();
      else if (!(after.t === "eof" || (after.t === "kw" && stops.includes(after.v)))) {
        throw new TockError(after.line, `Expected a new line ${describe(after)}`);
      }
    }
    return out;
  }

  stmt(): Stmt {
    const t = this.peek();
    const line = t.line;
    if (t.t === "kw") {
      switch (t.v) {
        case "say": {
          this.next();
          const args = [this.expr()];
          while (this.isOp(",")) {
            this.next();
            args.push(this.expr());
          }
          return { k: "say", args, line };
        }
        case "if": {
          this.next();
          const cond = this.expr();
          this.expectKw("then");
          const then = this.block(["else", "end"]);
          let els: Stmt[] | null = null;
          if (this.isKw("else")) {
            this.next();
            els = this.block(["end"]);
          }
          this.expectKw("end");
          return { k: "if", cond, then, else: els, line };
        }
        case "for": {
          this.next();
          const name = this.next();
          if (name.t !== "id") throw new TockError(name.line, `Expected a variable name after "for"`);
          this.expectKw("in");
          const iter = this.expr();
          this.expectKw("do");
          const body = this.block(["end"]);
          this.expectKw("end");
          return { k: "for", name: name.v, iter, body, line };
        }
        case "while": {
          this.next();
          const cond = this.expr();
          this.expectKw("do");
          const body = this.block(["end"]);
          this.expectKw("end");
          return { k: "while", cond, body, line };
        }
        case "repeat": {
          this.next();
          const count = this.expr();
          this.expectKw("times");
          const body = this.block(["end"]);
          this.expectKw("end");
          return { k: "repeat", count, body, line };
        }
      }
    }
    if (t.t === "id") {
      if (this.isOp("<-", 1)) {
        this.next();
        this.next();
        return { k: "assign", name: t.v, value: this.expr(), line };
      }
      if (this.isOp("[", 1)) {
        // Could be xs[i] <- v. Parse index, then check for <-.
        const save = this.i;
        this.next();
        this.next();
        const index = this.expr();
        if (this.isOp("]") && this.isOp("<-", 1)) {
          this.next();
          this.next();
          return { k: "setIndex", name: t.v, index, value: this.expr(), line };
        }
        this.i = save;
      }
    }
    if (t.t === "op" && t.v === "=") throw new TockError(line, `Use "<-" to store a value`);
    throw new TockError(line, `Expected a statement ${describe(t)}`);
  }

  expr(): Expr {
    return this.or();
  }
  or(): Expr {
    let e = this.and();
    while (this.isKw("or")) {
      const line = this.next().line;
      e = { k: "bin", op: "or", a: e, b: this.and(), line };
    }
    return e;
  }
  and(): Expr {
    let e = this.not();
    while (this.isKw("and")) {
      const line = this.next().line;
      e = { k: "bin", op: "and", a: e, b: this.not(), line };
    }
    return e;
  }
  not(): Expr {
    if (this.isKw("not")) {
      const line = this.next().line;
      return { k: "not", e: this.not(), line };
    }
    return this.cmp();
  }
  cmp(): Expr {
    const a = this.add();
    const t = this.peek();
    if (t.t === "op" && ["=", "!=", "<", ">", "<=", ">="].includes(t.v)) {
      this.next();
      return { k: "bin", op: t.v, a, b: this.add(), line: t.line };
    }
    if (t.t === "op" && t.v === "<-") throw new TockError(t.line, `"<-" stores a value and must start the line`);
    return a;
  }
  add(): Expr {
    let e = this.mul();
    while (this.isOp("+") || this.isOp("-")) {
      const t = this.next() as Extract<Tok, { t: "op" }>;
      e = { k: "bin", op: t.v, a: e, b: this.mul(), line: t.line };
    }
    return e;
  }
  mul(): Expr {
    let e = this.unary();
    while (this.isOp("*") || this.isOp("/") || this.isOp("%")) {
      const t = this.next() as Extract<Tok, { t: "op" }>;
      e = { k: "bin", op: t.v, a: e, b: this.unary(), line: t.line };
    }
    return e;
  }
  unary(): Expr {
    if (this.isOp("-")) {
      const line = this.next().line;
      return { k: "neg", e: this.unary(), line };
    }
    return this.pipe();
  }
  /** Pipes bind tighter than math and comparisons, so `xs |> len > 3` compares the length. */
  pipe(): Expr {
    let e = this.postfix();
    while (this.isOp("|>")) {
      const line = this.next().line;
      e = { k: "pipe", value: e, fn: this.postfix(), line };
    }
    return e;
  }
  postfix(): Expr {
    let e = this.primary();
    while (true) {
      if (this.isOp("[")) {
        const line = this.next().line;
        const index = this.expr();
        this.expectOp("]");
        e = { k: "index", target: e, index, line };
      } else if (this.isOp("(")) {
        const line = this.next().line;
        const args: Expr[] = [];
        if (!this.isOp(")")) {
          args.push(this.expr());
          while (this.isOp(",")) {
            this.next();
            args.push(this.expr());
          }
        }
        this.expectOp(")");
        e = { k: "call", fn: e, args, line };
      } else break;
    }
    return e;
  }
  lambdaAhead(): string[] | null {
    if (this.peek().t === "id" && this.isOp("->", 1)) return [(this.peek() as { v: string }).v];
    if (this.isOp("(")) {
      const names: string[] = [];
      let j = 1;
      while (true) {
        const t = this.peek(j);
        if (t.t !== "id") return null;
        names.push(t.v);
        j++;
        if (this.isOp(",", j)) {
          j++;
          continue;
        }
        if (this.isOp(")", j) && this.isOp("->", j + 1)) return names;
        return null;
      }
    }
    return null;
  }
  primary(): Expr {
    const params = this.lambdaAhead();
    if (params) {
      const line = this.peek().line;
      if (this.isOp("(")) {
        this.next();
        while (!this.isOp(")")) this.next();
        this.next();
      } else this.next();
      this.expectOp("->");
      return { k: "lambda", params, body: this.or(), line };
    }
    const t = this.next();
    switch (t.t) {
      case "num":
        return { k: "num", v: t.v, line: t.line };
      case "str":
        return { k: "str", v: t.v, line: t.line };
      case "id":
        return { k: "var", name: t.v, line: t.line };
      case "kw":
        if (t.v === "true" || t.v === "false") return { k: "bool", v: t.v === "true", line: t.line };
        if (t.v === "read") return { k: "read", line: t.line };
        throw new TockError(t.line, `Unexpected "${t.v}"`);
      case "op":
        if (t.v === "(") {
          const e = this.expr();
          this.expectOp(")");
          return e;
        }
        if (t.v === "[") {
          const items: Expr[] = [];
          if (!this.isOp("]")) {
            items.push(this.expr());
            while (this.isOp(",")) {
              this.next();
              items.push(this.expr());
            }
          }
          this.expectOp("]");
          return { k: "list", items, line: t.line };
        }
        throw new TockError(t.line, `Unexpected "${t.v}"`);
      default:
        throw new TockError(t.line, `Expected a value ${describe(t)}`);
    }
  }
}

function tokText(t: Tok) {
  if (t.t === "nl") return "end of line";
  if (t.t === "eof") return "end of program";
  if (t.t === "str") return `"${t.v}"`;
  return `"${String(t.v)}"`;
}
function describe(t: Tok) {
  return `but found ${tokText(t)}`;
}

/* ------------------------------------------------------------- evaluation */

export type RunResult = { output: string; error: { line: number; message: string } | null; steps: number };

const MAX_STEPS = 300_000;
const MAX_LINES = 5_000;

function typeName(v: TockValue): string {
  if (typeof v === "number") return "a number";
  if (typeof v === "string") return "text";
  if (typeof v === "boolean") return "true/false";
  if (Array.isArray(v)) return "a list";
  return "a function";
}

export function format(v: TockValue): string {
  if (Array.isArray(v)) return `[${v.map(format).join(", ")}]`;
  if (typeof v === "object") return `<${v.name}>`;
  return String(v);
}

function equal(a: TockValue, b: TockValue): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => equal(x, b[i]));
  return a === b;
}

const floorDiv = (a: number, b: number) => Math.floor(a / b);
const floorMod = (a: number, b: number) => ((a % b) + b) % b;

export function range(a: number, b: number, s = 1): number[] {
  if (!Number.isInteger(a) || !Number.isInteger(b) || !Number.isInteger(s)) throw new Error("range needs whole numbers");
  if (s <= 0) throw new Error("range step must be 1 or more");
  const out: number[] = [];
  if (a <= b) for (let x = a; x <= b; x += s) out.push(x);
  else for (let x = a; x >= b; x -= s) out.push(x);
  return out;
}

export function runTock(src: string, input = "", opts: { maxSteps?: number } = {}): RunResult {
  const lines: string[] = [];
  let steps = 0;
  const maxSteps = opts.maxSteps ?? MAX_STEPS;
  const inputLines = input.replace(/\r/g, "").split("\n");
  if (inputLines.length && inputLines[inputLines.length - 1] === "") inputLines.pop();
  let inPos = 0;
  const globals = new Map<string, TockValue>();

  const tick = (line: number) => {
    if (++steps > maxSteps) throw new TockError(line, "Program ran too long. Check for a loop that never ends.");
  };
  const num = (v: TockValue, line: number, what: string): number => {
    if (typeof v !== "number") throw new TockError(line, `${what} needs a number, got ${typeName(v)}`);
    return v;
  };
  const list = (v: TockValue, line: number, what: string): TockValue[] => {
    if (!Array.isArray(v)) throw new TockError(line, `${what} needs a list, got ${typeName(v)}`);
    return v;
  };
  const bool = (v: TockValue, line: number): boolean => {
    if (typeof v !== "boolean") throw new TockError(line, `Expected true or false, got ${typeName(v)}`);
    return v;
  };
  const fn = (name: string, call: TockFn["call"]): TockFn => ({ kind: "fn", name, call });
  const callFn = (f: TockValue, args: TockValue[], line: number): TockValue => {
    if (typeof f !== "object" || Array.isArray(f)) throw new TockError(line, `${format(f)} is not a function`);
    tick(line);
    return f.call(args, line);
  };
  const arity = (name: string, args: TockValue[], n: number | number[], line: number) => {
    const ok = Array.isArray(n) ? n.includes(args.length) : args.length === n;
    if (!ok) throw new TockError(line, `${name} takes ${Array.isArray(n) ? n.join(" or ") : n} value${n === 1 ? "" : "s"}`);
  };
  const seq = (v: TockValue, line: number, what: string): TockValue[] =>
    typeof v === "string" ? v.split("") : list(v, line, what);

  const builtins: Record<string, TockFn> = {
    range: fn("range", (a, line) => {
      arity("range", a, [2, 3], line);
      try {
        return range(num(a[0], line, "range"), num(a[1], line, "range"), a[2] === undefined ? 1 : num(a[2], line, "range"));
      } catch (e) {
        if (e instanceof TockError) throw e;
        throw new TockError(line, (e as Error).message);
      }
    }),
    len: fn("len", (a, line) => {
      arity("len", a, 1, line);
      if (typeof a[0] === "string") return a[0].length;
      return list(a[0], line, "len").length;
    }),
    sum: fn("sum", (a, line) => {
      arity("sum", a, 1, line);
      return list(a[0], line, "sum").reduce<number>((s, x) => s + num(x, line, "sum"), 0);
    }),
    max: fn("max", (a, line) => {
      arity("max", a, 1, line);
      const xs = list(a[0], line, "max").map((x) => num(x, line, "max"));
      if (!xs.length) throw new TockError(line, "max of an empty list");
      return Math.max(...xs);
    }),
    min: fn("min", (a, line) => {
      arity("min", a, 1, line);
      const xs = list(a[0], line, "min").map((x) => num(x, line, "min"));
      if (!xs.length) throw new TockError(line, "min of an empty list");
      return Math.min(...xs);
    }),
    abs: fn("abs", (a, line) => {
      arity("abs", a, 1, line);
      return Math.abs(num(a[0], line, "abs"));
    }),
    text: fn("text", (a, line) => {
      arity("text", a, 1, line);
      return format(a[0]);
    }),
    num: fn("num", (a, line) => {
      arity("num", a, 1, line);
      const s = String(a[0]).trim();
      if (!/^-?\d+$/.test(s)) throw new TockError(line, `num can't read "${s}" as a number`);
      return Number(s);
    }),
    sort: fn("sort", (a, line) => {
      arity("sort", a, 1, line);
      const xs = [...list(a[0], line, "sort")];
      return xs.sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
    }),
    rev: fn("rev", (a, line) => {
      arity("rev", a, 1, line);
      if (typeof a[0] === "string") return a[0].split("").reverse().join("");
      return [...list(a[0], line, "rev")].reverse();
    }),
    keep: fn("keep", (a, line) => {
      arity("keep", a, 1, line);
      const pred = a[0];
      return fn("keep", (b, l2) => seq(b[0], l2, "keep").filter((x) => bool(callFn(pred, [x], l2), l2)));
    }),
    count: fn("count", (a, line) => {
      arity("count", a, 1, line);
      const pred = a[0];
      return fn("count", (b, l2) => seq(b[0], l2, "count").filter((x) => bool(callFn(pred, [x], l2), l2)).length);
    }),
    map: fn("map", (a, line) => {
      arity("map", a, 1, line);
      const f = a[0];
      return fn("map", (b, l2) => seq(b[0], l2, "map").map((x) => callFn(f, [x], l2)));
    }),
    fold: fn("fold", (a, line) => {
      arity("fold", a, 2, line);
      const [init, f] = a;
      return fn("fold", (b, l2) => seq(b[0], l2, "fold").reduce<TockValue>((acc, x) => callFn(f, [acc, x], l2), init));
    }),
    take: fn("take", (a, line) => {
      arity("take", a, 1, line);
      const n = num(a[0], line, "take");
      return fn("take", (b, l2) => seq(b[0], l2, "take").slice(0, Math.max(0, n)));
    }),
  };

  const lookup = (name: string, line: number, scope?: Map<string, TockValue>): TockValue => {
    if (scope?.has(name)) return scope.get(name)!;
    if (globals.has(name)) return globals.get(name)!;
    if (name in builtins) return builtins[name];
    throw new TockError(line, `"${name}" has no value yet`);
  };

  // A variable named like a built-in (say, count) still lets you call the built-in.
  const callee = (e: Expr, scope?: Map<string, TockValue>): TockValue => {
    const v = evalE(e, scope);
    if (e.k === "var" && (typeof v !== "object" || Array.isArray(v)) && e.name in builtins) return builtins[e.name];
    return v;
  };

  const evalE = (e: Expr, scope?: Map<string, TockValue>): TockValue => {
    switch (e.k) {
      case "num":
        return e.v;
      case "str":
        return e.v;
      case "bool":
        return e.v;
      case "read": {
        if (inPos >= inputLines.length) throw new TockError(e.line, "read found no more input");
        const s = inputLines[inPos++].trim();
        return /^-?\d+$/.test(s) ? Number(s) : s;
      }
      case "var":
        return lookup(e.name, e.line, scope);
      case "list":
        return e.items.map((x) => evalE(x, scope));
      case "neg":
        return -num(evalE(e.e, scope), e.line, "-");
      case "not":
        return !bool(evalE(e.e, scope), e.line);
      case "lambda": {
        const captured = scope;
        return fn("function", (args, line) => {
          if (args.length !== e.params.length)
            throw new TockError(line, `This function takes ${e.params.length} value${e.params.length === 1 ? "" : "s"}`);
          const inner = new Map(captured ?? []);
          e.params.forEach((p, i) => inner.set(p, args[i]));
          return evalE(e.body, inner);
        });
      }
      case "pipe": {
        const v = evalE(e.value, scope);
        const f = callee(e.fn, scope);
        return callFn(f, [v], e.line);
      }
      case "call": {
        const f = callee(e.fn, scope);
        return callFn(f, e.args.map((x) => evalE(x, scope)), e.line);
      }
      case "index": {
        const target = evalE(e.target, scope);
        const i = num(evalE(e.index, scope), e.line, "A position");
        const xs = typeof target === "string" ? target.split("") : list(target, e.line, "[ ]");
        if (i === 0) throw new TockError(e.line, "Positions start at 1, so [0] does not exist");
        const j = i > 0 ? i - 1 : xs.length + i;
        if (j < 0 || j >= xs.length) throw new TockError(e.line, `Position ${i} is outside a list of length ${xs.length}`);
        return xs[j];
      }
      case "bin": {
        if (e.op === "and") return bool(evalE(e.a, scope), e.line) ? bool(evalE(e.b, scope), e.line) : false;
        if (e.op === "or") return bool(evalE(e.a, scope), e.line) ? true : bool(evalE(e.b, scope), e.line);
        const a = evalE(e.a, scope);
        const b = evalE(e.b, scope);
        switch (e.op) {
          case "+":
            if (Array.isArray(a) && Array.isArray(b)) return [...a, ...b];
            if (typeof a === "string" || typeof b === "string") {
              if (Array.isArray(a) || Array.isArray(b)) throw new TockError(e.line, "Can't add text and a list");
              return format(a) + format(b);
            }
            return num(a, e.line, "+") + num(b, e.line, "+");
          case "-":
            return num(a, e.line, "-") - num(b, e.line, "-");
          case "*":
            if (typeof a === "string" && typeof b === "number") return a.repeat(Math.max(0, b));
            return num(a, e.line, "*") * num(b, e.line, "*");
          case "/": {
            const d = num(b, e.line, "/");
            if (d === 0) throw new TockError(e.line, "Division by zero");
            return floorDiv(num(a, e.line, "/"), d);
          }
          case "%": {
            const d = num(b, e.line, "%");
            if (d === 0) throw new TockError(e.line, "Division by zero");
            return floorMod(num(a, e.line, "%"), d);
          }
          case "=":
            return equal(a, b);
          case "!=":
            return !equal(a, b);
          default: {
            if (typeof a === "number" && typeof b === "number") {
              if (e.op === "<") return a < b;
              if (e.op === ">") return a > b;
              if (e.op === "<=") return a <= b;
              return a >= b;
            }
            if (typeof a === "string" && typeof b === "string") {
              if (e.op === "<") return a < b;
              if (e.op === ">") return a > b;
              if (e.op === "<=") return a <= b;
              return a >= b;
            }
            throw new TockError(e.line, `Can't compare ${typeName(a)} with ${typeName(b)}`);
          }
        }
      }
    }
  };

  const store = (v: TockValue) => (Array.isArray(v) ? [...v] : v);

  const exec = (stmts: Stmt[]) => {
    for (const s of stmts) {
      tick(s.line);
      switch (s.k) {
        case "say": {
          if (lines.length >= MAX_LINES) throw new TockError(s.line, "Too much output");
          lines.push(s.args.map((a) => format(evalE(a))).join(" "));
          break;
        }
        case "assign":
          globals.set(s.name, store(evalE(s.value)));
          break;
        case "setIndex": {
          const xs = list(lookup(s.name, s.line), s.line, "[ ] <-");
          const i = num(evalE(s.index), s.line, "A position");
          if (i === 0) throw new TockError(s.line, "Positions start at 1, so [0] does not exist");
          const j = i > 0 ? i - 1 : xs.length + i;
          if (j < 0 || j >= xs.length) throw new TockError(s.line, `Position ${i} is outside a list of length ${xs.length}`);
          xs[j] = store(evalE(s.value));
          break;
        }
        case "if":
          if (bool(evalE(s.cond), s.line)) exec(s.then);
          else if (s.else) exec(s.else);
          break;
        case "for": {
          const v = evalE(s.iter);
          const items = typeof v === "string" ? v.split("") : [...list(v, s.line, "for")];
          for (const x of items) {
            tick(s.line);
            globals.set(s.name, store(x));
            exec(s.body);
          }
          break;
        }
        case "while":
          while (bool(evalE(s.cond), s.line)) {
            tick(s.line);
            exec(s.body);
          }
          break;
        case "repeat": {
          const n = num(evalE(s.count), s.line, "repeat");
          if (!Number.isInteger(n) || n < 0) throw new TockError(s.line, "repeat needs a whole number of 0 or more");
          for (let i = 0; i < n; i++) {
            tick(s.line);
            exec(s.body);
          }
          break;
        }
      }
    }
  };

  try {
    const program = new Parser(lex(src)).program();
    exec(program);
    return { output: lines.join("\n") + (lines.length ? "\n" : ""), error: null, steps };
  } catch (e) {
    if (e instanceof TockError) {
      return { output: lines.join("\n") + (lines.length ? "\n" : ""), error: { line: e.line, message: e.message }, steps };
    }
    if (e instanceof RangeError) {
      return { output: lines.join("\n"), error: { line: 0, message: "Program used too much memory or recursion" }, steps };
    }
    throw e;
  }
}

/** Normalizes answers like "[5, 3, 2, 0]" or "5 3 2 0" for comparison. */
export function normalizeListAnswer(s: string): string {
  return s
    .replace(/[[\],]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
