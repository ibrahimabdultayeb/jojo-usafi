# Jojo Usafi — Storefront Visual Prototype

Built as a **bounded, frontend-only visual prototype**. The point is to let you open the
site on a phone and a laptop and get a realistic impression of what Jojo Usafi will look
and feel like. Nothing here touches production infrastructure.

Run it with `npm install && npm run dev`, then open http://localhost:3000.
Full instructions are in [`README.md`](./README.md).

---

## 1. What was created

### Application shell
- Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4, scaffolded from scratch.
- Inter (body) and Space Grotesk (display) — the same pairing the EcoPlus reference uses.
- A brand colour scale anchored on the reference green (`#16a34a` / emerald), exposed as
  Tailwind `brand-*` tokens so a future rebrand is one file.

### Pages
| Route | State |
| --- | --- |
| `/` | Full homepage |
| `/shop` | Catalogue with category filter, sort and search |
| `/product/[slug]` | Product detail with a working size chooser (45 products pre-rendered) |
| `/cart` | Full cart page |
| `/checkout` | Visual shell — creates no order |
| `/track-order` | Visual shell — performs no lookup |
| `/contact` | Contact channels and delivery-area explanation |
| `not-found` | Styled 404 |

### Homepage sections
1. Rotating announcement bar (delivery area, lipa ukipokea, order in a minute)
2. Sticky Jojo Usafi header — nav, search, cart with live count, mobile menu sheet
3. Hero — headline, proof points, two CTAs
4. Shop by category — horizontal rail on phones, 5-up grid on desktop
5. Best sellers grid
6. One grid per category (Personal Care, Housekeeping, Washroom & Surface Care, Laundry Care, Vehicle Care)
7. "The Jojo Usafi standard" trust pillars
8. Delivery-area banner
9. "Brands we stock" — deliberately framed as a shop that carries brands
10. "How ordering works" — three steps, dark section
11. Footer — shop links, categories, contact, hours, service area
12. Floating WhatsApp **support** button

### Working interactions
- Add to cart from a card (the `+` expands into a quantity stepper in place).
- Cart drawer with quantity controls, per-line totals, subtotal and remove.
- Sticky mobile cart bar that appears only once the cart has something in it.
- Cart persists across reloads via `localStorage`, keyed by SKU.
- Category filter, sort (featured / price / A–Z) and header search on `/shop`.
- Size chooser on the product page that moves between real pack sizes.

---

## 2. What is intentionally mocked

| Area | Prototype state |
| --- | --- |
| **Catalogue data** | `src/lib/catalogue/mock-data.ts` — a local module shaped like the intended Firestore documents. 8 brands, 5 categories, 45 products. |
| **Product photography** | Drawn as SVG container silhouettes (bottle / jerrycan / drum / tub) in the brand tone. Real photos will come from Firebase Storage. |
| **Product names & prices** | Taken from the current EcoPlus catalogue so the shelf reads realistically. **Not confirmed Jojo Usafi retail prices.** |
| **Cart storage** | `localStorage` only. No server cart, no session. |
| **Checkout** | Form renders and validates nothing; submitting shows a "not connected yet" notice. No order is created. |
| **Track order** | Form renders; submitting shows a "not connected yet" notice. No Firestore lookup. |
| **WhatsApp number** | `255700000000` placeholder in `src/lib/site.ts`. |
| **Phone / email / address** | Placeholders in `src/lib/site.ts`. |
| **Logo** | Typographic lockup ("J" tile + JOJO USAFI wordmark) standing in for a real mark. |
| **Search** | Client-side substring match over the local catalogue. |

Every placeholder is in `src/lib/site.ts` or `src/lib/catalogue/mock-data.ts` — there are no
hard-coded phone numbers or prices scattered through components.

---

## 3. Business decisions deliberately NOT made

These change how the store operates, so the prototype avoids inventing them:

