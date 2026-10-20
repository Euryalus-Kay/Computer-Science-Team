import { getLanguage, type Language } from "./languages";

export type ExecStatus = "ok" | "compile_error" | "runtime_error" | "timeout" | "memory" | "internal";

export type ExecResult = {
  status: ExecStatus;
  stdout: string;
  stderr: string;
  compileOutput: string;
  timeMs: number | null;
  memoryKb: number | null;
  message?: string;
  provider: string;
};

export type ExecLimits = { timeMs: number; memoryMb: number };

// Full output is kept for checking; callers trim what they display or store.
const MAX_OUT = 16 * 1024 * 1024;
const clip = (s: string | null | undefined) => {
  if (!s) return "";
  return s.length > MAX_OUT ? s.slice(0, MAX_OUT) : s;
};

export function forDisplay(r: ExecResult, limit = 64 * 1024): ExecResult {
  const cut = (s: string) => (s.length > limit ? s.slice(0, limit) + "\n… output truncated" : s);
  return { ...r, stdout: cut(r.stdout), stderr: cut(r.stderr), compileOutput: cut(r.compileOutput) };
}
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const unb64 = (s: string | null | undefined) => (s ? Buffer.from(s, "base64").toString("utf8") : "");

class ProviderError extends Error {
  constructor(
    message: string,
    public retryable = true,
  ) {
    super(message);
  }
}

/* ----------------------------------------------------------------- Judge0 */

function judge0Config() {
  const url = (process.env.JUDGE0_URL || "https://ce.judge0.com").replace(/\/$/, "");
  const key = process.env.JUDGE0_KEY;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key) {
    if (url.includes("rapidapi")) {
      headers["X-RapidAPI-Key"] = key;
      headers["X-RapidAPI-Host"] = new URL(url).host;
    } else headers["X-Auth-Token"] = key;
  }
  return { url, headers };
}

type J0Sub = {
  token: string;
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  time: string | null;
  memory: number | null;
  status: { id: number; description: string };
};

function mapJudge0(s: J0Sub): ExecResult {
  const id = s.status?.id ?? 13;
  const base = {
    stdout: clip(unb64(s.stdout)),
    stderr: clip(unb64(s.stderr)),
    compileOutput: clip(unb64(s.compile_output)),
    timeMs: s.time ? Math.round(parseFloat(s.time) * 1000) : null,
    memoryKb: s.memory ?? null,
    message: unb64(s.message) || (id === 3 || id === 4 ? undefined : s.status?.description),
    provider: "judge0",
  };
  if (id === 3 || id === 4) return { status: "ok", ...base };
  if (id === 5) return { status: "timeout", ...base };
  if (id === 6) return { status: "compile_error", ...base };
  if (id >= 7 && id <= 12) {
    const mem = /memory|SIGKILL/i.test(base.message ?? "") && (s.memory ?? 0) > 0;
    return { status: mem ? "memory" : "runtime_error", ...base };
  }
  return { status: "internal", ...base };
}

