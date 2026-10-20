// The desktop app install page as a Mac and a Windows user.
import { chromium } from "@playwright/test";
import { OUT, BASE } from "./lib.mjs";
const browser = await chromium.launch();
for (const [name, ua] of [
  ["mac", "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"],
  ["win", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"],
]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2, userAgent: ua });
  const page = await ctx.newPage();
  await page.addInitScript((p) => Object.defineProperty(navigator, "platform", { get: () => p }), name === "mac" ? "MacIntel" : "Win32");
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await page.goto(BASE + "/login");
  await page.fill("#username", "maya");
  await page.fill('input[name="password"]', "testpass123");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await page.goto(BASE + "/app");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/app-page-${name}.png` });
  await page.goto(BASE + "/tests/lockdown-check");
  await page.click("text=Don't have the app?");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/app-lobby-${name}.png` });
  await ctx.close();
}
await browser.close();
