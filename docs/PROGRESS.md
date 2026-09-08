# Jojo Usafi Progress

## Current stage

Storefront prototype on the **real catalogue**, in **English and Kiswahili**, with
real product photography — plus a **mobile-first admin prototype** at `/admin`.
Frontend only: no backend, no cloud services connected.

## Completed

### Environment and foundation
- Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4
- Design system aligned to the EcoPlus reference (Inter + Space Grotesk, brand
  green scale, rounded-3xl cards, pill navigation, blurred sticky header)
- Git, GitHub, Vercel CLI, Playwright, UI UX Pro Max, Claude project rules

### Storefront visual prototype — 2026-09-07
The original approved prototype: homepage, catalogue, product detail, cart drawer
and cart page, checkout and track-order shells, contact, 404, and the Playwright
QA script.

### Recovery Build A — 2026-09-08
Rebuilt on a replacement laptop after Builds 01–04 were lost with the previous
machine.

- `scripts/build-catalogue.mjs` builds the shelf deterministically from the
  restored Product Master CSV and the approved photography
- 201 master rows, 96 approved images, **95 exact SKU matches**, 95 publishable
- 106 products withheld for having no approved photograph
- `EP01-A01` (TZS 128) flagged and withheld — **not corrected**
- `EP23-A02` Spirix reported as an orphan image — **not invented**
- Build 01: working hero control, repaired WhatsApp button, z-index contract
- Build 02: English at `/`, Kiswahili at `/sw/`, 211 keys, chooser, switcher,
  canonical + hreflang
- Build 03: approved photography throughout, no distortion or layout shift

### Recovery Build B — 2026-09-08
The admin prototype, rebuilt on top of the recovered catalogue. See
`docs/ADMIN_UX.md`.

**Shell and navigation**
- Its own root layout at `/admin`, `noindex`, carrying none of the shop chrome
- Bottom navigation on phones (Home · Orders · Products · Customers · More),
  the same destinations as a sidebar on desktop
- One search box in the header, shaped for the future global search

**Orders**
- Card list with filters (All · New · Confirm · Preparing · Delivery · Completed ·
  Issues) and search by order number, customer or phone
- Detail screen: customer with WhatsApp and Call, delivery, items, totals,
  payment and a stage timeline
- **One obvious next action** — never a status dropdown, and no raw status value
  is rendered anywhere
- **Payment gate**: an order cannot be completed until a payment is recorded, and
  a digital payment needs a transaction reference
- Cancellation requires a reason and stays visually secondary
- **Delivery failed** asks "Were the items returned?" with **no default** and two
  identically styled answers

**Products**
- All 201 master rows, using the real photos, prices, item codes and barcodes
- Surfaced states: low stock, out of stock, not on the website, no photo, sync issue
- Editor with everyday controls first; **item code shown and locked**
- Stock recorded through **Add Stock** and **Count Stock**, never overwritten
- Lifecycle Active / Hidden / Archived — **no delete anywhere**

**Customers, zones, website**
- Customer list and detail with totals derived from the orders, plus WhatsApp/Call
- Delivery zones with a free-delivery switch that disables the fee box
- Website screen editing announcements, hero, banner, featured, best sellers,
  category order and section visibility — in both languages, never HTML

**Structure for later**
- `can(role, capability)` with Owner / Manager / Order Staff, asked by every
  screen; no authentication, and the role switch is a labelled prototype control
- Sync states (Saved / Syncing / Pending / Issue) shown as UI states only

**Verified**
`typecheck` · `lint` · `i18n:check` · `catalogue:check` · `build` (440 pages) ·
`qa:screenshots` — **125 screenshots** at 390 / 430 / 768 / 1024 / 1440, storefront
in both languages plus 11 admin screens, all behavioural checks passing.

## Deliberately not done

Supabase (not started — no packages, no resources, no connection), the order
backend, payments, customer accounts, real inventory, Google Sheet
synchronisation, the analytics pipeline and any Vercel deployment.

## Next

- **The Supabase architecture pivot / Build 05.** `docs/ADMIN_UX.md` ends with the
  backend constraints the admin UX implies — typed inventory movements, a payment
  constraint on completion, three-valued returned-items, immutable SKUs, order
  events rather than mutated fields, and RLS matching the capability list.
- Confirm the open business rules in `PROTOTYPE_NOTES.md` §3 (delivery fee,
  free-delivery threshold, served areas, retail prices, cut-off time)
- Confirm the `EP01-A01` price and add a Product Master row for `EP23-A02`
- Provide the real delivery zones and their fees
- Provide the real Jojo Usafi WhatsApp number, phone, email and logo
- Photography for the 106 products that have none

Claude must update this file after meaningful milestones.
