/**
 * Visual and behavioural QA for the Jojo Usafi storefront.
 *
 * Captures every key page in both languages at the mandatory QA widths and
 * fails the run on anything a shopper would notice:
 *
 *   - horizontal overflow
 *   - console errors and uncaught page errors
 *   - broken or missing product images
 *   - a product showing another SKU's photograph
 *   - touch targets under 44px
 *   - floating layers (support button / cart dock) overlapping each other
 *   - the hero down control failing to scroll
 *   - the language chooser or the EN/SW switcher failing
 *   - a withheld product (EP01-A01) or an orphan image (EP23-A02) leaking out
 *   - a product shelf with the wrong number of columns, or a row left part-full
 *   - the interface moving around the shopper when the language changes
 *
 *   node scripts/qa-screenshots.mjs
 *   BASE_URL=http://localhost:3000 node scripts/qa-screenshots.mjs
 */

import fs from "node:fs";
import { mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { chromium, devices } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const OUT_DIR = path.join(process.cwd(), "preview", "screenshots");
const LOCALE_KEY = "jojo-usafi.locale.v1";
const CART_KEY = "jojo-usafi.cart.v1";
const APPLIED_KEY = "jojo-usafi.locale.applied.v1";
const MIN_TOUCH = 44;

const catalogue = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "src/lib/catalogue/generated/catalogue.json"), "utf8"),
);
const publishable = catalogue.products.filter((p) => p.publishable);
const withheld = catalogue.products.filter((p) => !p.publishable);

/** A product with more than one pack size, so the size chooser is exercised. */
const familyCounts = new Map();
for (const p of publishable) familyCounts.set(p.familyId, (familyCounts.get(p.familyId) ?? 0) + 1);
const sampleProduct =
  publishable.find((p) => (familyCounts.get(p.familyId) ?? 0) > 1) ?? publishable[0];

const seedCart = JSON.stringify(
  publishable.slice(0, 3).map((p, i) => ({ sku: p.sku, quantity: i + 1 })),
);

/**
 * `columns` is the number of product cards a shelf must show per row at that
 * width — the density contract from ProductGrid.tsx, asserted rather than
 * eyeballed in a screenshot.
 */
const widths = [
  { name: "390-iphone", width: 390, height: 844, mobile: true, columns: 2 },
  { name: "430-iphone-max", width: 430, height: 932, mobile: true, columns: 2 },
  { name: "768-tablet", width: 768, height: 1024, mobile: true, columns: 3 },
  { name: "1024-laptop", width: 1024, height: 768, mobile: false, columns: 4 },
  { name: "1440-desktop", width: 1440, height: 900, mobile: false, columns: 5 },
];

/**
 * How far a persistent control may move when the language changes. Sub-pixel
 * layout rounding is real and harmless; anything a shopper could see is not.
 */
const LOCALE_DRIFT_TOLERANCE = 2;

const locales = [
  { code: "en", prefix: "" },
  { code: "sw", prefix: "/sw" },
];

const pages = [
  { name: "home", path: "/", full: true },
  { name: "shop", path: "/shop", full: true },
  { name: "product", path: `/product/${sampleProduct.slug}`, full: true },
  { name: "cart", path: "/cart", full: true, cart: true },
  { name: "checkout", path: "/checkout", full: true, cart: true },
  { name: "track-order", path: "/track-order", full: true },
  { name: "contact", path: "/contact", full: true },
];

/**
 * The admin dashboard. English-only and outside the localized route tree, so it
 * is audited once per width rather than once per locale.
 *
 * Since Build 08 every real-data admin route is behind the Supabase Auth
 * session, so a signed-out visitor is sent to the sign-in screen and there is
 * nothing else to photograph. Only the two screens a person can legitimately
 * reach without an account are captured here; `guardedAdminRoutes` below is
 * asserted to redirect instead.
 *
 * The dashboard behind the guard is audited too, signed in as the development
 * QA Manager — see `staffPass()` below.
 */
const adminPages = [
  { name: "admin-sign-in", path: "/admin/sign-in", full: true },
  { name: "admin-setup", path: "/admin/setup", full: true },
];

/** Real-data routes that must never render for somebody who is not signed in. */
const guardedAdminRoutes = [
  "/admin",
  "/admin/orders",
  "/admin/products",
  `/admin/products/${sampleProduct.sku}`,
  "/admin/customers",
  "/admin/more",
  "/admin/more/delivery-zones",
];

const problems = [];
const fail = (message) => problems.push(message);

/** Pre-seed storage so the first-visit chooser never blocks a screenshot. */
async function seedStorage(context, locale, withCart) {
  await context.addInitScript(
    ([localeKey, appliedKey, cartKey, localeCode, cart]) => {
      try {
        window.localStorage.setItem(localeKey, localeCode);
        window.sessionStorage.setItem(appliedKey, "1");
        if (cart) window.localStorage.setItem(cartKey, cart);
        else window.localStorage.removeItem(cartKey);
      } catch {
        /* storage blocked — the page still has to work */
      }
    },
    [LOCALE_KEY, APPLIED_KEY, CART_KEY, locale, withCart ? seedCart : null],
  );
}

/**
 * Product photos load lazily, so a page has to be walked top to bottom before
 * anything is asserted — otherwise every below-the-fold image reads as broken
 * and the full-page screenshot captures empty tiles.
 */
