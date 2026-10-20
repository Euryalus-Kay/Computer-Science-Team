// End-to-end: admin adds members, starts the intro test live, members take it, admin watches.
import fs from "node:fs";
import { chromium } from "@playwright/test";
import { OUT, BASE } from "./lib.mjs";

const browser = await chromium.launch();
async function ctx(name) {
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await c.addCookies([{ name: "lcs_theme", value: "light", url: BASE }]);
  const p = await c.newPage();
  p.on("pageerror", (e) => console.log(`[${name}] PAGEERROR`, e.message));
  p.on("console", (m) => m.type() === "error" && !/hydrat|caret-color|Failed to load resource/i.test(m.text()) && console.log(`[${name}] CONSOLE`, m.text().slice(0, 300)));
  return p;
}
async function login(p, u, pw) {
  await p.goto(BASE + "/login");
  await p.fill("#username", u);
  await p.fill('input[name="password"]', pw);
  await p.click('button[type="submit"]');
  await p.waitForURL((x) => !x.pathname.startsWith("/login"), { timeout: 30000 });
}
const shot = async (p, n) => {
  await p.waitForLoadState("networkidle").catch(() => {});
  await p.screenshot({ path: `${OUT}/${n}.png` });
};

const admin = await ctx("admin");
await login(admin, "maya", "testpass123");

// Members.
const credFile = `${OUT}/../creds.json`;
let creds = fs.existsSync(credFile) ? JSON.parse(fs.readFileSync(credFile, "utf8")) : null;
if (!creds) {
  await admin.goto(BASE + "/admin/members");
  await admin.click("text=Add members");
  await admin.fill("textarea", "Ava Chen, avachen, 10\nNoah Patel, noahp, 11\nLiam Brooks, liamb, 9");
  await admin.click("text=Create 3 accounts");
  await admin.waitForSelector("text=3 accounts created");
  creds = await admin.$$eval("dialog table tbody tr", (rows) => rows.map((r) => [...r.querySelectorAll("td")].map((td) => td.textContent.trim())));
  fs.writeFileSync(credFile, JSON.stringify(creds));
  await admin.click("text=Done");
}
console.log("members", creds.map((c) => c[1]).join(", "));

// Members open the lobby.
const members = [];
for (const [name, user, pw] of creds) {
  const p = await ctx(user);
  await login(p, user, pw);
  await p.goto(BASE + "/tests/intro-logic");
  members.push({ name, user, p });
}
await shot(members[0].p, "flow-lobby-waiting");

// Admin starts it now.
await admin.goto(BASE + "/admin/tests");
await admin.click("text=Intro Logic Test");
await admin.waitForURL(/\/admin\/tests\/[^/]+$/);
const testUrl = admin.url();
await admin.click('[aria-label="Start options"]');
await admin.click("text=Start now");
for (const m of members) await m.p.waitForURL(/\/take\//, { timeout: 30000 });
console.log("members moved into the test");
await members[0].p.waitForTimeout(1500);
await shot(members[0].p, "flow-runner-first");

// Member 0 answers the first question and walks through every question for screenshots.
const p0 = members[0].p;
const total = await p0.locator("[data-qnav]").count().catch(() => 0);
console.log("nav buttons", total);
for (let i = 0; i < 24; i++) {
  await p0.waitForTimeout(400);
  await p0.screenshot({ path: `${OUT}/q-${String(i + 1).padStart(2, "0")}.png` });
  const next = p0.locator("button:has-text('Next')").last();
  if (!(await next.isVisible().catch(() => false))) break;
  await next.click();
}

// Member 1 leaves the tab twice.
const p1 = members[1].p;
for (let k = 0; k < 2; k++) {
  await p1.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await p1.waitForTimeout(k ? 6000 : 2500);
  await p1.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
}
await p1.waitForTimeout(500);
await shot(p1, "flow-runner-returned");

// Admin monitor after heartbeats arrive.
await admin.waitForTimeout(16000);
await admin.goto(testUrl);
await admin.waitForTimeout(3000);
await shot(admin, "flow-monitor-live");

fs.writeFileSync(`${OUT}/../flow.json`, JSON.stringify({ testUrl }));
await browser.close();
