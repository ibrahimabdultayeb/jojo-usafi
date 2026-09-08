# Jojo Usafi Progress

## Current stage

Storefront prototype on the **real catalogue**, in **English and Kiswahili**, with real
product photography. Frontend only — no backend, no cloud services connected.

## Completed

### Environment and foundation
- Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4
- Design system aligned to the EcoPlus reference (Inter + Space Grotesk, brand green scale,
  rounded-3xl cards, pill navigation, blurred sticky header)
- Git, GitHub, Vercel CLI, Playwright, UI UX Pro Max, Claude project rules

### Storefront visual prototype — 2026-09-07
The original approved prototype: homepage, catalogue, product detail, cart drawer and cart
page, checkout and track-order shells, contact, 404, and the Playwright QA script.

### Recovery Build A — 2026-09-08
Rebuilt on a replacement laptop. Builds 01–04 were committed only on the previous machine
and were not recoverable from Git, so Builds 01–03 were rebuilt against the real catalogue.

**Catalogue foundation**
- `scripts/build-catalogue.mjs` builds the shelf from the restored Product Master CSV and
  the approved white-background photography — deterministically, with no timestamps
- 201 master rows processed, 96 approved images, **95 exact SKU matches**
- 95 publishable products; 106 withheld for having no approved photograph
- `EP01-A01` (TZS 128) flagged `PRICE_IMPLAUSIBLE` and withheld — **not corrected**
- `EP23-A02` Spirix reported as an approved image with no master row — **not invented**
- All 201 rows preserved in the generated catalogue; only publishable rows reach the UI
- `docs/CATALOGUE_REPORT.md` regenerated on every build; `catalogue:check` guards drift
- The prototype's synthetic `EP-0001` SKUs are gone; SKU is now the real identity key

**Build 01 — interaction and QA**
- The hero down control is a real `<button>`: tab-reachable, Enter/Space operable,
  reduced-motion aware, and it moves focus to the shelf it scrolls to
- WhatsApp support button rebuilt on the real brand glyph, with a documented floating-layer
  contract so it and the mobile cart dock can never overlap
- Z-index contract written into `globals.css` — every fixed surface sits on a named layer
- QA gate extended to overflow, console errors, broken images, wrong SKU↔photo pairing,
  44px touch targets and floating-layer collisions

**Build 02 — English and Kiswahili**
- English at `/`, Kiswahili at `/sw/`, each with its own root layout and correct `<html lang>`
- 211 translated keys, first-visit chooser, remembered preference, EN/SW switcher
- Switching keeps the page, the query string and the cart
- Locale-aware canonical and hreflang (`en`, `sw-TZ`, `x-default`) on every page
- `npm run i18n:check` enforces key, placeholder and array parity

**Build 03 — real photography**
- Approved photographs throughout: homepage, best sellers, category rails, Shop All,
  product detail, size chooser, cart drawer, cart page and related products
- Square `object-contain` presentation with fixed dimensions — no distortion, no cropping,
  no layout shift
- The fake bottle/jerrycan SVG illustrations are deleted

**Verified**
`typecheck` · `lint` · `i18n:check` · `catalogue:check` · `build` (205 pages) ·
`qa:screenshots` — 70 screenshots at 390 / 430 / 768 / 1024 / 1440 in both languages, all
behavioural checks passing.

## Deliberately not done

Supabase (not started — no resources, no connection), the order backend, payments,
customer accounts, the analytics pipeline, Google Sheet synchronisation and any Vercel
deployment.

The admin dashboard exists as a **mock-data prototype only**. Nothing in it writes anywhere.

## Recovery Build B — admin prototype recovered — 2026-09-08

The Build 04 admin prototype was recovered from the previous laptop
(`archive/old-laptop-pre-supabase`, tag `old-laptop-pre-supabase`, commit `b96c758`) and
ported onto this Supabase baseline. Only the admin frontend and its UX documentation were
brought across; the old Firebase-era planning and backend documentation was deliberately
left behind.

**What came across**
- Ten screens at `/admin` in their own root layout: Home, Orders, Order detail, Products,
  Product editor, Customers, Customer detail, More, Delivery zones, Website — plus Reports,
  Staff and Settings placeholders that explain what will be there
- Five-item bottom navigation on phones, identical sidebar from `lg` up
- One obvious next action per order stage; internal stage names never shown
- Cancellation requires a reason; delivery failure asks "Were the items returned?" with **no
  default** and states each choice's stock consequence; completion is gated on recording the
  payment, and a digital payment requires a transaction reference
