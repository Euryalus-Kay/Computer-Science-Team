// Lab CS desktop app: opens tests from the website in a locked-down window.
const { app, BrowserWindow, session, screen, clipboard, ipcMain, shell, powerSaveBlocker, Menu, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { scanApps } = require("./lib/apps");

const SCHEME = "labcs";
const VERSION = app.getVersion();
const DEV = process.env.LABCS_DEV === "1" || !app.isPackaged;
// Baked in at build time from the DESKTOP_APP_SECRET repository secret, if any.
let SECRET = process.env.LABCS_DESKTOP_SECRET || "";
try {
  SECRET ||= require("./lib/secret.json").secret || "";
} catch {}

/* ------------------------------------------------------------------ config */

const configFile = () => path.join(app.getPath("userData"), "config.json");
function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configFile(), "utf8"));
  } catch {
    return {};
  }
}
function writeConfig(patch) {
  const next = { ...readConfig(), ...patch };
  fs.mkdirSync(path.dirname(configFile()), { recursive: true });
  fs.writeFileSync(configFile(), JSON.stringify(next, null, 2));
  return next;
}
function cleanOrigin(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    // Plain http only for local testing.
    if (u.protocol === "http:" && !["localhost", "127.0.0.1"].includes(u.hostname)) return null;
    return u.origin;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------- state */

let win = null;
let server = cleanOrigin(readConfig().server || "") || null;
let locked = false;
let test = null; // { attemptId, title, scanApps }
let blurredAt = null;
let blocker = null;
let watchers = [];
let pendingUrl = null;

function send(type, data) {
  if (win && !win.isDestroyed()) win.webContents.send("labcs:event", { type, data });
}

/* -------------------------------------------------------------- the window */

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: "#0d0f12",
    title: "Lab CS",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      devTools: DEV,
      spellcheck: false,
    },
  });
  win.once("ready-to-show", () => win.show());

  // Only the school's site loads in the window. Anything else opens in the browser,
  // and nothing opens at all while a test is running.
  win.webContents.on("will-navigate", (e, url) => {
    if (url.startsWith("file:")) return;
    if (server && url.startsWith(server + "/")) return;
    e.preventDefault();
    if (!locked && /^https?:/.test(url)) shell.openExternal(url);
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!locked && /^https?:/.test(url)) {
      if (server && url.startsWith(server + "/")) win.loadURL(url);
      else shell.openExternal(url);
    }
    return { action: "deny" };
  });
  win.webContents.on("before-input-event", (e, input) => {
    if (!locked) return;
    const k = input.key.toLowerCase();
    const mod = input.control || input.meta;
    // Reload, print, zoom and dev tools shortcuts stay off during a test.
    if ((mod && ["r", "p", "w", "q", "n", "t", "=", "-", "0"].includes(k)) || k === "f5" || k === "f12" || (mod && input.shift && k === "i")) {
      e.preventDefault();
      if (k === "q" || k === "w") requestExit();
    }
  });

  win.on("blur", () => {
    // Our own exit-code prompt taking focus isn't leaving the test.
    if (!locked || exitWin) return;
    blurredAt = Date.now();
    send("desktop_blur", {});
    // Pull the window back to the front.
    setTimeout(() => {
      if (locked && win && !win.isDestroyed()) {
        win.show();
        win.focus();
      }
    }, 150);
  });
  win.on("focus", () => {
    if (locked && blurredAt) {
      send("desktop_focus", { awayMs: Date.now() - blurredAt });
      blurredAt = null;
    }
  });
  win.on("close", (e) => {
    if (locked) {
      e.preventDefault();
      requestExit();
    }
  });
  win.on("closed", () => {
    win = null;
  });
  win.loadFile(path.join(__dirname, "pages", "home.html"));
}

/* ------------------------------------------------------------ the handoff */

function findLink(argv) {
  return argv.find((a) => typeof a === "string" && a.startsWith(`${SCHEME}://`)) ?? null;
}

