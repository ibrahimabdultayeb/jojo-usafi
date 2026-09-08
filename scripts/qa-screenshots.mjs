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
 *
 *   node scripts/qa-screenshots.mjs
 *   BASE_URL=http://localhost:3000 node scripts/qa-screenshots.mjs
 */

import fs from "node:fs";
import { mkdir } from "node:fs/promises";
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

const widths = [
  { name: "390-iphone", width: 390, height: 844, mobile: true },
  { name: "430-iphone-max", width: 430, height: 932, mobile: true },
  { name: "768-tablet", width: 768, height: 1024, mobile: true },
  { name: "1024-laptop", width: 1024, height: 768, mobile: false },
  { name: "1440-desktop", width: 1440, height: 900, mobile: false },
];

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

/** Admin screens. English only in V1, so there is no locale dimension here. */
const adminPages = [
  { name: "admin-home", path: "/admin" },
  { name: "admin-orders", path: "/admin/orders" },
  // An order that is out for delivery, so the payment gate is one tap away.
  { name: "admin-order", path: "/admin/orders/JU-000141" },
  { name: "admin-products", path: "/admin/products" },
  { name: "admin-product", path: `/admin/products/${sampleProduct.sku}` },
  { name: "admin-customers", path: "/admin/customers" },
  { name: "admin-customer", path: "/admin/customers/cus_hassan_ali" },
  { name: "admin-more", path: "/admin/more" },
  { name: "admin-zones", path: "/admin/delivery-zones" },
  { name: "admin-website", path: "/admin/website" },
  { name: "admin-settings", path: "/admin/settings" },
];

/**
 * Internal vocabulary that must never reach a member of staff. If any of these
 * appear as visible text, the "no raw status values" rule has been broken.
 */
const RAW_VALUES = [
  "awaiting_confirmation",
  "out_for_delivery",
  "delivery_failed",
  "order_staff",
  "MISSING_APPROVED_IMAGE",
  "PRICE_IMPLAUSIBLE",
  "PRICE_INVERSION",
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
  await tab.waitForLoadState("networkidle");
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
        if (!img.src.includes("/products/")) return false;
        if (img.closest("[aria-hidden='true']")) return false;
        // alt="" is a deliberate "decorative" marker. It is correct when the
        // thing the image depicts is already named next to it — by an explicit
        // label, or by visible text in the row or card the image sits in.
        if (img.hasAttribute("alt") && img.alt === "") {
          if (img.closest("[aria-label], [aria-labelledby]")) return false;
          const named = img.closest("li, a, section, article");
          return !(named && named.textContent && named.textContent.trim().length > 2);
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

/** The photo on the product page must belong to the SKU being viewed. */
async function checkProductPhotoMatchesSku(tab, label, sku) {
  const src = await tab.evaluate(() => {
    const img = document.querySelector('main img[src*="/products/"]');
    return img ? img.getAttribute("src") : null;
  });
  if (!src) return fail(`NO PRODUCT PHOTO — ${label}`);
  const shown = src.split("/").pop().replace(".webp", "");
  if (shown !== sku) fail(`WRONG PHOTO — ${label}: showing ${shown} on ${sku}`);
}

async function adminScreenshotPass(browser) {
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
      await tab.goto(`${BASE_URL}${page.path}`, { waitUntil: "networkidle" });
      await loadEverything(tab);

      await checkOverflow(tab, label);
      await checkImages(tab, label);
      if (viewport.mobile) await checkTouchTargets(tab, label);
      await checkFloatingCollisions(tab, label);
      await checkNoRawValues(tab, label);
      await checkNoDeleteControls(tab, label);

      const file = path.join(OUT_DIR, `${page.name}-${viewport.name}.png`);
      await tab.screenshot({ path: file, fullPage: true });
      console.log(`saved ${path.relative(process.cwd(), file)}`);

      await tab.close();
      await context.close();
    }
  }
}

/** Staff must never be shown an internal status value or a validation flag. */
async function checkNoRawValues(tab, label) {
  const found = await tab.evaluate((values) => {
    const text = document.body.innerText;
    return values.filter((value) => text.includes(value));
  }, RAW_VALUES);
  for (const value of found) fail(`RAW VALUE ON SCREEN — ${label}: "${value}"`);
}