- Products run on the real 95-product shelf. SKU locked, no delete control anywhere, stock
  changed by adding or counting rather than by typing over a number
- New delivery zones default to TSh 4,000; Free delivery visibly disables the fee
- Website edits named slots only, bilingual EN/SW, no page builder
- Owner / Manager / Order staff capability matrix that the screens already consult

**Adapted for this baseline**
- Backend references reworded from Firebase to Supabase (Row Level Security as the real
  authorization boundary; a server action writing Supabase as the real save)
- Layering moved onto this repository's floating-layer contract — admin top bar z-40,
  bottom navigation z-50, sheets and toasts z-60 — instead of the old CSS variables
- The mock product wrapper matches this catalogue's `Product` type, and the Home screen's
  "Missing image" count is now the **real** number of withheld master rows rather than a
  hard-coded one
- `qa:screenshots` gained an admin pass over all ten screens

## UI refinement patch — 2026-09-08

The last local UI work before the backend build. Three specific refinements on top of the
approved storefront and admin; nothing was redesigned.

**Desktop shelf density**
- The product shelf now runs 2 / 3 / 4 / **5** columns at `< 768` / `>= 768` / `>= 1024` /
  `>= 1280`, matching the reference's five-across desktop row
- The fifth column starts at 1280px rather than 1024px: at 1280 a five-across card is
  ~227px, the same card the four-across laptop layout already ships, where at 1024 it
  would fall to ~176px and squeeze the name, pack size and price row
- Homepage shelves are handed enough products to fill the widest row — 10 best sellers,
  5 per category rail, 5 related products — and trim their own tail at narrower column
  counts, so a shelf always ends on a complete row instead of one orphan card
- Shop All deliberately does not trim: a part-full last row there is where the catalogue
  ends
- Card proportions, gaps, image area, price prominence and the add button are unchanged

**English / Kiswahili layout stability**
- Persistent controls reserve the width of their **longest** translation instead of
  fitting the one on screen, so the interface skeleton stays locked while the text changes
- `StableText` renders every locale's version of a label into one grid cell and hides all
  but the current one with `visibility: hidden` — the browser measures the real strings in
  the real font, so there are no magic widths to go stale and a third language would be
  reserved for automatically
- Reserved: the four desktop nav slots, the cart label, the shop "All" chip, the sort menu
  and the two hero actions. The header logo, search field, language control and cart button
  are now pixel-identical in both languages
- No font was shrunk and no copy was truncated

**WhatsApp**
- One canonical mark, `src/components/ui/WhatsAppIcon.tsx`, used by the storefront support
  button, mobile menu, footer, contact and track-order pages, and the admin's "WhatsApp
  customer" actions
- The admin's malformed icon was `Icon.tsx`'s `whatsapp` entry — a filled brand mark traced
  with that set's 2px unfilled stroke, which drew the glyph's silhouette as a scribble.
  That entry is deleted, not repaired, so the wrong thing is unreachable rather than merely
  discouraged
- Admin action buttons carry the mark at 20px; icon-only controls keep their 44px target

**QA gate extended**
- The rendered column count is asserted at every QA width, and a fixed-length shelf that
  ends in a part-full row fails
- New **locale layout-stability pass**: home, Shop All and product are loaded in both
  languages at 390 / 430 / 768 / 1024 / 1440 and the boxes of every `data-qa-anchor`
  control are compared. Horizontal position and width must match within 2px everywhere;
  vertical position must match inside the header too. Translated text is free to be a
  different width — the slot around it is not

**Verified**
`typecheck` · `lint` · `i18n:check` · `catalogue:check` · `build` (325 pages) ·
`qa:screenshots` — 120 screenshots, all 15 locale-stability comparisons stable, no
overflow, console errors, broken images, small touch targets or floating-layer collisions.

## Next

- Confirm the open business rules (delivery fee, free-delivery threshold, served areas,
  retail prices, cut-off time)
- Confirm the `EP01-A01` price and add a master row for `EP23-A02`
- Provide the real Jojo Usafi WhatsApp number, phone, email and logo
- Then: Supabase schema, RLS, migrations, the order backend, and the validated two-way
  Google Sheet ↔ Supabase synchronisation

Claude must update this file after meaningful milestones.