- **Delivery fee** — the UI says "calculated at checkout" and "confirmed with your area". No number.
- **Free-delivery threshold** — the EcoPlus reference advertises "FREE delivery over TSh 30,000". Jojo Usafi's threshold, if any, is yours to set, so it is absent.
- **Same-day cut-off time** — the reference promises same-day delivery on orders before 2pm. Not claimed here.
- **Which Dar es Salaam areas are served** — the copy says "selected Dar es Salaam areas" throughout, never a named list and never nationwide Tanzania.
- **Loyalty / rewards** — the reference has a rewards voucher scheme. Not reproduced.
- **Retail prices** — shown prices are the EcoPlus catalogue's, used as realistic sample data.

Once you decide these, they are copy changes in `src/lib/site.ts` plus a delivery rule in the
cart summary.

---

## 4. Notable differences from the EcoPlus reference

Deliberate, and each for a reason:

| Reference | Jojo Usafi prototype | Why |
| --- | --- | --- |
| WhatsApp is the checkout ("your order opens in WhatsApp") | Ordering happens on the site; WhatsApp is a support button | Project constitution: orders are recorded before WhatsApp; WhatsApp is a channel, not the database |
| "Factory-direct", "EcoPlus Manufacturing Hub" | Retailer voice — "brands we stock", "honest prices" | Jojo Usafi is a retailer, not the factory |
| Delivers across Tanzania, Kenya and Uganda | Selected Dar es Salaam areas | Actual service area |
| A single brand's identity fills the site | Brand-neutral shell with a "Brands we stock" section | Future non-EcoPlus brands must fit without a rebuild |
| Rewards programme, bundles, currency/region switcher | Not built | Out of scope for this prototype |
| Header is `position: fixed` with a JS banner-offset variable | Announcement bar scrolls away, header is `sticky` | Same feel, no offset maths, no layout jump |
| 20-column asymmetric bento product grid on desktop | Even 2 / 3 / 4 column grid | Reads more calmly with 45 SKUs and keeps card heights consistent on phones |
| Product photography | SVG container artwork | No photography available yet |

Everything else — the pill navigation, blurred sticky header, rounded-3xl cards with the
`0 8px 30px` shadow, the `+`-expands-to-stepper control, section headings with the hairline
rule, the dark "how ordering works" band, the gradient hero headline — follows the reference
closely.

---

## 5. Mobile-first decisions

- Built at 390px first, then widened. Nothing was designed on desktop and shrunk.
- Every interactive control is at least 44px tall (`h-11` / `min-h-14`).
- No hover-only functionality anywhere; hover is decoration on top of a tap target.
- Category strip and shop filters are horizontal swipe rails on phones, grids on desktop.
- The cart bar only appears when it is useful, so it never eats browsing space.
- `env(safe-area-inset-bottom)` respected on the cart bar and mobile menu.
- Body uses `overflow-x: clip`, and the QA script fails if any page scrolls sideways.
- `prefers-reduced-motion` disables all animation.

---

## 6. Verification performed

- `npm run build` — passes, 54 routes pre-rendered.
- `npm run lint` — clean.
- `npm run typecheck` — clean.
- `npm run qa:screenshots` — every page captured at 390 / 430 / 768 / 1024 / 1440,
  checked for horizontal overflow and console errors. Results in `preview/screenshots/`.

---

## 7. What waits for later phases

Explicitly **not** done, by instruction:

- Firebase project, Cloud Firestore, Firebase Auth, Firebase Storage
- Google Sheets two-way synchronisation and the sync/audit log
- The real order backend, order events and order status workflow
- Payments and payment processing
- Customer accounts and authentication
- The admin dashboard
- The analytics event pipeline
- Vercel deployment, domains and DNS
- Playwright user-journey tests (only the visual QA script exists)
- Real product photography and the final Jojo Usafi logo

## 8. Known visual work still open

Small things left at the time boundary, none blocking:

- Product artwork is schematic; a photo-led grid will change card proportions slightly.
- No skeleton loading states on `/shop` (the catalogue is local, so nothing loads yet).
- The homepage renders five category grids; with a much larger catalogue these should
  become paginated rails or lazy sections.
- No bundles/multipack presentation yet — worth revisiting once bundle pricing is decided.
