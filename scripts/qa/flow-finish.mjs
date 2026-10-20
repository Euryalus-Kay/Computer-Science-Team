// Continues flow-intro: members answer a few questions and submit; admin reviews results.
import fs from "node:fs";
import { chromium } from "@playwright/test";
import { OUT, BASE } from "./lib.mjs";

const creds = JSON.parse(fs.readFileSync(`${OUT}/../creds.json`, "utf8"));
const { testUrl } = JSON.parse(fs.readFileSync(`${OUT}/../flow.json`, "utf8"));
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
async function open(p, title) {
  await p.click(`nav[aria-label="Questions"] button:has-text("${title}")`);
  await p.waitForTimeout(250);
}
async function type(p, text) {
  const f = p.locator("#runner-main input:visible, #runner-main textarea:visible").first();
  await f.fill(text);
  await p.waitForTimeout(900);
}

const answers = [
  ["Dot figures", ["61", "41", "50"]],
  ["Unknown function", ["35 31 27 23 19 15 11 7 3", "35 31 27", "1 2 3"]],
  ["Tock: totals", ["33", "30", "12"]],
  ["Explain a strategy", [
    "Split the 27 coins into three piles of 9. Weigh pile 1 against pile 2. If one side is lighter the coin is in that pile, otherwise it is in pile 3. Do the same with three piles of 3, then weigh one coin against another.",
    "Weigh 13 against 13. If equal, the last coin is light. Otherwise keep halving the lighter side.",
    "",
  ]],
];

for (let m = 0; m < creds.length; m++) {
  const [name, user, pw] = creds[m];
  const p = await ctx(user);
  await login(p, user, pw);
  await p.goto(BASE + "/tests/intro-logic");
  await p.click("text=Resume");
  await p.waitForURL(/\/take\//);
  await p.waitForTimeout(800);
  // Enter full screen if the test asks for it.
  const fs = p.locator('button:has-text("Return to full screen")');
  if (await fs.isVisible().catch(() => false)) {
    await fs.click();
    await p.waitForTimeout(600);
  }
  for (const [title, vals] of answers) {
    if (!vals[m]) continue;
    await open(p, title);
    await type(p, vals[m]);
  }
  if (m < 2) {
    await p.click('header button:has-text("Submit")');
    await p.waitForTimeout(300);
    await shot(p, `finish-confirm-${m}`);
    await p.locator('dialog button:has-text("Submit")').last().click();
    await p.waitForURL((u) => !u.pathname.includes("/take/") || true, { timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(2500);
    await shot(p, `finish-submitted-${m}`);
  }
  console.log(name, "done");
}

const admin = await ctx("admin");
await login(admin, "maya", "testpass123");
await admin.goto(testUrl + "/results");
await admin.waitForTimeout(1500);
await shot(admin, "finish-results");
await admin.locator("table a").first().click();
await admin.waitForURL(/attempts/);
await admin.waitForTimeout(1500);
await shot(admin, "finish-attempt");
await admin.screenshot({ path: `${OUT}/finish-attempt-full.png`, fullPage: true });
await admin.goto(testUrl);
await admin.waitForTimeout(2500);
await shot(admin, "finish-monitor");
await browser.close();
