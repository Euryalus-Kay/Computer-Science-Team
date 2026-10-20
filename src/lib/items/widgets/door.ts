import type { Rng } from "../rng";
import type { WidgetModule } from "../types";
import { runCommand, type FsNode, type TerminalEnv } from "./terminal";

/**
 * "Open the door": a break-in played in a terminal. Every command runs on the server, so
 * the door only opens for someone who worked it out. The path: the door refuses your
 * address, so take a free one on the camera network, connect, then work out the code
 * from the rule in /etc/door.conf. Three wrong codes lock the door for 30 seconds.
 */

type Host = { name: string; ip: string; note?: string };
type DoorKey = {
  env: TerminalEnv;
  net: string; // e.g. "10.0.7", the camera network
  hosts: Host[];
  start: string; // our first address
  code: string;
  clock: string; // what `date` prints
};
type DoorPub = { host: string; user: string };
export type DoorState = {
  cwd: string;
  ip: string;
  connected: boolean;
  everConnected: boolean;
  opened: boolean;
  wrong: number;
  lockedUntil: number | null;
  history: string[];
  /** The transcript, so it survives a reload. */
  log: { p: string; i: string; o: string }[];
  /** The one hint, once it has been asked for. */
  hint?: string;
};
/** The reply carries the whole state too, so the runner can hand it back after a reload or a page change. */
export type DoorReply = DoorState & { out: string; prompt: string; clear?: boolean };

