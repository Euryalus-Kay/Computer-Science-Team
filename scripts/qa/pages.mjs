// Screens of the dashboard pages as an admin and as a member.
import fs from "node:fs";
import { chromium } from "@playwright/test";
import { OUT, BASE } from "./lib.mjs";

const creds = JSON.parse(fs.readFileSync(`${OUT}/../creds.json`, "utf8"));
const browser = await chromium.launch();
async function as(user, pw) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await ctx.addCookies([{ name: "lcs_theme", value: "light", url: BASE }]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`[${user}] PAGEERROR`, e.message));
  page.on("console", (m) => m.type() === "error" && !/hydrat|Failed to load resource|caret/i.test(m.text()) && console.log(`[${user}] CONSOLE`, m.text().slice(0, 200)));
  await page.goto(BASE + "/login");
  await page.fill("#username", user);
  await page.fill('input[name="password"]', pw);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  return page;
}
async function shot(page, path, name) {
  const r = await page.goto(BASE + path);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(300);
  if (r && r.status() >= 400) console.log("HTTP", r.status(), path);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

const admin = await as("maya", "testpass123");
// Load starter slides and post an announcement.
await admin.goto(BASE + "/admin/settings");
await admin.click('button:has-text("Load")');
await admin.waitForTimeout(3000);
await admin.goto(BASE + "/admin/posts");
if (!(await admin.locator("article").count())) {
  await admin.fill("textarea", "Practice is in **Room 214** on Thursday after school. Bring a laptop if you have one.");
  await admin.click('button:has-text("Post")');
  await admin.waitForTimeout(1200);
}
for (const [p, n] of [
  ["/", "p-home-admin"],
  ["/admin", "p-admin-overview"],
  ["/admin/settings", "p-admin-settings"],
  ["/admin/integrity?show=all", "p-admin-integrity"],
  ["/admin/posts", "p-admin-posts"],
  ["/admin/slides", "p-admin-slides"],
  ["/slides", "p-slides"],
  ["/leaderboard", "p-leaderboard"],
  ["/drills", "p-drills"],
  ["/app", "p-app"],
]) await shot(admin, p, n);
// A slide deck and its editor.
await admin.goto(BASE + "/slides");
await admin.click("text=Bit-String Flicking");
await admin.waitForTimeout(800);
await admin.keyboard.press("ArrowRight");
await admin.keyboard.press("ArrowRight");
await admin.waitForTimeout(400);
await admin.screenshot({ path: `${OUT}/p-deck.png` });
await admin.click("text=Edit");
await admin.waitForTimeout(1200);
await admin.screenshot({ path: `${OUT}/p-deck-editor.png` });

const member = await as(creds[1][1], creds[1][2]);
await shot(member, "/", "p-home-member");
await member.goto(BASE + "/drills/bits");
await member.waitForTimeout(600);
await member.fill("input", "00000");
await member.keyboard.press("Enter");
await member.waitForTimeout(500);
await member.screenshot({ path: `${OUT}/p-drill.png` });
await browser.close();