async function loadEverything(tab) {
  await tab.evaluate(async () => {
    // Native lazy loading only fetches what the walk happens to reveal; opting
    // every image in makes the pass deterministic.
    for (const img of document.images) img.loading = "eager";
    const step = Math.round(window.innerHeight * 0.8);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await tab.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await tab
    .waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 30000 })
    .catch(() => {});
  await tab.waitForTimeout(200);
}

function watchConsole(tab, label) {
  tab.on("console", (msg) => {
    if (msg.type() === "error") fail(`CONSOLE ERROR — ${label}: ${msg.text()}`);
  });
  tab.on("pageerror", (err) => fail(`PAGE ERROR — ${label}: ${String(err)}`));
}

async function checkOverflow(tab, label) {
  const overflow = await tab.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  if (overflow > 1) fail(`HORIZONTAL OVERFLOW ${overflow}px — ${label}`);
}

async function checkImages(tab, label) {
  const broken = await tab.evaluate(() =>
    [...document.images]
      .filter((img) => !img.complete || img.naturalWidth === 0)
      .map((img) => img.currentSrc || img.src),
  );
  for (const src of broken) fail(`BROKEN IMAGE — ${label}: ${src}`);

  const unlabelled = await tab.evaluate(() =>
    [...document.images]
      .filter((img) => {
        if (!img.src.includes("/product-media/") && !img.src.includes("/products/")) return false;
        if (img.closest("[aria-hidden='true']")) return false;
        // alt="" is a deliberate "decorative" marker and is only correct when
        // something else names the control the image sits inside.
        if (img.hasAttribute("alt") && img.alt === "") {
          return !img.closest("[aria-label], [aria-labelledby]");
        }
        return !img.hasAttribute("alt");
      })
      .map((img) => img.src),
  );
  for (const src of unlabelled) fail(`PRODUCT IMAGE WITHOUT ALT TEXT — ${label}: ${src}`);
}

/** Every visible block-level control has to be thumb-sized. */
async function checkTouchTargets(tab, label, min = MIN_TOUCH) {
  const small = await tab.evaluate((minSize) => {
    const selector = 'a, button, select, input:not([type="hidden"]), [role="button"]';
    return [...document.querySelectorAll(selector)]
      .filter((el) => {
        const style = getComputedStyle(el);
        if (style.visibility === "hidden" || style.display === "none") return false;
        // Links set inline inside running text are sized by their line box.
        if (style.display === "inline") return false;
        if (el.closest("[aria-hidden='true']")) return false;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        // Screen-reader-only affordances (skip link) are 1x1 by design.
        if (rect.width <= 2 && rect.height <= 2) return false;

        // The hit area is the union of the control and any descendant that
        // spreads it — the "stretched link" that makes a whole card tappable.
        let { top, right, bottom, left } = rect;
        for (const child of el.querySelectorAll("*")) {
          const c = child.getBoundingClientRect();
          if (c.width === 0 || c.height === 0) continue;
          top = Math.min(top, c.top);
          left = Math.min(left, c.left);
          right = Math.max(right, c.right);
          bottom = Math.max(bottom, c.bottom);
        }
        return bottom - top < minSize || right - left < minSize;
      })
      .slice(0, 5)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const name = el.getAttribute("aria-label") || el.textContent?.trim().slice(0, 30) || "";
        return `${el.tagName.toLowerCase()} "${name}" ${Math.round(rect.width)}x${Math.round(rect.height)}`;
      });
  }, min);
  for (const target of small) fail(`TOUCH TARGET UNDER ${min}px — ${label}: ${target}`);
}

/** Two things on the floating layer must never sit on top of each other. */
async function checkFloatingCollisions(tab, label) {
  const overlaps = await tab.evaluate(() => {
    const boxes = [...document.querySelectorAll("body *")]
      .filter((el) => {
        const style = getComputedStyle(el);
        if (style.position !== "fixed") return false;
        if (style.visibility === "hidden" || style.display === "none") return false;
        if (Number(style.opacity) === 0) return false;
        const rect = el.getBoundingClientRect();
        // Ignore full-screen scrims and zero-size nodes.
        if (rect.width === 0 || rect.height === 0) return false;
        if (rect.width >= window.innerWidth * 0.98 && rect.height >= window.innerHeight * 0.98) {
          return false;
        }
        return true;
      })
      .map((el) => ({
        id: el.getAttribute("aria-label") || el.className.toString().slice(0, 40),
        rect: el.getBoundingClientRect(),
      }));

    const hits = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i].rect;
        const b = boxes[j].rect;
        // Skip a node that contains the other — nesting is not a collision.
        const contains =
          (a.left <= b.left && a.right >= b.right && a.top <= b.top && a.bottom >= b.bottom) ||
          (b.left <= a.left && b.right >= a.right && b.top <= a.top && b.bottom >= a.bottom);
        if (contains) continue;
        const overlap =
          a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        if (overlap) hits.push(`${boxes[i].id} ↔ ${boxes[j].id}`);
      }
    }
    return hits;
  });
  for (const hit of overlaps) fail(`FLOATING LAYER COLLISION — ${label}: ${hit}`);
}