/** labcs://open?server=https://site&token=abc → sign in and open the test. */
function openLink(raw) {
  if (!win) {
    pendingUrl = raw;
    return;
  }
  let u;
  try {
    u = new URL(raw);
  } catch {
    return;
  }
  const origin = cleanOrigin(u.searchParams.get("server") || "") || server;
  const token = u.searchParams.get("token") || "";
  if (!origin) return showHome();
  if (locked && origin !== server) return;
  if (origin !== server) {
    server = origin;
    writeConfig({ server });
  }
  if (!locked) win.setFullScreen(true);
  win.show();
  win.focus();
  win.loadURL(token ? `${server}/desktop/launch?token=${encodeURIComponent(token)}` : `${server}/tests`);
}

function showHome() {
  if (win && !locked) win.loadFile(path.join(__dirname, "pages", "home.html"));
}

/* ------------------------------------------------------------- lockdown */

function lock(info) {
  test = { attemptId: String(info?.attemptId || ""), title: String(info?.title || "Test"), scanApps: info?.scanApps !== false };
  if (locked) return;
  locked = true;
  clipboard.clear();
  win.setFullScreen(false);
  win.setKiosk(true);
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces?.(true, { visibleOnFullScreen: true });
  win.setContentProtection(true);
  win.setClosable?.(false);
  win.setMinimizable?.(false);
  blocker = powerSaveBlocker.start("prevent-display-sleep");

  const displays = screen.getAllDisplays().length;
  if (displays > 1) send("multi_screen", { displays });
  const onDisplay = () => send("desktop_display_change", { displays: screen.getAllDisplays().length });
  screen.on("display-added", onDisplay);
  screen.on("display-removed", onDisplay);
  watchers.push(() => {
    screen.removeListener("display-added", onDisplay);
    screen.removeListener("display-removed", onDisplay);
  });

  // The clipboard was cleared at the start, so anything new came from this
  // window or from another app while the window wasn't focused.
  // readText is async in recent Electron versions and sync in older ones.
  let last = "";
  let reading = false;
  const clip = setInterval(async () => {
    if (reading) return;
    reading = true;
    try {
      const text = await clipboard.readText();
      if (typeof text === "string" && text && text !== last) {
        if (!win?.isFocused() || (blurredAt && Date.now() - blurredAt < 4000)) send("desktop_clipboard", { chars: text.length });
        last = text;
      }
    } catch {
    } finally {
      reading = false;
    }
  }, 1200);
  watchers.push(() => clearInterval(clip));

  if (test.scanApps) {
    const scan = async () => {
      const found = await scanApps().catch(() => []);
      if (found.length) send("desktop_apps", { apps: found.slice(0, 12) });
    };
    scan();
    const t = setInterval(scan, 45_000);
    watchers.push(() => clearInterval(t));
  }
}

function unlock() {
  if (!locked) return;
  locked = false;
  test = null;
  for (const stop of watchers.splice(0)) stop();
  if (blocker !== null) powerSaveBlocker.stop(blocker);
  blocker = null;
  if (win && !win.isDestroyed()) {
    win.setContentProtection(false);
    win.setAlwaysOnTop(false);
    win.setVisibleOnAllWorkspaces?.(false);
    win.setKiosk(false);
    win.setClosable?.(true);
    win.setMinimizable?.(true);
  }
}

/** Quitting during a test needs the exit code from the coach, checked by the site. */
let exitWin = null;
function requestExit() {
  send("desktop_quit_attempt", {});
  if (exitWin) return exitWin.focus();
  exitWin = new BrowserWindow({
    parent: win,
    modal: true,
    width: 380,
    height: 230,
    resizable: false,
    frame: false,
    alwaysOnTop: true,
    backgroundColor: "#14171b",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, devTools: DEV },
  });
  exitWin.setAlwaysOnTop(true, "screen-saver");
  exitWin.loadFile(path.join(__dirname, "pages", "exit.html"));
  exitWin.on("closed", () => (exitWin = null));
}