async function judge0Batch(lang: Language, code: string, inputs: string[], limits: ExecLimits): Promise<ExecResult[]> {
  if (!lang.judge0) throw new ProviderError("language not on judge0", false);
  const { url, headers } = judge0Config();
  const cpu = Math.min(15, (limits.timeMs * lang.timeFactor) / 1000);
  const results: ExecResult[] = new Array(inputs.length);
  for (let start = 0; start < inputs.length; start += 20) {
    const chunk = inputs.slice(start, start + 20);
    const body = {
      submissions: chunk.map((stdin) => ({
        source_code: b64(code),
        language_id: lang.judge0,
        stdin: b64(stdin),
        cpu_time_limit: Math.max(1, Math.round(cpu * 10) / 10),
        wall_time_limit: Math.min(30, Math.max(3, cpu * 3)),
        memory_limit: Math.min(512_000, limits.memoryMb * 1024),
      })),
    };
    const res = await fetch(`${url}/submissions/batch?base64_encoded=true`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 429 || res.status >= 500) throw new ProviderError(`judge0 ${res.status}`);
    if (!res.ok) throw new ProviderError(`judge0 ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const tokens = ((await res.json()) as { token?: string; error?: string }[]).map((t) => t.token);
    if (tokens.some((t) => !t)) throw new ProviderError("judge0 rejected a submission");
    const deadline = Date.now() + 60_000;
    let pending = new Set(tokens.map((_, i) => i));
    let delay = 400;
    while (pending.size && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(1500, delay * 1.4);
      const ids = [...pending].map((i) => tokens[i]).join(",");
      const r = await fetch(
        `${url}/submissions/batch?tokens=${ids}&base64_encoded=true&fields=token,stdout,stderr,compile_output,message,time,memory,status`,
        { headers, signal: AbortSignal.timeout(15_000) },
      );
      if (r.status === 429 || r.status >= 500) continue;
      if (!r.ok) throw new ProviderError(`judge0 poll ${r.status}`);
      const { submissions } = (await r.json()) as { submissions: J0Sub[] };
      const next = new Set(pending);
      for (const s of submissions) {
        if (!s || s.status.id <= 2) continue;
        const i = tokens.indexOf(s.token);
        if (i >= 0) {
          results[start + i] = mapJudge0(s);
          next.delete(i);
        }
      }
      pending = next;
    }
    if (pending.size) throw new ProviderError("judge0 timed out");
  }
  return results;
}

/* ---------------------------------------------------------------- Wandbox */

function prepareForWandbox(lang: Language, code: string): string {
  if (lang.id === "java") return code.replace(/public\s+(final\s+)?class\s+/g, "$1class ");
  return code;
}

async function wandboxOne(lang: Language, code: string, stdin: string, limits: ExecLimits): Promise<ExecResult> {
  if (!lang.wandbox) throw new ProviderError("language not on wandbox", false);
  const options: Record<string, string> = {};
  if (lang.id === "cpp") options["compiler-option-raw"] = "-O2\n-std=gnu++2b";
  if (lang.id === "c") options["compiler-option-raw"] = "-O2\n-lm";
  const started = Date.now();
  const res = await fetch("https://wandbox.org/api/compile.json", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ compiler: lang.wandbox, code: prepareForWandbox(lang, code), stdin, ...options }),
    signal: AbortSignal.timeout(Math.max(20_000, limits.timeMs * lang.timeFactor * 4)),
  });
  if (res.status === 429 || res.status >= 500) throw new ProviderError(`wandbox ${res.status}`);
  if (!res.ok) throw new ProviderError(`wandbox ${res.status}`);
  const j = (await res.json()) as {
    status?: string;
    signal?: string;
    compiler_error?: string;
    program_output?: string;
    program_error?: string;
  };
  const elapsed = Date.now() - started;
  const base = {
    stdout: clip(j.program_output),
    stderr: clip(j.program_error),
    compileOutput: clip(j.compiler_error),
    timeMs: null,
    memoryKb: null,
    provider: "wandbox",
  };
  const compiledLang = !["python", "javascript", "ruby", "php", "lua", "bash", "perl", "r", "julia", "elixir", "erlang", "groovy", "sql"].includes(lang.id);
  if (compiledLang && j.compiler_error && !j.program_output && j.status !== "0") {
    return { status: "compile_error", ...base, message: "Compilation failed" };
  }
  if (j.signal === "Killed" || j.signal === "SIGKILL") {
    return { status: elapsed > limits.timeMs * lang.timeFactor ? "timeout" : "memory", ...base, message: j.signal };
  }
  if (j.signal || (j.status && j.status !== "0")) {
    return { status: "runtime_error", ...base, message: j.signal ? `Signal ${j.signal}` : `Exit code ${j.status}` };
  }
  return { status: "ok", ...base };
}

async function wandboxBatch(lang: Language, code: string, inputs: string[], limits: ExecLimits): Promise<ExecResult[]> {
  const out: ExecResult[] = new Array(inputs.length);
  let next = 0;
  async function worker() {
    while (next < inputs.length) {
      const i = next++;
      out[i] = await wandboxOne(lang, code, inputs[i], limits);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, inputs.length) }, worker));
  return out;
}

/* ----------------------------------------------------------------- Piston */

async function pistonBatch(lang: Language, code: string, inputs: string[], limits: ExecLimits): Promise<ExecResult[]> {
  const url = process.env.PISTON_URL?.replace(/\/$/, "");
  if (!url || !lang.piston) throw new ProviderError("piston not configured", false);
  const out: ExecResult[] = [];
  for (const stdin of inputs) {
    const res = await fetch(`${url}/api/v2/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        language: lang.piston,
        version: "*",
        files: [{ name: lang.id === "java" ? "Main.java" : undefined, content: code }],
        stdin,
        run_timeout: Math.round(limits.timeMs * lang.timeFactor),
        compile_timeout: 20_000,
        run_memory_limit: limits.memoryMb * 1024 * 1024,
      }),
      signal: AbortSignal.timeout(40_000),
    });
    if (!res.ok) throw new ProviderError(`piston ${res.status}`);
    const j = (await res.json()) as {
      compile?: { code: number; stderr: string; output: string };
      run: { code: number | null; signal: string | null; stdout: string; stderr: string; message?: string; status?: string; wall_time?: number; memory?: number };
    };
    const base = {
      stdout: clip(j.run.stdout),
      stderr: clip(j.run.stderr),
      compileOutput: clip(j.compile?.stderr || j.compile?.output),
      timeMs: j.run.wall_time ?? null,
      memoryKb: j.run.memory ? Math.round(j.run.memory / 1024) : null,
      provider: "piston",
    };
    if (j.compile && j.compile.code !== 0) out.push({ status: "compile_error", ...base });
    else if (j.run.status === "TO" || j.run.signal === "SIGKILL") out.push({ status: "timeout", ...base });
    else if (j.run.code !== 0) out.push({ status: "runtime_error", ...base, message: j.run.message ?? `Exit code ${j.run.code}` });
    else out.push({ status: "ok", ...base });
  }
  return out;
}