/**
 * The shelf shows the agreed number of cards per row, and a fixed-length shelf
 * never ends in a part-full row.
 *
 * Two separate things are asserted, because they fail separately:
 *   - the grid really resolves to `expected` columns at this width, which is
 *     what "five products per row on desktop" actually means;
 *   - a `rail` or `twoRows` shelf shows a whole number of rows, so no card is
 *     left dangling on its own under a full one. A shelf given fewer products
 *     than a single row needs is exempt: showing the three that exist is right.
 */
async function checkProductGrids(tab, label, expected) {
  const grids = await tab.evaluate(() => {
    return [...document.querySelectorAll('[data-qa="product-grid"]')].map((grid) => {
      const visible = [...grid.children].filter(
        (card) => getComputedStyle(card).display !== "none",
      );
      const tops = visible.map((card) => Math.round(card.getBoundingClientRect().top));
      return {
        variant: grid.dataset.qaVariant,
        supplied: grid.children.length,
        visible: visible.length,
        // How many cards share the topmost row — the real, rendered answer.
        firstRow: tops.length ? tops.filter((top) => top === tops[0]).length : 0,
        columns: getComputedStyle(grid)
          .gridTemplateColumns.split(" ")
          .filter(Boolean).length,
      };
    });
  });

  if (grids.length === 0) return;

  for (const grid of grids) {
    if (grid.columns !== expected) {
      fail(`GRID COLUMNS — ${label}: ${grid.variant} shelf has ${grid.columns}, expected ${expected}`);
    }

    // The rendered row has to agree with the column count, or the cards are
    // wrapping early for a reason the computed style does not show.
    if (grid.visible >= expected && grid.firstRow !== expected) {
      fail(`GRID FIRST ROW — ${label}: ${grid.firstRow} card(s) in the top row, expected ${expected}`);
    }

    if (grid.variant === "grid") continue;
    if (grid.supplied < expected) continue;
    if (grid.visible % grid.columns !== 0) {
      fail(
        `PART-FULL SHELF ROW — ${label}: ${grid.variant} shows ${grid.visible} card(s) in ${grid.columns} columns`,
      );
    }
  }
}

/**
 * The SKU a product photograph belongs to, read out of its URL.
 *
 * Build 07 moved the photographs into Supabase Storage, so the shape changed
 * from `/products/EP01-A02.webp` to
 * `…/product-media/EP01-A02/ep01-a02-primary-1.webp` — the SKU is the folder
 * now, not the filename. Both are understood, because this check exists to
 * catch a photograph appearing on the wrong product and must not be quietly
 * defeated by a path change.
 */
function skuFromPhotoUrl(src) {
  const storage = src.match(/\/product-media\/([^/]+)\//);
  if (storage) return decodeURIComponent(storage[1]);
  const local = src.match(/\/products\/([^/]+)\.webp/);
  return local ? decodeURIComponent(local[1]) : null;
}

/** Every product photograph on the page, wherever it is served from. */
const PHOTO_SELECTOR = 'img[src*="/product-media/"], img[src*="/products/"]';

/** The photo on the product page must belong to the SKU being viewed. */
async function checkProductPhotoMatchesSku(tab, label, sku) {
  const src = await tab.evaluate((selector) => {
    const img = document.querySelector(`main ${selector}`);
    return img ? img.getAttribute("src") : null;
  }, PHOTO_SELECTOR);
  if (!src) return fail(`NO PRODUCT PHOTO — ${label}`);
  const shown = skuFromPhotoUrl(src);
  if (shown !== sku) fail(`WRONG PHOTO — ${label}: showing ${shown} on ${sku}`);
}

/**
 * Navigate, and wait for the page to settle.
 *
 * Since Build 07 the product photographs come from Supabase Storage rather than
 * from this server, so a shelf holds dozens of connections to a CDN in Mumbai
 * and `networkidle` can legitimately never arrive. Waiting for `load` and then
 * giving the network a bounded chance to go quiet gives the same practical
 * guarantee the gate needs — every image request issued and answered — without
 * failing on latency. `loadEverything()` still waits for every image to report
 * `complete`, which is the assertion that actually matters.
 */
async function settle(tab, url) {
  await tab.goto(url, { waitUntil: "load", timeout: 90_000 });
  await tab.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
}

async function screenshotPass(browser) {
  for (const viewport of widths) {
    for (const locale of locales) {
      for (const page of pages) {
        const label = `${page.name} ${locale.code} @ ${viewport.width}px`;
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: Number(process.env.DSF ?? 1),
          isMobile: viewport.mobile,
          hasTouch: viewport.mobile,
          userAgent: viewport.mobile ? devices["iPhone 14 Pro"].userAgent : undefined,
        });
        await seedStorage(context, locale.code, page.cart);

        const tab = await context.newPage();
        watchConsole(tab, label);
        await settle(tab, `${BASE_URL}${locale.prefix}${page.path}`);
        await tab.waitForTimeout(300);

        await loadEverything(tab);

        await checkOverflow(tab, label);
        await checkImages(tab, label);
        // 44px is a touch requirement, so it is enforced on touch viewports.
        if (viewport.mobile) await checkTouchTargets(tab, label);
        await checkFloatingCollisions(tab, label);
        await checkProductGrids(tab, label, viewport.columns);
        if (page.name === "product") {
          await checkProductPhotoMatchesSku(tab, label, sampleProduct.sku);
        }

        const file = path.join(OUT_DIR, `${page.name}-${locale.code}-${viewport.name}.png`);
        await tab.screenshot({ path: file, fullPage: page.full });
        console.log(`saved ${path.relative(process.cwd(), file)}`);

        await tab.close();
        await context.close();
      }
    }
  }
}

