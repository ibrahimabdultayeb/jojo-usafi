# Jojo Usafi — Storefront Prototype

A **bounded, frontend-only prototype**. The point is to let you open the site on a phone
and a laptop, in English or Kiswahili, and get a realistic impression of what Jojo Usafi
will look and feel like. Nothing here touches production infrastructure.

Run it with `npm install && npm run dev`, then open http://localhost:3000.
Full instructions are in [`README.md`](./README.md).

---

## 1. What is real

### The catalogue is real
Products, SKUs, brands, categories, pack sizes and prices come from
`imports/jojo-usafi-product-master.csv` — 201 rows. Product photography is the approved
white-background set. Nothing is hand-written or invented.

- **95 products are on the shelf.** Each has an approved photograph matched on its exact SKU.
- **106 products are hidden** because no approved photograph exists for them yet.
- All 201 rows are kept in the generated catalogue with their validation flags.

See [`docs/CATALOGUE_REPORT.md`](./docs/CATALOGUE_REPORT.md), regenerated on every build.

### Both languages are real
English at `/`, Kiswahili at `/sw/`. 211 translated interface keys, a first-visit chooser,
a remembered preference, an EN/SW switcher, and correct `<html lang>`, canonical and
hreflang on every page. Cart = **Kikapu**, Checkout = **Kamilisha Agizo**, Order = **Agizo**.

### Application shell
Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4. Inter (body) and Space
Grotesk (display) — the pairing the EcoPlus reference uses. A brand colour scale anchored
on the reference green, exposed as Tailwind `brand-*` tokens, so a rebrand is one file.

### Pages
| Route | State |
| --- | --- |
| `/` · `/sw` | Full homepage |
| `/shop` · `/sw/shop` | Catalogue with category filter, brand filter, sort and search |
| `/product/[slug]` | Product detail with a working size chooser (95 products × 2 languages) |
| `/cart` · `/sw/cart` | Full cart page |
| `/checkout` · `/sw/checkout` | Visual shell — creates no order |
| `/track-order` · `/sw/track-order` | Visual shell — performs no lookup |
| `/contact` · `/sw/contact` | Contact channels and delivery-area explanation |
| `not-found` | Styled 404, in both languages |

### Working interactions
- Add to cart from a card — the `+` expands into a quantity stepper in place.
- Cart drawer with quantity controls, per-line totals, subtotal and remove.
- Sticky mobile cart bar that appears only once the cart has something in it.
- Cart persists across reloads *and across a language switch* via `localStorage`, keyed by SKU.
- Category filter, sort and header search on the shop page.
- Size chooser on the product page that moves between real pack sizes.
- A working hero down control — keyboard operable and reduced-motion aware.
- Language chooser, remembered preference and EN/SW switching that keeps your place.

---

## 2. What is still mocked

| Area | Prototype state |
| --- | --- |
| **Backend** | None. The catalogue is a committed file read through `src/lib/catalogue/queries.ts`, which is the single seam Supabase will replace. |
| **Cart storage** | `localStorage` only. No server cart, no session. |
| **Checkout** | Form renders and validates nothing; submitting shows a "not connected yet" notice. No order is created. |
| **Track order** | Form renders; submitting shows a "not connected yet" notice. No lookup. |
| **WhatsApp number** | `255700000000` placeholder in `src/lib/site.ts`. |
| **Phone / email / address** | Placeholders in `src/lib/site.ts`. |
| **Logo** | Typographic lockup ("J" tile + JOJO USAFI wordmark) standing in for a real mark. |
| **Search** | Client-side substring match over the local catalogue. |
| **Site URL** | `NEXT_PUBLIC_SITE_URL`, falling back to the dev server. No production domain has been chosen, so none is invented. |

Every placeholder is in `src/lib/site.ts`. There are no hard-coded phone numbers or prices
scattered through components.

---

## 3. Business decisions deliberately NOT made

These change how the store operates, so the prototype avoids inventing them:

- **Delivery fee** — the UI says "calculated at checkout". No number.
- **Free-delivery threshold** — the EcoPlus reference advertises "FREE delivery over
  TSh 30,000". Jojo Usafi's threshold, if any, is yours to set, so it is absent.
- **Same-day cut-off time** — the reference promises same-day on orders before 2pm. Not claimed.
- **Which Dar es Salaam areas are served** — the copy says "selected Dar es Salaam areas",
  never a named list and never nationwide Tanzania.
- **Loyalty / rewards** — the reference has a voucher scheme. Not reproduced.
- **Retail prices** — the shelf shows the Product Master's prices. Not confirmed Jojo
  Usafi retail prices.