/* ----------------------------------------------------------------- public */

type Provider = (lang: Language, code: string, inputs: string[], limits: ExecLimits) => Promise<ExecResult[]>;
const PROVIDERS: Record<string, Provider> = { judge0: judge0Batch, wandbox: wandboxBatch, piston: pistonBatch };

function providerOrder(): string[] {
  const primary = (process.env.RUNNER || (process.env.PISTON_URL ? "piston" : "judge0")).toLowerCase();
  return [primary, ...["judge0", "wandbox", "piston"].filter((p) => p !== primary)];
}

/** Runs `code` once per input. Falls back across providers on outages or unsupported languages. */
export async function runBatch(langId: string, code: string, inputs: string[], limits: ExecLimits): Promise<ExecResult[]> {
  const lang = getLanguage(langId);
  if (!lang) throw new Error(`Unknown language: ${langId}`);
  if (inputs.length === 0) return [];
  let lastError: unknown = null;
  for (const name of providerOrder()) {
    try {
      return await PROVIDERS[name](lang, code, inputs, limits);
    } catch (e) {
      lastError = e;
      if (e instanceof ProviderError && !e.retryable) continue;
      console.warn(`[runner] ${name} failed:`, (e as Error).message);
    }
  }
  const message = lastError instanceof Error ? lastError.message : "No runner available";
  return inputs.map(() => ({
    status: "internal" as const,
    stdout: "",
    stderr: "",
    compileOutput: "",
    timeMs: null,
    memoryKb: null,
    message: `Code runner unavailable (${message}). Try again in a moment.`,
    provider: "none",
  }));
}

export async function runOnce(langId: string, code: string, stdin: string, limits: ExecLimits): Promise<ExecResult> {
  const [r] = await runBatch(langId, code, [stdin], limits);
  return r;
}

/* --------------------------------------------------------------- checking */

export type Checker = "tokens" | "exact" | "float" | "lines";

function normalizeNewlines(s: string) {
  return s.replace(/\r\n?/g, "\n");
}

export function outputsMatch(actual: string, expected: string, checker: Checker = "tokens"): boolean {
  const a = normalizeNewlines(actual);
  const e = normalizeNewlines(expected);
  switch (checker) {
    case "exact":
      return a.replace(/\n$/, "") === e.replace(/\n$/, "");
    case "lines": {
      const clean = (s: string) =>
        s
          .split("\n")
          .map((l) => l.replace(/\s+$/, ""))
          .join("\n")
          .replace(/\n+$/, "");
      return clean(a) === clean(e);
    }
    case "float": {
      const ta = a.trim().split(/\s+/);
      const te = e.trim().split(/\s+/);
      if (ta.length !== te.length) return false;
      return ta.every((t, i) => {
        if (t === te[i]) return true;
        const x = Number(t);
        const y = Number(te[i]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
        return Math.abs(x - y) <= 1e-6 * Math.max(1, Math.abs(y));
      });
    }
    default: {
      const ta = a.trim().split(/\s+/).filter(Boolean);
      const te = e.trim().split(/\s+/).filter(Boolean);
      return ta.length === te.length && ta.every((t, i) => t === te[i]);
    }
  }
}

export type Verdict = "AC" | "WA" | "TLE" | "MLE" | "RE" | "CE" | "IE";

export function verdictOf(r: ExecResult, expected: string, checker: Checker): Verdict {
  switch (r.status) {
    case "compile_error":
      return "CE";
    case "timeout":
      return "TLE";
    case "memory":
      return "MLE";
    case "runtime_error":
      return "RE";
    case "internal":
      return "IE";
    default:
      return outputsMatch(r.stdout, expected, checker) ? "AC" : "WA";
  }
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  AC: "Accepted",
  WA: "Wrong answer",
  TLE: "Time limit exceeded",
  MLE: "Memory limit exceeded",
  RE: "Runtime error",
  CE: "Compilation error",
  IE: "Runner error",
};
