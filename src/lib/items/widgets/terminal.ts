import type { Rng } from "../rng";
import type { WidgetModule } from "../types";
import { normalizeText } from "../generic";

/** A tiny read-only filesystem: directories map names to children, files hold text. */
export type FsNode = { type: "dir"; children: Record<string, FsNode>; locked?: boolean } | { type: "file"; content: string };

export type TerminalEnv = { host: string; user: string; home: string; fs: FsNode };
type TerminalKey = { mostFailed: string; doorCode: string; archive: string };

const NAMES = ["mara", "ollie", "juno", "theo", "iris", "felix", "nova", "hugo", "wren", "cleo", "otto", "ruby", "silas", "lena"];
const ROLES = ["ops", "dev", "research", "admin", "intern", "facilities"];
const WORDS = ["LANTERN", "QUARTZ", "BEACON", "HARBOR", "MOSAIC", "TUNDRA", "ZEPHYR", "CANYON", "GLACIER", "FALCON", "SUMMIT", "VELVET"];

const pad = (n: number) => String(n).padStart(2, "0");

function caesar(word: string, k: number) {
  return word
    .split("")
    .map((c) => String.fromCharCode(65 + ((c.charCodeAt(0) - 65 + k) % 26)))
    .join("");
}

type LogLine = { day: 14 | 15; mins: number; ok: boolean; user: string; ip: string };

export function buildTerminalEnv(rng: Rng): { env: TerminalEnv; key: TerminalKey } {
  for (;;) {
    const names = rng.shuffle(NAMES).slice(0, 9);
    const ids = new Map<string, string>();
    const used = new Set<string>();
    for (const n of names) {
      let id: string;
      do id = String(rng.int(10000, 99999));
      while (used.has(id.slice(-4)));
      used.add(id.slice(-4));
      ids.set(n, id);
    }
    const never = names.slice(0, rng.int(2, 4)); // never log in successfully
    const active = names.filter((n) => !never.includes(n));
    const champ = rng.pick(names); // most failed logins
    const lines: LogLine[] = [];
    const ip = () => `10.0.${rng.int(1, 9)}.${rng.int(10, 250)}`;
    // Evening of the 14th, 21:00 to 23:59, and early 15th, 00:00 to 02:30.
    const slot = () => (rng.chance(0.55) ? { day: 14 as const, mins: rng.int(21 * 60, 23 * 60 + 59) } : { day: 15 as const, mins: rng.int(0, 150) });
    for (const u of active) {
      for (let i = 0, k = rng.int(1, 3); i < k; i++) lines.push({ ...slot(), ok: true, user: u, ip: ip() });
    }
    const failCount = new Map<string, number>();
    for (const u of names) failCount.set(u, u === champ ? rng.int(5, 7) : rng.int(0, 3));
    for (const [u, n] of failCount) for (let i = 0; i < n; i++) lines.push({ ...slot(), ok: false, user: u, ip: ip() });
    // A failed login right after midnight is a distraction for the door code.
    const decoy = rng.pick(names);
    failCount.set(decoy, failCount.get(decoy)! + 1);
    lines.push({ day: 15, mins: rng.int(0, 2), ok: false, user: decoy, ip: ip() });
    lines.sort((a, b) => a.day - b.day || a.mins - b.mins);
    const after = lines.filter((l) => l.day === 15 && l.ok);
    const before = lines.filter((l) => l.day === 14 && l.ok);
    if (!after.length || !before.length) continue;
    // Unique first login after midnight, and the champion is strictly ahead.
    if (after.length > 1 && after[0].mins === after[1].mins) continue;
    const fails = [...failCount.entries()].sort((a, b) => b[1] - a[1]);
    if (fails[0][1] === fails[1][1]) continue;
    const first = after[0].user;
    const word = rng.pick(WORDS);
    const shift = never.length;
    const seconds = () => pad(rng.int(0, 59));
    const log = lines
      .map((l) => `2026-03-${l.day} ${pad(Math.floor(l.mins / 60))}:${pad(l.mins % 60)}:${seconds()}  ${l.ok ? "OK  " : "FAIL"}  user=${l.user.padEnd(6)} from=${l.ip}`)
      .join("\n");
    const usersFile =
      "# id     name    team\n" +
      rng
        .shuffle(names)
        .map((n) => `u-${ids.get(n)}  ${n.padEnd(6)}  ${rng.pick(ROLES)}`)
        .join("\n");
    const fs: FsNode = {
      type: "dir",
      children: {
        etc: {
          type: "dir",
          children: {
            users: { type: "file", content: usersFile + "\n" },
            motd: { type: "file", content: "relay-7 · authorized personnel only\n" },
            hostname: { type: "file", content: "relay-7\n" },
          },
        },
        var: {
          type: "dir",
          children: {
            log: {
              type: "dir",
              children: {
                "auth.log": { type: "file", content: log + "\n" },
                "door.log": {
                  type: "file",
                  content: `2026-03-14 18:02:11  door=lab-2  status=locked\n2026-03-15 07:45:03  door=lab-2  status=code-changed\n`,
                },
              },
            },
          },
        },
        home: {
          type: "dir",
          children: {
            guest: {
              type: "dir",
              children: {
                "readme.txt": { type: "file", content: "Start in notes/. Some files are hidden. Type help for commands.\n" },
                "archive.enc": { type: "file", content: caesar(word, shift) + "\n" },
                notes: {
                  type: "dir",
                  children: {
                    "todo.txt": {
                      type: "file",
                      content:
                        "- door code: last 4 digits of the user id of whoever logged in successfully first after midnight on the 15th\n- user ids are in /etc/users\n- clean up archive.enc\n",
                    },
                    ".hint": {
                      type: "file",
                      content:
                        "archive.enc: each letter was shifted forward in the alphabet.\nTo read it, shift every letter back by the number of users\nwho have never logged in successfully.\n",
                    },
                  },
                },
              },
            },
            ...Object.fromEntries(names.slice(0, 3).map((n) => [n, { type: "dir" as const, children: {}, locked: true }])),
          },
        },
      },
    };
    return {
      env: { host: "relay-7", user: "guest", home: "/home/guest", fs },
      key: { mostFailed: fails[0][0], doorCode: ids.get(first)!.slice(-4), archive: word },
    };
  }
}