/** The admin has no destructive delete. Products are archived, never removed. */
async function checkNoDeleteControls(tab, label) {
  const found = await tab.evaluate(() =>
    [...document.querySelectorAll('button, a, [role="button"]')]
      .map((el) => `${el.getAttribute("aria-label") ?? ""} ${el.textContent ?? ""}`.trim())
      .filter((text) => /\bdelete\b|\bdestroy\b|\bremove product\b/i.test(text))
      .slice(0, 3),
  );
  for (const text of found) fail(`DELETE CONTROL FOUND — ${label}: "${text}"`);
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
        await tab.goto(`${BASE_URL}${locale.prefix}${page.path}`, { waitUntil: "networkidle" });
        await tab.waitForTimeout(300);

        await loadEverything(tab);

        await checkOverflow(tab, label);
        await checkImages(tab, label);
        // 44px is a touch requirement, so it is enforced on touch viewports.
        if (viewport.mobile) await checkTouchTargets(tab, label);
        await checkFloatingCollisions(tab, label);
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
    await tab.goto(`${BASE_URL}${locale.prefix}/`, { waitUntil: "networkidle" });

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
    await tab.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

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
    await tab.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

    const dialog = tab.locator('[role="dialog"][aria-labelledby="language-chooser-title"]');
    if ((await dialog.count()) === 0) fail("LANGUAGE CHOOSER — did not appear on a first visit");
    else {
      await tab.locator('[role="dialog"] button[lang="sw"]').click();
      await tab.waitForURL(/\/sw$/, { timeout: 5000 }).catch(() => {
        fail("LANGUAGE CHOOSER — choosing Kiswahili did not go to /sw");
      });
      const lang = await tab.evaluate(() => document.documentElement.lang);
      if (!lang.startsWith("sw")) fail(`LANGUAGE CHOOSER — html lang is "${lang}" after choosing sw`);

      await tab.reload({ waitUntil: "networkidle" });
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
    await tab.goto(`${BASE_URL}/shop?category=housekeeping`, { waitUntil: "networkidle" });

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

    await tab.goto(`${BASE_URL}/shop`, { waitUntil: "networkidle" });
    const body = await tab.evaluate(() => document.body.innerText);
    if (body.includes("EP23-A02") || /Spirix/i.test(body)) {
      fail("ORPHAN IMAGE LEAKED — EP23-A02 / Spirix appears on the shelf");
    }
    const shownSkus = await tab.evaluate(() =>
      [...document.querySelectorAll('img[src*="/products/"]')].map((img) =>
        img.getAttribute("src").split("/").pop().replace(".webp", ""),
      ),
    );
    const allowed = new Set(publishable.map((p) => p.sku));
    for (const sku of shownSkus) {
      if (!allowed.has(sku)) fail(`UNAPPROVED PHOTO ON THE SHELF — ${sku}`);
    }
    await context.close();
  }
}