/**
 * The admin dashboard, held to the same bar as the storefront: no overflow, no
 * console errors, no broken images, no small touch targets, no floating-layer
 * collisions. It is mock-data only, so there is nothing else to assert yet.
 */
async function adminPass(browser) {
  for (const viewport of widths) {
    for (const page of adminPages) {
      const label = `${page.name} @ ${viewport.width}px`;
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: Number(process.env.DSF ?? 1),
        isMobile: viewport.mobile,
        hasTouch: viewport.mobile,
        userAgent: viewport.mobile ? devices["iPhone 14 Pro"].userAgent : undefined,
      });

      const tab = await context.newPage();
      watchConsole(tab, label);
      await settle(tab, `${BASE_URL}${page.path}`);
      await tab.waitForTimeout(300);

      await loadEverything(tab);

      await checkOverflow(tab, label);
      await checkImages(tab, label);
      if (viewport.mobile) await checkTouchTargets(tab, label);
      await checkFloatingCollisions(tab, label);

      const file = path.join(OUT_DIR, `${page.name}-${viewport.name}.png`);
      await tab.screenshot({ path: file, fullPage: page.full });
      console.log(`saved ${path.relative(process.cwd(), file)}`);

      await tab.close();
      await context.close();
    }
  }
}

/* ------------------------------------------------- the dashboard, signed in */

/**
 * The dashboard as a staff member actually sees it.
 *
 * Every operational screen is now behind the Supabase Auth session, so QA has
 * to sign in or it is photographing a redirect. It signs in as the DEVELOPMENT
 * QA MANAGER created by `scripts/qa-staff.mjs` — never as Ibrahim's real Owner
 * account, which no automated process may touch.
 *
 * HOW IT GETS IN WITHOUT A STORED PASSWORD. `qa-staff.mjs` prints a password
 * once and stores nothing. So this pass mints a fresh random one, resets it on
 * the exact auth user id recorded in `.qa-staff.local.json` — by id, never by a
 * search over roles or email domains — and then types it into the real sign-in
 * form. The password exists for the length of this run and is written nowhere.
 * Signing in through the real form rather than by injecting a cookie is also
 * better QA: it exercises the server action, the session cookie and the
 * middleware exactly as a person would.
 *
 * If no QA staff account has been created on this machine, the pass is skipped
 * with a loud note rather than failing the gate: it is a missing fixture, not a
 * defect in the shop.
 */
const STAFF_MANIFEST = ".qa-staff.local.json";

const staffPages = [
  { name: "admin-home", path: "/admin", full: true },
  { name: "admin-orders", path: "/admin/orders", full: true },
  { name: "admin-products", path: "/admin/products", full: true },
  { name: "admin-product-editor", path: `/admin/products/${sampleProduct.sku}`, full: true },
  { name: "admin-customers", path: "/admin/customers", full: true },
  { name: "admin-more", path: "/admin/more", full: true },
  { name: "admin-zones", path: "/admin/more/delivery-zones", full: true },
];

/** Reset a QA account's password to a fresh one and hand it back. */
async function qaStaffCredentials(accountKey = "manager") {
  if (!fs.existsSync(STAFF_MANIFEST)) return null;

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(STAFF_MANIFEST, "utf8"));
  } catch {
    return null;
  }

  const manager = (manifest.accounts ?? []).find((account) => account.key === accountKey);
  if (!manager) return null;

  try {
    process.loadEnvFile(".env.local");
  } catch {
    /* already loaded, or absent */
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !url.includes("dyjhacbbedytcstxxjzl")) return null;

  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const password = `Qa!${randomBytes(18).toString("base64url")}`;
  const { error } = await db.auth.admin.updateUserById(manager.authUserId, {
    password,
    email_confirm: true,
  });
  if (error) return null;

  return { email: manager.email, password };
}

async function signInAsStaff(tab, credentials) {
  await settle(tab, `${BASE_URL}/admin/sign-in`);

  // Already signed in from an earlier page in this context.
  if (await tab.getByText("You are signed in").count()) return true;

  await tab.fill("#email", credentials.email);
  await tab.fill("#password", credentials.password);
  await Promise.all([
    tab.waitForURL((url) => !url.pathname.startsWith("/admin/sign-in"), { timeout: 60_000 }),
    tab.click('[data-qa-anchor="admin-sign-in-submit"]'),
  ]).catch(() => {});

  return !new URL(tab.url()).pathname.startsWith("/admin/sign-in");
}

/**
 * The dialogs, which are where a phone-sized dashboard usually goes wrong: a
 * bottom sheet that overflows, a confirm button under the safe area, a radio
 * that is 20px across. They only exist after a click, so QA has to do the
 * clicking.
 */
