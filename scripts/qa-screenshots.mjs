/**
 * Visual QA pass for the Jojo Usafi storefront prototype.
 *
 * Captures every key page at the mandatory QA widths, reports console errors and
 * flags any page that scrolls horizontally.
 *
 *   node scripts/qa-screenshots.mjs           # against http://localhost:3000
 *   BASE_URL=... node scripts/qa-screenshots.mjs
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, devices } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const OUT_DIR = path.join(process.cwd(), "preview", "screenshots");

const widths = [
  { name: "390-iphone", width: 390, height: 844, mobile: true },
  { name: "430-iphone-max", width: 430, height: 932, mobile: true },
  { name: "768-tablet", width: 768, height: 1024, mobile: true },
  { name: "1024-laptop", width: 1024, height: 768, mobile: false },
  { name: "1440-desktop", width: 1440, height: 900, mobile: false },
];

const pages = [
  { name: "home", path: "/", full: true },
  { name: "shop", path: "/shop", full: true },
  { name: "product", path: "/product/multix-multipurpose-detergent-lemon-fresh-5lt", full: true },
  { name: "cart", path: "/cart", full: true, seedCart: true },
  { name: "track-order", path: "/track-order", full: true },
];

const SEED = JSON.stringify([
  { sku: "EP-0007", quantity: 2 },
  { sku: "EP-0001", quantity: 1 },
  { sku: "EP-0021", quantity: 3 },
]);

const problems = [];

async function run() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();

  for (const viewport of widths) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: Number(process.env.DSF ?? 1),
      isMobile: viewport.mobile,
      hasTouch: viewport.mobile,
      userAgent: viewport.mobile ? devices["iPhone 14 Pro"].userAgent : undefined,
    });

    for (const page of pages) {
      const tab = await context.newPage();
      const consoleErrors = [];
      tab.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      tab.on("pageerror", (err) => consoleErrors.push(String(err)));

      if (page.seedCart) {
        await tab.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
        await tab.evaluate((seed) => window.localStorage.setItem("jojo-usafi.cart.v1", seed), SEED);
      }

      await tab.goto(`${BASE_URL}${page.path}`, { waitUntil: "networkidle" });
      await tab.waitForTimeout(400);

      const overflow = await tab.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (overflow > 1) {
        problems.push(`HORIZONTAL OVERFLOW ${overflow}px — ${page.name} @ ${viewport.width}px`);
      }
      for (const error of consoleErrors) {
        problems.push(`CONSOLE ERROR — ${page.name} @ ${viewport.width}px: ${error}`);
      }

      const file = path.join(OUT_DIR, `${page.name}-${viewport.name}.png`);
      await tab.screenshot({ path: file, fullPage: page.full });
      console.log(`saved ${path.relative(process.cwd(), file)}${overflow > 1 ? "  ⚠ overflow" : ""}`);
      await tab.close();
    }

    await context.close();
  }

  await browser.close();

  console.log("\n--- QA summary ---");
  if (problems.length === 0) {
    console.log("No horizontal overflow and no console errors at any QA width.");
  } else {
    for (const problem of problems) console.log(problem);
    process.exitCode = 1;
  }
}

run();
