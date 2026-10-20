import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
// Screenshots go to .qa/shots in the repo (git ignores it) unless SHOTS_DIR says otherwise.
export const OUT = process.env.SHOTS_DIR || path.resolve(import.meta.dirname, "../../.qa/shots");
fs.mkdirSync(OUT, { recursive: true });
export const BASE = process.env.BASE_URL || "http://localhost:3000";

export async function open({ width = 1440, height = 900, theme = "light", scale = 2 } = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, colorScheme: theme });
  await ctx.addCookies([{ name: "lcs_theme", value: theme, url: BASE }]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/caret-color|hydrat/i.test(m.text())) console.log("CONSOLE", m.text().slice(0, 300));
  });
  return { browser, ctx, page };
}

export async function login(page, username = "maya", password = "testpass123") {
  await page.goto(BASE + "/login");
  await page.fill("#username", username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

export async function shot(page, name) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.screenshot({ path: `${OUT}/${name}.png` });
}