async function auditDialog(tab, label, opener, viewport, name) {
  const control = tab.locator(opener).first();
  if ((await control.count()) === 0) {
    // Said out loud. A silent skip here is how a whole dialog went unaudited
    // once already: the page underneath was the wrong one and nothing said so.
    console.log(`  (${name}: opener not on this screen — not audited)`);
    return;
  }

  await control.scrollIntoViewIfNeeded().catch(() => {});
  await control.click().catch(() => {});
  await tab.waitForTimeout(400);

  // A sheet is fixed and already centred. The stock controls instead open a
  // panel in the flow of the page, below the button that opened it — so without
  // this the screenshot records the header rather than the thing that opened.
  if ((await tab.locator('[role="dialog"]').count()) === 0) {
    await control.evaluate((el) => {
      const panel = el.closest("div.rounded-xl") ?? el;
      panel.scrollIntoView({ block: "center" });
    }).catch(() => {});
    await tab.waitForTimeout(250);
  }

  await checkOverflow(tab, `${label} — ${name}`);
  if (viewport.mobile) await checkTouchTargets(tab, `${label} — ${name}`);

  const file = path.join(OUT_DIR, `${name}-${viewport.name}.png`);
  await tab.screenshot({ path: file });
  console.log(`saved ${path.relative(process.cwd(), file)}`);

  // Escape closes both the Sheet component and a <details> is left open —
  // either way the next audit starts from a known page.
  await tab.keyboard.press("Escape");
  await tab.waitForTimeout(250);
}

async function staffPass(browser, credentials) {
  let captured = 0;

  for (const viewport of widths) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: Number(process.env.DSF ?? 1),
      isMobile: viewport.mobile,
      hasTouch: viewport.mobile,
      userAgent: viewport.mobile ? devices["iPhone 14 Pro"].userAgent : undefined,
    });

    const tab = await context.newPage();
    watchConsole(tab, `signed-in admin @ ${viewport.width}px`);

    if (!(await signInAsStaff(tab, credentials))) {
      fail(`QA STAFF COULD NOT SIGN IN @ ${viewport.width}px`);
      await context.close();
      continue;
    }

    for (const page of staffPages) {
      const label = `${page.name} @ ${viewport.width}px`;
      await settle(tab, `${BASE_URL}${page.path}`);
      await tab.waitForTimeout(300);
      await loadEverything(tab);

      const landed = new URL(tab.url()).pathname;
      if (landed.startsWith("/admin/sign-in")) {
        fail(`SIGNED-IN STAFF BOUNCED — ${page.path} redirected to ${landed}`);
        continue;
      }

      await checkOverflow(tab, label);
      await checkImages(tab, label);
      if (viewport.mobile) await checkTouchTargets(tab, label);
      await checkFloatingCollisions(tab, label);

      const file = path.join(OUT_DIR, `${page.name}-${viewport.name}.png`);
      await tab.screenshot({ path: file, fullPage: page.full });
      console.log(`saved ${path.relative(process.cwd(), file)}`);
      captured += 1;

      // The stock dialogs live on the product editor and are the two controls
      // an operator uses most often after a delivery arrives.
      if (page.name === "admin-product-editor") {
        await auditDialog(tab, label, 'button:has-text("Add stock")', viewport, "admin-add-stock");
        await settle(tab, `${BASE_URL}${page.path}`);
        await auditDialog(tab, label, 'button:has-text("Set counted stock")', viewport, "admin-count-stock");
      }

      if (page.name === "admin-zones") {
        await auditDialog(tab, label, 'button:has-text("Add a zone")', viewport, "admin-zone-editor");
      }
    }

    // The order dialogs need a real order. There may not be one on a fresh
    // database, and that is not a failure — it is an empty shop.
    await settle(tab, `${BASE_URL}/admin/orders`);
    const firstOrder = tab.locator('a:has-text("Open order")').first();
    if (await firstOrder.count()) {
      await firstOrder.click();
      // Wait for the ROUTE, not for a guessed number of milliseconds. Reading
      // `tab.url()` too early returns the list, and every audit below would then
      // run against the wrong page and quietly find nothing.
      await tab.waitForURL(/\/admin\/orders\/[^/]+$/, { timeout: 60_000 }).catch(() => {});
      await loadEverything(tab);

      const label = `admin-order @ ${viewport.width}px`;
      await checkOverflow(tab, label);
      if (viewport.mobile) await checkTouchTargets(tab, label);

      const file = path.join(OUT_DIR, `admin-order-${viewport.name}.png`);
      await tab.screenshot({ path: file, fullPage: true });
      console.log(`saved ${path.relative(process.cwd(), file)}`);
      captured += 1;

      const orderUrl = tab.url();
      if (!/\/admin\/orders\/[^/]+$/.test(new URL(orderUrl).pathname)) {
        fail(`ORDER DID NOT OPEN — landed on ${new URL(orderUrl).pathname} @ ${viewport.width}px`);
        await tab.close();
        await context.close();
        continue;
      }

      // The two ways an order goes wrong are folded away behind a summary.
      await tab.locator("summary:has-text('Something went wrong')").first().click().catch(() => {});
      await tab.waitForTimeout(250);
      await auditDialog(tab, label, 'button:has-text("Cancel order")', viewport, "admin-cancel-order");

      await settle(tab, orderUrl);
      await tab.locator("summary:has-text('Something went wrong')").first().click().catch(() => {});
      await tab.waitForTimeout(250);
      await auditDialog(tab, label, 'button:has-text("Delivery failed")', viewport, "admin-delivery-failed");

      await settle(tab, orderUrl);
      await auditDialog(tab, label, 'button:has-text("Complete order")', viewport, "admin-record-payment");
    } else {
      console.log(`  (no orders on the development database — order dialogs not audited)`);
    }

    await tab.close();
    await context.close();
  }

  return captured;
}