async function adminBehaviourPass(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: devices["iPhone 14 Pro"].userAgent,
  });
  const tab = await context.newPage();
  watchConsole(tab, "admin-behaviour");

  // --- bottom navigation actually navigates -------------------------------
  await tab.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
  const navLinks = tab.locator('[data-qa="admin-bottom-nav"] a');
  const navCount = await navLinks.count();
  if (navCount !== 5) fail(`ADMIN NAV — expected 5 destinations, found ${navCount}`);

  await navLinks.nth(1).click();
  await tab.waitForURL(/\/admin\/orders$/, { timeout: 5000 }).catch(() => {
    fail("ADMIN NAV — tapping Orders did not open the orders list");
  });

  // --- exactly one primary next action on an order -------------------------
  await tab.goto(`${BASE_URL}/admin/orders/JU-000141`, { waitUntil: "networkidle" });
  if ((await tab.locator("select").count()) > 0) {
    fail("ORDER DETAIL — a status dropdown is on screen");
  }

  const complete = tab.getByRole("button", { name: "Complete Order" });
  if ((await complete.count()) !== 1) {
    fail("ORDER DETAIL — expected exactly one 'Complete Order' next action");
  } else {
    await complete.click();
    const dialog = tab.locator('[role="dialog"]');
    await dialog.waitFor({ timeout: 5000 }).catch(() => fail("PAYMENT GATE — dialog did not open"));

    const confirm = dialog.getByRole("button", { name: "Complete Order" });
    if (await confirm.isEnabled()) {
      fail("PAYMENT GATE — completing was possible before a payment method was chosen");
    }

    await dialog.getByRole("button", { name: "Digital" }).click();
    if (await confirm.isEnabled()) {
      fail("PAYMENT GATE — digital payment accepted with no transaction reference");
    }

    await dialog.locator("#payment-reference").fill("MPESA-TEST-0001");
    if (!(await confirm.isEnabled())) {
      fail("PAYMENT GATE — still blocked after a reference was entered");
    }
    await tab.keyboard.press("Escape");
  }

  // --- returned-items question has no default ------------------------------
  const markFailed = tab.getByRole("button", { name: "Mark Delivery Failed" });
  if ((await markFailed.count()) === 0) {
    fail("ORDER DETAIL — no 'Mark Delivery Failed' action on an out-for-delivery order");
  } else {
    await markFailed.click();
    const dialog = tab.locator('[role="dialog"]');
    await dialog.waitFor({ timeout: 5000 });

    const yes = dialog.getByRole("button", { name: "Yes", exact: true });
    const no = dialog.getByRole("button", { name: "No", exact: true });
    const yesPressed = await yes.getAttribute("aria-pressed");
    const noPressed = await no.getAttribute("aria-pressed");
    if (yesPressed !== "false" || noPressed !== "false") {
      fail(`RETURNED ITEMS — an answer is preselected (Yes=${yesPressed}, No=${noPressed})`);
    }

    const [yesClass, noClass] = await Promise.all([
      yes.getAttribute("class"),
      no.getAttribute("class"),
    ]);
    if (yesClass !== noClass) fail("RETURNED ITEMS — the two answers are styled differently");

    const save = dialog.getByRole("button", { name: "Save" });
    if (await save.isEnabled()) fail("RETURNED ITEMS — saving was possible with no answer");
    await tab.keyboard.press("Escape");
  }

  // --- cancellation needs a reason -----------------------------------------
  const cancel = tab.getByRole("button", { name: "Cancel Order" }).first();
  if ((await cancel.count()) === 0) {
    fail("ORDER DETAIL — no 'Cancel Order' action");
  } else {
    await cancel.click();
    const dialog = tab.locator('[role="dialog"]');
    await dialog.waitFor({ timeout: 5000 });
    if (await dialog.getByRole("button", { name: "Cancel Order" }).isEnabled()) {
      fail("CANCELLATION — cancelling was possible with no reason given");
    }
    await tab.keyboard.press("Escape");
  }

  // --- the item code is locked --------------------------------------------
  await tab.goto(`${BASE_URL}/admin/products/${sampleProduct.sku}`, { waitUntil: "networkidle" });
  const skuEditable = await tab.evaluate((sku) => {
    const fields = [...document.querySelectorAll("input, textarea, select")];
    return fields.some((f) => f.value === sku && !f.disabled && !f.readOnly);
  }, sampleProduct.sku);
  if (skuEditable) fail("PRODUCT EDITOR — the item code is editable");

  if (!(await tab.evaluate(() => document.body.innerText.includes("Locked")))) {
    fail("PRODUCT EDITOR — the item code is not visibly marked as locked");
  }

  for (const name of ["Add Stock", "Count Stock"]) {
    if ((await tab.getByRole("button", { name }).count()) === 0) {
      fail(`PRODUCT EDITOR — no "${name}" action`);
    }
  }

  // --- free delivery disables the fee box ----------------------------------
  await tab.goto(`${BASE_URL}/admin/delivery-zones`, { waitUntil: "networkidle" });
  const editButtons = tab.getByRole("button", { name: "Edit" });
  if ((await editButtons.count()) === 0) {
    fail("DELIVERY ZONES — no zone can be edited");
  } else {
    // Mikocheni is the free-delivery zone in the sample data.
    await editButtons.nth(2).click();
    const dialog = tab.locator('[role="dialog"]');
    await dialog.waitFor({ timeout: 5000 });
    if (await dialog.locator("#zone-fee").isEnabled()) {
      fail("DELIVERY ZONES — the fee box is still active while free delivery is on");
    }
    await tab.keyboard.press("Escape");
  }

  await context.close();
}

async function run() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();

  console.log(`QA against ${BASE_URL}`);
  console.log(`sample product: ${sampleProduct.sku} (${sampleProduct.slug})\n`);

  await screenshotPass(browser);
  await adminScreenshotPass(browser);
  console.log("\n--- behaviour checks ---");
  await behaviourPass(browser);
  await adminBehaviourPass(browser);

  await browser.close();

  console.log("\n--- QA summary ---");
  console.log(
    `${widths.length * (locales.length * pages.length + adminPages.length)} screenshots captured.`,
  );
  if (problems.length === 0) {
    console.log("PASS — no overflow, console errors, broken images, small targets or collisions.");
  } else {
    for (const problem of problems) console.log(problem);
    console.log(`\nFAIL — ${problems.length} problem(s).`);
    process.exitCode = 1;
  }
}

run();
