// Renders the desktop app icon (1024px PNG) from the logo mark.
import { chromium } from "@playwright/test";
const out = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
await page.setContent(`<html><body style="margin:0;background:transparent">
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22262c"/><stop offset="1" stop-color="#0d0f12"/></linearGradient></defs>
  <rect x="100" y="100" width="824" height="824" rx="186" fill="url(#g)"/>
  <rect x="100.5" y="100.5" width="823" height="823" rx="185.5" fill="none" stroke="rgba(255,255,255,0.08)"/>
  <g transform="translate(512 512) scale(30) translate(-12 -12)">
    <path d="M8.2 5.6h2.2c.9 0 1.5.4 1.9 1.3l5.3 11.5h-2.5l-2.6-5.9-3.4 5.9H6.6l4.6-7.6-.6-1.5c-.2-.5-.5-.7-1.1-.7H8.2V5.6Z" fill="#f2f4f6"/>
  </g>
</svg></body></html>`);
await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: 1024, height: 1024 } });
await browser.close();