/**
 * The same dashboard, seen by an Order staff member.
 *
 * The screens are built to show fewer controls to a smaller role, and that
 * claim is worth one look rather than only a unit test: a hidden button that
 * silently reappears is exactly the kind of regression nobody notices. This is
 * a courtesy check, not the boundary — the boundary is Row Level Security, and
 * `tests/db/09-admin-operations.test.ts` proves an Order staff token is refused
 * even when every check in this repository is bypassed.
 */
async function orderStaffPass(browser, credentials) {
  const viewport = widths[0]; // 390px — where hiding a control matters most
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: Number(process.env.DSF ?? 1),
    isMobile: true,
    hasTouch: true,
    userAgent: devices["iPhone 14 Pro"].userAgent,
  });

  const tab = await context.newPage();
  watchConsole(tab, `order staff @ ${viewport.width}px`);

  if (!(await signInAsStaff(tab, credentials))) {
    fail("QA ORDER STAFF COULD NOT SIGN IN");
    await context.close();
    return 0;
  }

  // The More menu is filtered by capability: Order staff manage nothing.
  //
  // Asserted on the menu's LINKS, not on the page text. The first version read
  // `document.body.innerText` and flagged "Staff" — which was the signed-in
  // account's own name, "QA Order Staff (development)", further down the page.
  // A check that can be tripped by a person's name is not checking the menu.
  await settle(tab, `${BASE_URL}/admin/more`);
  await loadEverything(tab);

  const menuLinks = await tab.$$eval('a[href^="/admin/more/"]', (links) =>
    links.map((link) => link.getAttribute("href")),
  );
  if (menuLinks.length > 0) {
    fail(`ORDER STAFF SEES ${menuLinks.join(", ")} IN THE MORE MENU`);
  }
  if (!(await tab.evaluate(() => document.body.innerText)).includes("Order staff")) {
    fail("ORDER STAFF IS NOT TOLD WHICH ROLE THEY ARE");
  }

  await checkOverflow(tab, `order-staff-more @ ${viewport.width}px`);
  await checkTouchTargets(tab, `order-staff-more @ ${viewport.width}px`);
  await tab.screenshot({ path: path.join(OUT_DIR, `admin-more-order-staff-${viewport.name}.png`), fullPage: true });
  console.log(`saved preview/screenshots/admin-more-order-staff-${viewport.name}.png`);

  // The product editor: readable, but nothing about money is editable.
  await settle(tab, `${BASE_URL}/admin/products/${sampleProduct.sku}`);
  await loadEverything(tab);

  const priceEditable = await tab.locator('input[inputmode="numeric"]:not([disabled])').count();
  if (priceEditable > 0) fail("ORDER STAFF CAN TYPE IN A PRICE FIELD");
  for (const label of ["Add stock", "Set counted stock"]) {
    if (await tab.locator(`button:has-text("${label}")`).count()) {
      fail(`ORDER STAFF SEES THE "${label}" BUTTON`);
    }
  }

  await checkOverflow(tab, `order-staff-product @ ${viewport.width}px`);
  await tab.screenshot({ path: path.join(OUT_DIR, `admin-product-order-staff-${viewport.name}.png`), fullPage: true });
  console.log(`saved preview/screenshots/admin-product-order-staff-${viewport.name}.png`);

  await tab.close();
  await context.close();
  return 2;
}

/**
 * LOCALE LAYOUT STABILITY
 *
 * Changing language should change words, not furniture. English and Kiswahili
 * labels are different lengths, and a header laid out around whichever one is
 * on screen shifts the search field, the language control and the cart button
 * sideways every time the shopper switches — which reads as a glitch even
 * though nothing is broken.
 *
 * So the persistent controls are marked `data-qa-anchor` in the markup and this
 * pass loads the same page in both languages at every QA width and compares
 * their boxes. It asserts nothing about the translated text itself: "Track
 * Order" and "Fuatilia Agizo" are allowed to be different widths. What is not
 * allowed is the slot around them changing size or position, because that is
 * what drags unrelated controls across the screen.
 *
 * WHAT IS COMPARED, AND WHY IT DIFFERS BY PLACE
 *   Horizontal position and width are compared everywhere. Sideways movement is
 *   the glitch being hunted, and no honest translation requires it.
 *
 *   Vertical position and height are compared only inside the header, which is
 *   fixed furniture that must not move at all. Further down a page, a
 *   translated paragraph is entitled to take one more line than its English
 *   original and push what follows down with it. Failing that would leave only
 *   two ways to pass — reserving blank vertical space, or shrinking the type —
 *   and both are worse than the wrap they would be hiding.
 */
const stabilityPages = [
  { name: "home", path: "/" },
  { name: "shop", path: "/shop" },
  { name: "product", path: `/product/${sampleProduct.slug}` },
];