type Ask = "most-failed" | "door-code" | "archive";
type TerminalPub = { env: TerminalEnv; ask: Ask };

export const terminal: WidgetModule<{ ask: Ask }, TerminalPub, { answer: string }, { text: string }> = {
  generate(rng, c) {
    const { env, key } = buildTerminalEnv(rng);
    const answer = c.ask === "most-failed" ? key.mostFailed : c.ask === "door-code" ? key.doorCode : key.archive;
    return { pub: { env, ask: c.ask }, key: { answer } };
  },
  grade: (_p, key, r) => ({ fraction: r?.text && normalizeText(r.text).replace(/^u-/, "") === key.answer.toLowerCase() ? 1 : 0 }),
  describeKey: (_p, k) => k.answer,
};

/* --------------------------------------------------------- shell engine */

export type Shell = { env: TerminalEnv; cwd: string; history: string[] };

export function resolvePath(env: TerminalEnv, cwd: string, p: string): string {
  let path = p.startsWith("~") ? env.home + p.slice(1) : p.startsWith("/") ? p : `${cwd}/${p}`;
  const parts: string[] = [];
  for (const seg of path.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  path = "/" + parts.join("/");
  return path;
}

export function lookupPath(env: TerminalEnv, abs: string): FsNode | null {
  let node: FsNode = env.fs;
  for (const seg of abs.split("/").filter(Boolean)) {
    if (node.type !== "dir") return null;
    const next: FsNode | undefined = node.children[seg];
    if (!next) return null;
    node = next;
  }
  return node;
}

const HELP = `commands:
  ls [-a] [dir]        list files (-a shows hidden ones)
  cd <dir>             change directory (.. goes up, ~ is home)
  cat <file>           print a file
  grep [-c] [-i] <text> <file>
                       lines containing text (-c counts them)
  head [-n N] <file>   first lines      tail [-n N] <file>  last lines
  wc -l <file>         count lines
  pwd  whoami  history  clear`;

/** Runs one command line. Returns the output text, or null for `clear`. */
export function runCommand(sh: Shell, line: string): { out: string | null; cwd: string } {
  const env = sh.env;
  const args = line.trim().split(/\s+/).filter(Boolean);
  if (!args.length) return { out: "", cwd: sh.cwd };
  const [cmd, ...rest] = args;
  const flags = rest.filter((a) => a.startsWith("-"));
  const plain = rest.filter((a) => !a.startsWith("-"));
  const file = (p: string | undefined): { text?: string; err?: string } => {
    if (!p) return { err: `${cmd}: missing file name` };
    const abs = resolvePath(env, sh.cwd, p);
    const n = lookupPath(env, abs);
    if (!n) return { err: `${cmd}: ${p}: No such file or directory` };
    if (n.type === "dir") return { err: `${cmd}: ${p}: Is a directory` };
    return { text: n.content };
  };
  const nFlag = () => {
    const i = rest.indexOf("-n");
    if (i >= 0 && rest[i + 1] && /^\d+$/.test(rest[i + 1])) return Number(rest[i + 1]);
    const short = rest.find((a) => /^-\d+$/.test(a));
    return short ? Number(short.slice(1)) : 10;
  };
  switch (cmd) {
    case "help":
      return { out: HELP, cwd: sh.cwd };
    case "pwd":
      return { out: sh.cwd, cwd: sh.cwd };
    case "whoami":
      return { out: env.user, cwd: sh.cwd };
    case "clear":
      return { out: null, cwd: sh.cwd };
    case "history":
      return { out: sh.history.map((h, i) => `${String(i + 1).padStart(4)}  ${h}`).join("\n"), cwd: sh.cwd };
    case "echo":
      return { out: rest.join(" "), cwd: sh.cwd };
    case "ls": {
      const target = plain[0] ?? ".";
      const abs = resolvePath(env, sh.cwd, target);
      const n = lookupPath(env, abs);
      if (!n) return { out: `ls: ${target}: No such file or directory`, cwd: sh.cwd };
      if (n.type === "file") return { out: target, cwd: sh.cwd };
      if (n.locked) return { out: `ls: ${target}: Permission denied`, cwd: sh.cwd };
      const all = flags.some((f) => f.includes("a"));
      const names = Object.keys(n.children)
        .filter((k) => all || !k.startsWith("."))
        .sort()
        .map((k) => (n.children[k].type === "dir" ? `${k}/` : k));
      return { out: (all ? ["./", "../", ...names] : names).join("  "), cwd: sh.cwd };
    }
    case "cd": {
      const target = plain[0] ?? "~";
      const abs = resolvePath(env, sh.cwd, target);
      const n = lookupPath(env, abs);
      if (!n) return { out: `cd: ${target}: No such file or directory`, cwd: sh.cwd };
      if (n.type !== "dir") return { out: `cd: ${target}: Not a directory`, cwd: sh.cwd };
      if (n.locked) return { out: `cd: ${target}: Permission denied`, cwd: sh.cwd };
      return { out: "", cwd: abs };
    }
    case "cat": {
      if (!plain.length) return { out: "cat: missing file name", cwd: sh.cwd };
      return { out: plain.map((p) => file(p).text?.replace(/\n$/, "") ?? file(p).err).join("\n"), cwd: sh.cwd };
    }
    case "head":
    case "tail": {
      const f = file(plain[plain.length - 1]);
      if (f.err) return { out: f.err, cwd: sh.cwd };
      const ls = f.text!.replace(/\n$/, "").split("\n");
      const n = nFlag();
      return { out: (cmd === "head" ? ls.slice(0, n) : ls.slice(-n)).join("\n"), cwd: sh.cwd };
    }
    case "wc": {
      const f = file(plain[plain.length - 1]);
      if (f.err) return { out: f.err, cwd: sh.cwd };
      const count = f.text!.replace(/\n$/, "").split("\n").length;
      return { out: `${count} ${plain[plain.length - 1]}`, cwd: sh.cwd };
    }
    case "grep": {
      if (plain.length < 2) return { out: "usage: grep [-c] [-i] <text> <file>", cwd: sh.cwd };
      const pattern = plain.slice(0, -1).join(" ").replace(/^["']|["']$/g, "");
      const f = file(plain[plain.length - 1]);
      if (f.err) return { out: f.err, cwd: sh.cwd };
      const ci = flags.some((x) => x.includes("i"));
      const matches = f.text!
        .replace(/\n$/, "")
        .split("\n")
        .filter((l) => (ci ? l.toLowerCase().includes(pattern.toLowerCase()) : l.includes(pattern)));
      return { out: flags.some((x) => x.includes("c")) ? String(matches.length) : matches.join("\n"), cwd: sh.cwd };
    }
    case "sudo":
      return { out: `${env.user} is not in the sudoers file. This incident will be reported.`, cwd: sh.cwd };
    case "rm":
    case "mv":
    case "cp":
    case "touch":
    case "mkdir":
    case "nano":
    case "vim":
      return { out: `${cmd}: read-only file system`, cwd: sh.cwd };
    default:
      return { out: `${cmd}: command not found. Type help.`, cwd: sh.cwd };
  }
}

/** Tab completion for the last word on the line. */
export function complete(sh: Shell, line: string): string {
  const parts = line.split(" ");
  const last = parts[parts.length - 1];
  const cmds = ["help", "ls", "cd", "cat", "grep", "head", "tail", "wc", "pwd", "whoami", "history", "clear"];
  if (parts.length === 1) {
    const m = cmds.filter((c) => c.startsWith(last));
    return m.length === 1 ? m[0] + " " : line;
  }
  const slash = last.lastIndexOf("/");
  const dirPart = slash >= 0 ? last.slice(0, slash + 1) : "";
  const base = slash >= 0 ? last.slice(slash + 1) : last;
  const dir = lookupPath(sh.env, resolvePath(sh.env, sh.cwd, dirPart || "."));
  if (!dir || dir.type !== "dir") return line;
  const m = Object.keys(dir.children).filter((k) => k.startsWith(base) && (base.startsWith(".") || !k.startsWith(".")));
  if (m.length !== 1) return line;
  const node = dir.children[m[0]];
  parts[parts.length - 1] = dirPart + m[0] + (node.type === "dir" ? "/" : "");
  return parts.join(" ");
}
