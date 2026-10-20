// Screens of the admin test pages.
import { open, login, shot, BASE } from "./lib.mjs";
const { browser, page } = await open();
await login(page);
await page.goto(BASE + "/admin/tests");
await shot(page, "admin-tests");
await page.click("text=Intro Logic Test");
await page.waitForURL(/\/admin\/tests\/[^/]+$/);
await shot(page, "admin-test-monitor");
const url = page.url();
for (const tab of ["results", "edit"]) {
  const r = await page.goto(url + "/" + tab);
  console.log(tab, r.status());
  await shot(page, "admin-test-" + tab);
}
await browser.close();