/** Every anchored control that is actually on screen, and where it sits. */
async function anchorBoxes(browser, viewport, locale, pagePath) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.mobile,
    hasTouch: viewport.mobile,
    userAgent: viewport.mobile ? devices["iPhone 14 Pro"].userAgent : undefined,
  });
  await seedStorage(context, locale.code, false);

  const tab = await context.newPage();
  await settle(tab, `${BASE_URL}${locale.prefix}${pagePath}`);
  // Web fonts change text metrics, so the comparison has to happen after they
  // have swapped in — otherwise both sides are measured in the fallback face.
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForTimeout(200);

  const boxes = await tab.evaluate(() => {
    const found = {};
    for (const el of document.querySelectorAll("[data-qa-anchor]")) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      found[el.dataset.qaAnchor] = {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        // Header controls are held to vertical stability as well.
        inHeader: el.closest("header") !== null,
      };
    }
    return found;
  });

  await context.close();
  return boxes;
}

async function localeStabilityPass(browser) {
  const [english, kiswahili] = locales;

  for (const viewport of widths) {
    for (const page of stabilityPages) {
      const label = `${page.name} @ ${viewport.width}px`;
      const en = await anchorBoxes(browser, viewport, english, page.path);
      const sw = await anchorBoxes(browser, viewport, kiswahili, page.path);

      const anchors = new Set([...Object.keys(en), ...Object.keys(sw)]);
      let moved = 0;

      for (const anchor of anchors) {
        if (!en[anchor] || !sw[anchor]) {
          fail(`LOCALE ANCHOR MISSING — ${label}: "${anchor}" renders in only one language`);
          continue;
        }

        const sides = en[anchor].inHeader ? ["x", "y", "width", "height"] : ["x", "width"];
        const drift = sides
          .map((side) => ({ side, delta: sw[anchor][side] - en[anchor][side] }))
          .filter(({ delta }) => Math.abs(delta) > LOCALE_DRIFT_TOLERANCE);

        if (drift.length > 0) {
          moved += 1;
          const detail = drift
            .map(({ side, delta }) => `${side} ${delta > 0 ? "+" : ""}${delta.toFixed(1)}px`)
            .join(", ");
          fail(`LOCALE LAYOUT SHIFT — ${label}: "${anchor}" moved ${detail} in Kiswahili`);
        }
      }

      console.log(
        `${label}: ${anchors.size} anchored control(s), ${moved === 0 ? "stable" : `${moved} moved`}`,
      );
    }
  }
}

