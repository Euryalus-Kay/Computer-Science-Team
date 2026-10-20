// End-to-end check of the website → desktop app handoff and lockdown, run under Xvfb:
//   xvfb-run -a node scripts/qa/desktop-handoff.mjs
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { chromium, _electron } from "@playwright/test";
import { OUT, BASE } from "./lib.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const APP = path.join(ROOT, "desktop");
// LABCS_APP_BIN runs a packaged build instead, e.g. desktop/dist/linux-unpacked/labcs-desktop.
const PACKAGED = process.env.LABCS_APP_BIN || null;
const ELECTRON = PACKAGED || path.join(APP, "node_modules/electron/dist/electron");
const appArgs = (...rest) => (PACKAGED ? ["--no-sandbox", ...rest] : ["--no-sandbox", APP, ...rest]);
const creds = JSON.parse(fs.readFileSync(`${OUT}/../creds.json`, "utf8"));
const [, user, pw] = creds[0];
const results = [];
const check = (name, ok, extra = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
};

// A small test that has to be taken in the app.
const sql = postgres(process.env.DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:5432/labcs");
const [intro] = await sql`select id, created_by from contests where slug = 'intro-logic'`;
let [lt] = await sql`select id, integrity from contests where slug = 'lockdown-check'`;
if (!lt) {
  const id = "lockdowncheck01";
  await sql`insert into contests ${sql({
    id,
    slug: "lockdown-check",
    title: "Lockdown Check",
    description: "Two questions, taken in the Lab CS app.",
    status: "published",
    duration_min: 20,
    start_mode: "open",
    visibility: "everyone",
    show_results: "after_submit",
    integrity: { lockdown: "app", requireFullscreen: false, warnOnLeave: true, blockPaste: false, camera: false, exitCode: "QX7K2M", scanApps: true },
    created_by: intro.created_by,
  })}`;
  const items = await sql`select * from contest_items where contest_id = ${intro.id} and title in ('Dot figures', 'Unknown function') order by ord`;
  for (const [i, it] of items.entries()) {
    await sql`insert into contest_items ${sql({ ...it, id: `${id}i${i}`, contest_id: id, ord: i })}`;
  }
  [lt] = await sql`select id, integrity from contests where slug = 'lockdown-check'`;
}
// A clean slate for this member on this test.
await sql`delete from attempts where contest_id = ${lt.id} and user_id = (select id from users where username = ${user})`;

const browser = await chromium.launch();
const web = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await web.goto(BASE + "/login");
await web.fill("#username", user);
await web.fill('input[name="password"]', pw);
await web.click('button[type="submit"]');
await web.waitForURL((u) => !u.pathname.startsWith("/login"));
await web.goto(BASE + "/tests/lockdown-check");
await web.waitForSelector("text=Open in Lab CS app");
check("lobby asks for the app in a normal browser", true);
await web.screenshot({ path: `${OUT}/desk-web-lobby.png` });

// Press the button the way a student would and capture the one-time link.
const launchRes = web.waitForResponse("**/api/desktop/launch");
await web.click("text=Open in Lab CS app");
const { url: link } = await (await launchRes).json();
check("site returns a labcs:// link", /^labcs:\/\/open\?server=.+&token=.+/.test(link), link.slice(0, 60) + "…");
await web.waitForTimeout(2600);
const missing = await web.locator("text=Install the Lab CS app").isVisible();
check("browser shows install help when the app doesn't open", missing);
await web.screenshot({ path: `${OUT}/desk-web-missing.png` });

// The OS would now start the app with the link. Do the same.
const electron = await _electron.launch({
  executablePath: ELECTRON,
  args: appArgs(link),
  env: { ...process.env, ...(PACKAGED ? {} : { LABCS_DEV: "1" }), ELECTRON_DISABLE_SECURITY_WARNINGS: "1" },
});
const win = await electron.firstWindow();
await win.waitForURL(/\/tests\/lockdown-check/, { timeout: 30000 });
check("app signs in with the link and opens the test", true, win.url());
await win.waitForSelector("text=Start", { timeout: 15000 });
await win.screenshot({ path: `${OUT}/desk-app-lobby.png` });

// The link is single use.
const reuse = await (await browser.newContext()).request.get(BASE + "/desktop/launch?token=" + new URL(link).searchParams.get("token"), {
  headers: { "X-LabCS-Desktop": "1.0.0; linux" },
  maxRedirects: 0,
});
// With a shared secret the unsigned request is refused before the token is even looked at.
check("launch link can't be used twice", reuse.status() === (process.env.LABCS_DESKTOP_SECRET ? 403 : 410), String(reuse.status()));
// Copies older than the site's minimum version are asked to update.
const old = await (await browser.newContext()).request.get(BASE + "/desktop/launch?token=x", { headers: { "X-LabCS-Desktop": "0.9.0; linux" }, maxRedirects: 0 });
if (!process.env.LABCS_DESKTOP_SECRET) check("old app versions are asked to update", old.status() === 426, String(old.status()));
// And the launch page refuses plain browsers.
const plain = await (await browser.newContext()).request.get(BASE + "/desktop/launch?token=x", { maxRedirects: 0 });
check("launch page refuses a normal browser", plain.status() === 403, String(plain.status()));

const winState = () =>
  electron.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find((x) => !x.getParentWindow());
    return { kiosk: w.isKiosk(), top: w.isAlwaysOnTop(), count: BrowserWindow.getAllWindows().length };
  });