### Two catalogue items need your decision

- **`EP01-A01` — Multix Multipurpose Detergent Lemon Fresh 20LT, listed at TZS 128.**
  The 5LT sells at 34,000 and the 750ML at 11,400, so 128 cannot be right. It has been
  **flagged and withheld, not corrected** — guessing a selling price is not ours to do.
  The product stays hidden until you confirm the real figure.
- **`EP23-A02` — Spirix Methylated Spirit 5L.** An approved photograph exists, but there
  is no row for it in the Product Master. It is reported, not invented as a product. It
  needs a master row before it can sell.

---

## 4. Notable differences from the EcoPlus reference

Deliberate, and each for a reason:

| Reference | Jojo Usafi prototype | Why |
| --- | --- | --- |
| WhatsApp is the checkout | Ordering happens on the site; WhatsApp is a support button | Project constitution: orders are recorded before WhatsApp |
| "Factory-direct", "EcoPlus Manufacturing Hub" | Retailer voice — "brands we stock" | Jojo Usafi is a retailer, not the factory |
| Delivers across Tanzania, Kenya and Uganda | Selected Dar es Salaam areas | Actual service area |
| A single brand's identity fills the site | Brand-neutral shell with a "Brands we stock" section | Future non-EcoPlus brands must fit without a rebuild |
| English only | English and Kiswahili | Tanzanian customers |
| Rewards programme, bundles, region switcher | Not built | Out of scope |
| Header is `position: fixed` with a JS banner-offset variable | Announcement bar scrolls away, header is `sticky` | Same feel, no offset maths, no layout jump |
| 20-column asymmetric bento product grid | Even 2 / 3 / 4 column grid | Reads calmly and keeps card heights consistent on phones |

Everything else — pill navigation, blurred sticky header, rounded-3xl cards with the
`0 8px 30px` shadow, the `+`-expands-to-stepper control, section headings with the hairline
rule, the dark "how ordering works" band, the gradient hero headline — follows the
reference closely.

---

## 5. Mobile-first decisions

- Built at 390px first, then widened. Nothing was designed on desktop and shrunk.
- Every control on a touch viewport is at least 44×44px, and the QA gate enforces it.
- No hover-only functionality anywhere; hover is decoration on top of a tap target.
- Category strip and shop filters are horizontal swipe rails on phones, grids on desktop.
- The cart bar only appears when it is useful, so it never eats browsing space.
- `env(safe-area-inset-bottom)` respected on the cart bar, the support button and the menu.
- A documented floating-layer contract keeps the WhatsApp button and the cart dock apart.
- Body uses `overflow-x: clip`, and the QA gate fails if any page scrolls sideways.
- `prefers-reduced-motion` disables all animation, including the hero scroll.
- Kiswahili copy is longer than English, so both languages are QA'd at every width.

---

## 6. Verification performed

```
npm run typecheck        pass
npm run lint             pass
npm run i18n:check       pass — 211 keys, en + sw in sync
npm run catalogue:check  pass — committed catalogue matches imports/
npm run build            pass — 205 pages prerendered
npm run qa:screenshots   pass — 70 screenshots, all behaviour checks green
```

The QA gate covers both languages at 390 / 430 / 768 / 1024 / 1440 and fails on horizontal
overflow, console errors, broken images, a product showing another SKU's photograph,
touch targets under 44px, floating-layer collisions, a broken hero control, a broken
language chooser or switcher, a withheld product being reachable, or an unapproved photo
reaching the shelf.

---

## 7. What waits for later phases

Explicitly **not** done, by instruction:

- Supabase PostgreSQL, Auth, Storage, Row Level Security and migrations — **not started**
- Google Sheet ↔ Supabase two-way synchronisation and the sync/audit log
- The real order backend, order events and order status workflow
- Payments and payment processing
- Customer accounts and authentication
- **The admin dashboard — deferred to Recovery Build B**
- The analytics event pipeline
- Vercel deployment, domains and DNS
- Playwright user-journey tests (only the QA gate exists)
- The final Jojo Usafi logo and real business contact details

---

## 8. Known work still open

- 106 products have no approved photograph and are therefore not on the shelf. That needs
  photography, not code.
- Vehicle Care has only one publishable product, so its homepage row looks sparse. That is
  the honest state of the approved image set, not a layout bug.
- 200 of 201 master rows have no description, so most product pages show none. Nothing was
  written to fill the gap.
- No skeleton loading states on the shop page (the catalogue is local, so nothing loads).
- No bundles/multipack presentation yet — worth revisiting once bundle pricing is decided.