/** Behaviour that a screenshot cannot prove. */
async function behaviourPass(browser) {
  // --- hero down control actually scrolls -----------------------------------
  for (const locale of locales) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: devices["iPhone 14 Pro"].userAgent,
    });
    await seedStorage(context, locale.code, false);
    const tab = await context.newPage();
    watchConsole(tab, `hero-arrow ${locale.code}`);
    await settle(tab, `${BASE_URL}${locale.prefix}/`);

    const control = tab.locator("section button[aria-label]").first();
    await control.click();
    await tab.waitForTimeout(900);

    const result = await tab.evaluate(() => {
      const target = document.getElementById("shop-start");
      return {
        scrollY: window.scrollY,
        top: target ? target.getBoundingClientRect().top : null,
        focused: document.activeElement?.id ?? null,
      };
    });

    if (result.top === null) fail(`HERO ARROW — ${locale.code}: #shop-start does not exist`);
    else if (result.scrollY < 50) fail(`HERO ARROW — ${locale.code}: page did not scroll`);
    else if (Math.abs(result.top) > 120) {
      fail(`HERO ARROW — ${locale.code}: shelf ${Math.round(result.top)}px off target`);
    }
    if (result.focused !== "shop-start") {
      fail(`HERO ARROW — ${locale.code}: focus not moved to the shelf`);
    }
    await context.close();
  }

  // --- WhatsApp support button ---------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await seedStorage(context, "en", true);
    const tab = await context.newPage();
    watchConsole(tab, "support-button");
    await settle(tab, `${BASE_URL}/`);

    const support = tab.locator('[data-qa="support-button"]');
    if ((await support.count()) === 0) {
      fail("SUPPORT BUTTON — not rendered");
    } else {
      const href = await support.getAttribute("href");
      if (!href?.startsWith("https://wa.me/")) fail("SUPPORT BUTTON — not a wa.me link");
      const box = await support.boundingBox();
      if (!box || box.width < MIN_TOUCH || box.height < MIN_TOUCH) {
        fail(`SUPPORT BUTTON — target too small: ${JSON.stringify(box)}`);
      }

      const dock = tab.locator('[data-qa="mobile-dock"]');
      if ((await dock.count()) === 0) {
        fail("MOBILE DOCK — did not appear with a seeded cart");
      } else {
        const dockBox = await dock.boundingBox();
        if (box && dockBox && box.y + box.height > dockBox.y) {
          fail("SUPPORT BUTTON — overlaps the mobile cart dock");
        }
      }
    }
    await context.close();
  }

  // --- first-visit language chooser ----------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const tab = await context.newPage();
    watchConsole(tab, "language-chooser");
    await settle(tab, `${BASE_URL}/`);

    const dialog = tab.locator('[role="dialog"][aria-labelledby="language-chooser-title"]');
    if ((await dialog.count()) === 0) fail("LANGUAGE CHOOSER — did not appear on a first visit");
    else {
      await tab.locator('[role="dialog"] button[lang="sw"]').click();
      await tab.waitForURL(/\/sw$/, { timeout: 5000 }).catch(() => {
        fail("LANGUAGE CHOOSER — choosing Kiswahili did not go to /sw");
      });
      const lang = await tab.evaluate(() => document.documentElement.lang);
      if (!lang.startsWith("sw")) fail(`LANGUAGE CHOOSER — html lang is "${lang}" after choosing sw`);

      await tab.reload({ waitUntil: "load", timeout: 90_000 });
      if ((await dialog.count()) > 0) fail("LANGUAGE CHOOSER — reappeared after a choice was made");
    }
    await context.close();
  }

  // --- switcher keeps the page and the cart --------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await seedStorage(context, "en", true);
    const tab = await context.newPage();
    watchConsole(tab, "language-switcher");
    await settle(tab, `${BASE_URL}/shop?category=housekeeping`);

    const before = await tab.evaluate((key) => window.localStorage.getItem(key), CART_KEY);

    await tab.locator('[role="group"] button[lang="sw"]').first().click();
    await tab.waitForURL(/\/sw\/shop\?category=housekeeping/, { timeout: 5000 }).catch(() => {
      fail("LANGUAGE SWITCHER — did not keep the page and query string");
    });

    const after = await tab.evaluate((key) => window.localStorage.getItem(key), CART_KEY);
    if (before !== after) fail("LANGUAGE SWITCHER — the cart changed across the switch");

    const count = await tab.locator("header button >> text=/^[0-9]+$/").count();
    if (count === 0 && before) {
      const badge = await tab.evaluate(() => document.querySelector("header")?.innerText ?? "");
      if (!/\d/.test(badge)) fail("LANGUAGE SWITCHER — cart count missing after the switch");
    }
    await context.close();
  }

  // --- withheld data must never reach a customer ---------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await seedStorage(context, "en", false);
    const tab = await context.newPage();

    const hidden = withheld.find((p) => p.sku === "EP01-A01") ?? withheld[0];
    const response = await tab.goto(`${BASE_URL}/product/${hidden.slug}`, {
      waitUntil: "domcontentloaded",
    });
    if (response && response.status() !== 404) {
      fail(`WITHHELD PRODUCT REACHABLE — ${hidden.sku} returned ${response.status()}`);
    }

    for (const route of guardedAdminRoutes) {
      const response = await tab.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      const landed = new URL(tab.url()).pathname;
      if (!landed.startsWith("/admin/sign-in")) {
        fail(`ADMIN ROUTE NOT GUARDED — ${route} rendered at ${landed} (${response?.status()})`);
      }
    }

    await settle(tab, `${BASE_URL}/shop`);
    const body = await tab.evaluate(() => document.body.innerText);
    if (body.includes("EP23-A02") || /Spirix/i.test(body)) {
      fail("ORPHAN IMAGE LEAKED — EP23-A02 / Spirix appears on the shelf");
    }
    const shownSrcs = await tab.evaluate(
      (selector) => [...document.querySelectorAll(selector)].map((img) => img.getAttribute("src")),
      PHOTO_SELECTOR,
    );
    const shownSkus = shownSrcs.map(skuFromPhotoUrl).filter(Boolean);
    const allowed = new Set(publishable.map((p) => p.sku));
    for (const sku of shownSkus) {
      if (!allowed.has(sku)) fail(`UNAPPROVED PHOTO ON THE SHELF — ${sku}`);
    }
    await context.close();
  }
}

async function run() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();

  console.log(`QA against ${BASE_URL}`);
  console.log(`sample product: ${sampleProduct.sku} (${sampleProduct.slug})\n`);

  // `QA_ONLY=admin` runs just the dashboard passes. The full gate is ~25 minutes
  // because it walks 95 remote product photographs at five widths in two
  // languages; iterating on an admin dialog should not cost that.
  const only = process.env.QA_ONLY;

  if (only !== "admin") {
    await screenshotPass(browser);
  }
  console.log("\n--- admin ---");
  await adminPass(browser);

  console.log("\n--- admin, signed in as the development QA Manager ---");
  const credentials = await qaStaffCredentials();
  let staffShots = 0;
  if (credentials) {
    staffShots = await staffPass(browser, credentials);

    console.log("\n--- the same dashboard, as Order staff ---");
    const orderStaff = await qaStaffCredentials("order_staff");
    if (orderStaff) staffShots += await orderStaffPass(browser, orderStaff);
    else console.log("  SKIPPED — no development Order staff account on this machine.");
  } else {
    console.log(
      "  SKIPPED — no development QA staff on this machine.\n" +
        "  Run `npm run qa:staff create` to give the dashboard its visual QA back.",
    );
  }

  if (only !== "admin") {
    console.log("\n--- locale layout stability ---");
    await localeStabilityPass(browser);
    console.log("\n--- behaviour checks ---");
    await behaviourPass(browser);
  }

  await browser.close();

  console.log("\n--- QA summary ---");
  console.log(
    `${widths.length * (locales.length * pages.length + adminPages.length) + staffShots} screenshots captured.`,
  );
  if (problems.length === 0) {
    console.log(
      "PASS — no overflow, console errors, broken images, small targets, collisions,\n" +
        "       wrong shelf columns or locale layout shifts.",
    );
  } else {
    for (const problem of problems) console.log(problem);
    console.log(`\nFAIL — ${problems.length} problem(s).`);
    process.exitCode = 1;
  }
}

run();
