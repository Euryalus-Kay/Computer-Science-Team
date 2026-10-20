// Dark mode, the camera consent step, and phone layouts.
import fs from "node:fs";
import { chromium } from "@playwright/test";
import { OUT, BASE } from "./lib.mjs";
const creds = JSON.parse(fs.readFileSync(`${OUT}/../creds.json`, "utf8"));
const browser = await chromium.launch();
async function ctxFor(user, pw, opts) {
  const ctx = await browser.newContext(opts);
  await ctx.addCookies([{ name: "lcs_theme", value: opts.theme ?? "light", url: BASE }]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`[${user}] PAGEERROR`, e.message));
  await page.goto(BASE + "/login");
  await page.fill("#username", user);
  await page.fill('input[name="password"]', pw);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  return page;
}
const dark = await ctxFor("maya", "testpass123", { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: "dark", theme: "dark" });
for (const [p, n] of [["/", "dark-home"], ["/admin/tests", "dark-tests"], ["/problems", "dark-problems"]]) {
  await dark.goto(BASE + p);
  await dark.waitForTimeout(600);
  await dark.screenshot({ path: `${OUT}/${n}.png` });
}
// Camera consent in a preview of a test that uses it.
await dark.goto(BASE + "/tests/practice-round-1");
await dark.click("text=Preview as a member");
await dark.waitForURL(/\/take\//, { timeout: 20000 });
await dark.waitForTimeout(1500);
await dark.screenshot({ path: `${OUT}/camera-consent.png` });
const phone = await ctxFor(creds[0][1], creds[0][2], { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
for (const [p, n] of [["/", "phone-home"], ["/tests", "phone-tests"], ["/drills/numbers", "phone-drill"], ["/problems/running-total", "phone-problem"]]) {
  await phone.goto(BASE + p);
  await phone.waitForTimeout(700);
  await phone.screenshot({ path: `${OUT}/${n}.png` });
}
await browser.close();
