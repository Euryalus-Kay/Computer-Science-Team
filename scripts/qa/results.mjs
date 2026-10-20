// The results page and the CSV export for the intro test.
import fs from "node:fs";
import { open, login, BASE, OUT } from "./lib.mjs";
const { testUrl } = JSON.parse(fs.readFileSync(`${OUT}/../flow.json`, "utf8"));
const { browser, page } = await open();
await login(page);
await page.goto(testUrl + "/results");
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/results.png` });
const csv = await page.evaluate(async (u) => (await fetch(u)).text(), testUrl + "/export");
console.log(csv.split("\r\n").slice(0, 3).map((l) => l.slice(0, 220)).join("\n"));
await browser.close();