/** Asks the site, from the test page itself so it carries the student's session. */
async function checkExitCode(code) {
  if (!server || !test || !win) return false;
  const body = JSON.stringify({ attemptId: test.attemptId, code: String(code || "").trim() });
  try {
    return await win.webContents.executeJavaScript(
      `fetch("/api/desktop/exit", { method: "POST", headers: { "content-type": "application/json" }, body: ${JSON.stringify(body)} }).then((r) => r.ok).catch(() => false)`,
    );
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------- the bridge */

ipcMain.on("labcs:version", (e) => {
  e.returnValue = VERSION;
});
ipcMain.handle("labcs:info", () => ({ version: VERSION, server, platform: process.platform, locked }));
ipcMain.on("labcs:test-started", (_e, info) => lock(info));
ipcMain.on("labcs:test-ended", () => unlock());
ipcMain.on("labcs:quit", () => {
  if (locked) return requestExit();
  app.quit();
});
ipcMain.handle("labcs:open-site", () => {
  if (server) shell.openExternal(server);
});
ipcMain.handle("labcs:set-server", (_e, raw) => {
  const o = cleanOrigin(String(raw || ""));
  if (!o || locked) return null;
  server = o;
  writeConfig({ server });
  return server;
});
ipcMain.handle("labcs:exit-code", async (_e, code) => {
  const ok = await checkExitCode(code);
  if (ok) {
    unlock();
    exitWin?.close();
    setTimeout(() => app.quit(), 200);
  }
  return ok;
});
ipcMain.on("labcs:exit-cancel", () => exitWin?.close());

/* --------------------------------------------------------------- startup */

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(SCHEME, process.execPath, [path.resolve(process.argv[1])]);
  } else {
    app.setAsDefaultProtocolClient(SCHEME);
  }

  // Windows and Linux hand links to a running app as a second launch.
  app.on("second-instance", (_e, argv) => {
    const link = findLink(argv);
    if (link) openLink(link);
    else if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  // macOS hands links over with open-url, possibly before the app is ready.
  app.on("open-url", (e, url) => {
    e.preventDefault();
    if (app.isReady()) openLink(url);
    else pendingUrl = url;
  });

  app.on("before-quit", (e) => {
    if (locked) {
      e.preventDefault();
      requestExit();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(
      process.platform === "darwin"
        ? Menu.buildFromTemplate([{ role: "appMenu" }, { role: "editMenu" }])
        : null,
    );
    const setup = process.argv.indexOf("--setup");
    if (setup >= 0) {
      const o = cleanOrigin(process.argv[setup + 1] || "");
      if (o) {
        server = o;
        writeConfig({ server });
      }
    }
    // Every request to the school's site says it comes from this app.
    session.defaultSession.webRequest.onBeforeSendHeaders((details, cb) => {
      const headers = details.requestHeaders;
      if (server && details.url.startsWith(server + "/")) {
        headers["X-LabCS-Desktop"] = `${VERSION}; ${process.platform}`;
        if (SECRET) {
          const ts = String(Date.now());
          headers["X-LabCS-Sig"] = `${ts}.${crypto.createHmac("sha256", SECRET).update(`${VERSION}.${ts}`).digest("hex")}`;
        }
      }
      cb({ requestHeaders: headers });
    });
    // Camera only for the school's site, and nothing else.
    session.defaultSession.setPermissionRequestHandler((wc, permission, cb, details) => {
      const fromSite = server && (details.requestingUrl || "").startsWith(server + "/");
      cb(Boolean(fromSite && (permission === "media" || permission === "fullscreen" || permission === "clipboard-sanitized-write")));
    });
    createWindow();
    const link = pendingUrl || findLink(process.argv);
    pendingUrl = null;
    if (link) openLink(link);
  });

  app.on("window-all-closed", () => {
    if (!locked) app.quit();
  });
  app.on("activate", () => {
    if (!win) createWindow();
  });
}

// Quiet unexpected errors instead of showing raw stack traces to students.
process.on("uncaughtException", (err) => {
  if (DEV) console.error(err);
  else dialog.showErrorBox("Lab CS", "Something went wrong. Reopen the test from the website.");
});
