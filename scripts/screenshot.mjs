import { chromium } from "../apps/web/node_modules/@playwright/test/index.mjs";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1512, height: 1040 },
  deviceScaleFactor: 1,
});
page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
await page.goto("http://127.0.0.1:5174");
await page.getByRole("textbox", { name: "笔记标题", exact: true }).waitFor();
await page.screenshot({ path: "docs/create-desktop.png", fullPage: true });
console.log("Screenshot saved", await page.title());
await browser.close();