await win.click("button:has-text('Start')");
await win.waitForURL(/\/take\//, { timeout: 20000 });
await win.waitForTimeout(1500);
const attemptId = win.url().split("/take/")[1];
let st = await winState();
check("test locks the app (kiosk, always on top)", st.kiosk && st.top, JSON.stringify(st));
await win.screenshot({ path: `${OUT}/desk-app-test.png` });

// Answer the first question.
await win.locator("#runner-main input").first().fill("61");
await win.waitForTimeout(1200);

// Switching away, copying something in another app, and coming back is reported.
await win.waitForTimeout(2500);
await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].emit("blur"));
await electron.evaluate(async ({ clipboard }) => clipboard.writeText("answer from somewhere else"));
await win.waitForTimeout(2600);
await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].emit("focus"));

// Closing is blocked and asks for the exit code.
await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
await win.waitForTimeout(800);
st = await winState();
check("closing during the test is blocked", st.kiosk && st.count === 2, JSON.stringify(st));
const exitWin = electron.windows().find((w) => w.url().endsWith("exit.html"));
check("exit code prompt opens", Boolean(exitWin));
if (exitWin) {
  await exitWin.fill("#code", "WRONG1");
  await exitWin.click("button[type=submit]");
  await exitWin.waitForSelector("#err:not([hidden])", { timeout: 5000 });
  check("wrong exit code is refused", true);
  await exitWin.screenshot({ path: `${OUT}/desk-app-exit.png` });
  await exitWin.click("#cancel");
}

// The same attempt can't be used from a normal browser.
await web.goto(BASE + "/take/" + attemptId);
const blockedPage = await web.locator("text=This test continues in lockdown mode").isVisible();
check("normal browser can't open the attempt", blockedPage);
const api = await web.evaluate(async (id) => {
  const r = await fetch(`/api/attempts/${id}/answer`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ itemId: "x", response: { value: "1" } }) });
  return r.status;
}, attemptId);
check("normal browser can't save answers", api === 403, String(api));

// Let a heartbeat carry the events, then submit.
await win.waitForTimeout(16000);
await win.click("header button:has-text('Submit')");
await win.locator("dialog button:has-text('Submit')").last().click();
await win.waitForSelector("text=Lockdown is off", { timeout: 20000 });
st = await winState();
check("submitting unlocks the app", !st.kiosk && !st.top, JSON.stringify(st));
await win.screenshot({ path: `${OUT}/desk-app-done.png` });

const events = (await sql`select type from integrity_events where attempt_id = ${attemptId} order by id`).map((r) => r.type);
check("app switch is recorded", events.includes("desktop_blur") && events.includes("desktop_focus"), events.join(","));
check("quit attempt is recorded", events.includes("desktop_quit_attempt") && events.includes("desktop_exit_wrong"));
const clips = await sql`select data from integrity_events where attempt_id = ${attemptId} and type = 'desktop_clipboard'`;
check("clipboard from another app is recorded once, with its size", clips.length === 1 && clips[0].data?.chars === 26, JSON.stringify(clips.map((c) => c.data)));
check("the exit prompt doesn't count as leaving", events.filter((e) => e === "desktop_blur").length === 1, events.join(","));
const [att] = await sql`select client, status from attempts where id = ${attemptId}`;
check("attempt is marked as taken in the app", att.client?.kind === "desktop" && att.status === "submitted", JSON.stringify(att.client));
await electron.close();

// Opening the app on its own shows the home screen with the saved site.
const again = await _electron.launch({ executablePath: ELECTRON, args: appArgs(), env: { ...process.env, ...(PACKAGED ? {} : { LABCS_DEV: "1" }) } });
const home = await again.firstWindow();
await home.waitForSelector("#server:not(:empty)", { timeout: 15000 });
check("app remembers the site", (await home.textContent("#server")).includes("localhost"));
await home.screenshot({ path: `${OUT}/desk-app-home.png` });
await again.close();

await browser.close();
await sql.end();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
