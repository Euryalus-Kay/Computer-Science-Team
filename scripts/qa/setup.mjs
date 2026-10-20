// Fresh setup through the UI, with starter content, plus a few member accounts.
import { open, BASE } from "./lib.mjs";
const { browser, page } = await open();
await page.goto(BASE + "/setup");
await page.fill("#name", "Maya Zaidi");
await page.fill("#username", "maya");
await page.fill('input[name="password"]', "testpass123");
await page.click('button[type="submit"]');
await page.waitForURL(BASE + "/", { timeout: 120000 });
console.log("setup done");
await browser.close();
