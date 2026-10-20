import { chromium } from "@playwright/test";
export const OUT = process.env.SHOTS_DIR || "/tmp/claude-0/-home-user-Computer-Science-Team/a0644c86-17e1-54a3-90f6-276a1a04d406/scratchpad/shots";
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