const CAMS = ["cam-north", "cam-east", "cam-south", "cam-west", "cam-roof", "cam-dock"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const pad = (n: number) => String(n).padStart(2, "0");
const file = (content: string): FsNode => ({ type: "file", content });

export function buildDoor(rng: Rng): DoorKey {
  const nets = rng.shuffle([3, 4, 5, 6, 7, 8, 9]);
  const net = `10.0.${nets[0]}`;
  const home = `10.0.${nets[1]}`;
  const other = `10.0.${nets[2]}`;
  const octets = rng.shuffle(Array.from({ length: 40 }, (_, i) => i + 10));
  const camCount = rng.int(2, 4);
  const cams = rng.shuffle(CAMS).slice(0, camCount + 1);
  // One camera sits in the lobby on another network, so it isn't on the camera network.
  const lobbyCam = rng.chance(0.6);
  const hosts: Host[] = [
    { name: "lab-gate", ip: `${home}.${octets[0]}`, note: "you are here" },
    { name: "printer", ip: `${home}.${octets[1]}` },
    { name: "door", ip: `${net}.2`, note: "lab door controller" },
    ...cams.slice(0, camCount).map((c, i) => ({ name: c, ip: `${net}.${octets[2 + i]}` })),
    ...(lobbyCam ? [{ name: cams[camCount], ip: `${other}.${octets[8]}`, note: "lobby" }] : []),
    { name: "nas", ip: `${other}.${octets[9]}` },
  ];
  const onNet = hosts.filter((h) => h.name.startsWith("cam-") && h.ip.startsWith(net + "."));
  const hour = rng.int(9, 16);
  const minute = rng.int(1, 58);
  const rule = rng.int(0, 1);
  const code =
    rule === 0 ? String(hour * onNet.length) : String(onNet.reduce((s, h) => s + Number(h.ip.split(".")[3]), 0));
  const ruleText =
    rule === 0
      ? "the hour on this machine's clock (24-hour) times the number of cameras on the camera network"
      : "the last numbers of the camera network's camera addresses, added together";
  const hostsFile = hosts.map((h) => `${h.ip.padEnd(12)} ${h.name.padEnd(9)}${h.note ? ` # ${h.note}` : ""}`).join("\n");
  const fs: FsNode = {
    type: "dir",
    children: {
      etc: {
        type: "dir",
        children: {
          hosts: file(`# address    name\n${hostsFile}\n`),
          "door.conf": file(
            `# lab door controller\nallow    ${net}.0/24      # camera network only\ncode     ${ruleText}\nlockout  3 wrong codes, then 30 seconds\n`,
          ),
          motd: file("lab-gate · staff and guests\n"),
        },
      },
      var: {
        type: "dir",
        children: {
          log: {
            type: "dir",
            children: {
              "door.log": file(
                `${pad(hour - 2)}:${pad(minute)}  door  code changed\n${pad(hour - 1)}:${pad((minute + 17) % 60)}  door  opened by badge 4471\n${pad(hour)}:${pad(Math.max(0, minute - 3))}  door  refused connection from ${home}.${octets[1]}\n`,
              ),
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
              "readme.txt": file("The lab door is run by a controller called door.\nTry: connect door\nType help to see every command.\n"),
            },
          },
          admin: { type: "dir", children: {}, locked: true },
        },
      },
    },
  };
  return {
    env: { host: "lab-gate", user: "guest", home: "/home/guest", fs },
    net,
    hosts,
    start: `${home}.${octets[0]}`,
    code,
    clock: `${rng.pick(DAYS)} Oct ${rng.int(12, 23)} ${pad(hour)}:${pad(minute)}:${pad(rng.int(0, 59))} 2026`,
  };
}

const HELP = `commands:
  ls [-a] [dir]  cat <file>  grep <text> <file>  pwd  whoami  history  clear
  cd <dir>             go into a folder (cd .. goes back up, cd ~ goes home)
  reset                start over from your first address and folder
  date                 this machine's clock
  ip                   show your address
  ip set <address>     change your address, e.g. ip set 10.0.1.50
  connect <host>       connect to another machine by name
  unlock <code>        unlock a door (on a door controller)
  exit                 leave a connection`;

function fresh(key: DoorKey): DoorState {
  return { cwd: key.env.home, ip: key.start, connected: false, everConnected: false, opened: false, wrong: 0, lockedUntil: null, history: [], log: [] };
}

export function promptOf(key: { env: TerminalEnv }, s: Pick<DoorState, "connected" | "cwd">) {
  if (s.connected) return "guest@door:~$";
  const dir = s.cwd === key.env.home ? "~" : s.cwd.startsWith(key.env.home + "/") ? "~" + s.cwd.slice(key.env.home.length) : s.cwd;
  return `guest@lab-gate:${dir}$`;
}

/** Runs one command line against the door state. Exported for tests. */
export function doorStep(key: DoorKey, state: DoorState | null, line: string, now = Date.now()): { state: DoorState; reply: DoorReply } {
  const s: DoorState = { ...(state ?? fresh(key)), history: [...(state?.history ?? [])], log: [...(state?.log ?? [])] };
  const p = promptOf(key, s);
  const args = line.trim().split(/\s+/).filter(Boolean);
  const [cmd, ...rest] = args;
  let out = "";
  let clear = false;
  if (cmd) s.history = [...s.history, line.trim()].slice(-50);
  const byName = (n: string) => key.hosts.find((h) => h.name === n || h.ip === n);

  if (!cmd) out = "";
  else if (cmd === "help") out = HELP;
  else if (cmd === "reset" && !rest.length) {
    // Back to the start. An opened door stays open, and a lockout keeps running.
    s.cwd = key.env.home;
    s.ip = key.start;
    s.connected = false;
    clear = true;
  }
  else if (cmd === "clear") clear = true;
  else if (cmd === "date") out = key.clock;
  else if (cmd === "exit") {
    if (s.connected) {
      s.connected = false;
      out = "Connection to door closed.";
    } else out = "exit: you're already on lab-gate. There is nowhere to go back to.";
  } else if (cmd === "ip") {
    if (!rest.length) out = `inet ${s.ip}/24  (lab-gate)`;
    else if (rest[0] !== "set" || !rest[1]) out = "usage: ip            show your address\n       ip set <address>";
    else if (s.connected) out = "ip: leave the connection first (exit).";
    else {
      const m = rest[1].match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
      const parts = m ? m.slice(1).map(Number) : [];
      if (!m || parts.some((x) => x > 255)) out = `ip: ${rest[1]}: not an address. Addresses look like 10.0.1.50`;
      else if (parts[0] !== 10 || parts[1] !== 0) out = `ip: ${rest[1]}: this network only uses 10.0.x.x addresses.`;
      else if (parts[3] === 0 || parts[3] >= 255) out = `ip: ${rest[1]}: the last number has to be between 1 and 254.`;
      else {
        const taken = key.hosts.find((h) => h.ip === rest[1] && h.name !== "lab-gate");
        if (taken) out = `ip: ${rest[1]} is already used by ${taken.name}. Pick a free one.`;
        else {
          s.ip = rest[1];
          out = `address set to ${s.ip}`;
        }
      }
    }
  } else if (cmd === "connect") {
    const target = rest[0];
    const h = target ? byName(target) : null;
    if (!target) out = "usage: connect <host>";
    else if (s.connected) out = "connect: you're already connected to door. Use exit first.";
    else if (!h) out = `connect: ${target}: unknown host. Known hosts are listed in /etc/hosts.`;
    else if (h.name === "lab-gate") out = "connect: you're already on lab-gate.";
    else if (h.name !== "door") out = `connect: ${h.name} doesn't take logins.`;
    else if (!s.ip.startsWith(key.net + ".")) out = `connect: door refused the connection from ${s.ip}.\nThe door only allows the addresses listed in /etc/door.conf.`;
    else {
      s.connected = true;
      s.everConnected = true;
      out = "Connected to door (lab door controller).\nType unlock <code> to open it.";
    }
  } else if (cmd === "unlock") {
    if (!s.connected) out = "unlock: there's no door here. Connect to the door controller first.";
    else if (s.opened) out = "The door is already open.";
    else if (s.lockedUntil && now < s.lockedUntil) out = `unlock: locked after 3 wrong codes. Try again in ${Math.ceil((s.lockedUntil - now) / 1000)} s.`;
    else if (!rest[0]) out = "unlock: missing code. The rule for the code is in /etc/door.conf on lab-gate.";
    else if (rest[0].replace(/^0+(?=\d)/, "") === key.code) {
      s.opened = true;
      out = "Code accepted. The lab door is open.";
    } else {
      s.lockedUntil = null;
      s.wrong += 1;
      if (s.wrong >= 3) {
        s.wrong = 0;
        s.lockedUntil = now + 30_000;
        out = "unlock: wrong code. That's 3 wrong codes, so the door is locked for 30 seconds.";
      } else out = `unlock: wrong code. ${3 - s.wrong} ${3 - s.wrong === 1 ? "try" : "tries"} left before a 30 second lock.`;
    }
  } else if (s.connected) {
    out = `${cmd}: the door controller only knows unlock and exit.`;
  } else {
    const r = runCommand({ env: key.env, cwd: s.cwd, history: s.history }, line);
    if (r.out === null) clear = true;
    else out = r.out;
    s.cwd = r.cwd;
  }
  s.log = clear ? [] : [...s.log, { p, i: line, o: out }].slice(-150);
  return { state: s, reply: { ...s, out, prompt: promptOf(key, s), clear } };
}

/** The one hint, aimed at the next step this student hasn't managed yet. */
export function doorHint(key: DoorKey, s: DoorState): string {
  const h = s.history.map((x) => x.toLowerCase());
  const ran = (re: RegExp) => h.some((x) => re.test(x));
  if (s.opened) return "The door is already open, so there's nothing left to do here.";
  const readConf = ran(/door\.conf/);
  const net = `${key.net}.x`;
  const back = s.connected ? " Type `exit` first to get back to lab-gate." : "";
  if (!s.everConnected) {
    if (!ran(/^connect\b/)) return "Start with `connect door` and read the reply carefully. It tells you what's wrong.";
    if (!readConf) return "The door refused you because of your address. Its rules are in `/etc/door.conf`. Run `cat /etc/door.conf`.";
    if (!s.ip.startsWith(key.net + ".")) return `door.conf only allows addresses on ${net}. Check yours with \`ip\`. Pick one on ${net} that \`/etc/hosts\` doesn't already list, and set it with \`ip set\`.`;
    return "Your address is on the camera network now. Run `connect door` again.";
  }
  if (!readConf) return `The rule for the code is in \`/etc/door.conf\`.${back} Then run \`cat /etc/door.conf\`.`;
  const conf = lookupConf(key);
  if (/times the number of cameras/.test(conf))
    return `The code is the hour from \`date\` (24-hour clock) times the number of cameras on ${net}. Count the cam- lines in \`/etc/hosts\` whose address starts with ${key.net}. A camera on another network doesn't count.${back}`;
  return `Add up the last number of each cam- address on ${net} in \`/etc/hosts\`. A camera on another network doesn't count. Then \`connect door\` and \`unlock\` the total.${back}`;
}

function lookupConf(key: DoorKey): string {
  const etc = key.env.fs.type === "dir" ? key.env.fs.children.etc : undefined;
  const conf = etc?.type === "dir" ? etc.children["door.conf"] : undefined;
  return conf?.type === "file" ? conf.content : "";
}

export const door: WidgetModule<object, DoorPub, DoorKey, unknown, DoorState> = {
  generate(rng) {
    const key = buildDoor(rng);
    return { pub: { host: key.env.host, user: key.env.user }, key };
  },
  interact(_pub, key, state, action) {
    const a = (action ?? {}) as { cmd?: string; hint?: boolean };
    if (a.hint) {
      const s = state ?? fresh(key);
      const next = s.hint ? s : { ...s, hint: doorHint(key, s) };
      return { state: next, reply: { ...next, out: "", prompt: promptOf(key, next) }, counts: false };
    }
    return doorStep(key, state, String(a.cmd ?? "").slice(0, 200));
  },
  // Opening the door is the goal; getting through to the controller is a third of it.
  grade: (_p, _k, _r, state) => ({ fraction: state?.opened ? 1 : state?.everConnected ? 0.3 : 0 }),
  describeKey: (_p, k) => `Set a free ${k.net}.x address, connect door, unlock ${k.code}`,
};
