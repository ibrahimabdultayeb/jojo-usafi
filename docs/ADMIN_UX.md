# Admin UX

The Jojo Usafi admin is used by people running a shop, on a phone, often while
doing something else. It is built for that, not for developers.

**This is a frontend prototype.** Products, prices, item codes and photos are real
— they come from the Product Master. Orders, customers, delivery zones and
website content are invented, and every screen showing them says so. Nothing is
saved anywhere; there is no backend.

Open it at **`/admin`**.

## Principles

1. **One obvious next action.** Never a status dropdown, never a menu of verbs.
2. **No system vocabulary.** No raw status values, no table names, no internal
   IDs, no SQL words, no sync internals. The QA gate fails the build if any of
   them appear as visible text.
3. **Mobile first.** Cards, not tables. A bottom navigation bar where the thumb
   already is. Every control at least 44×44px.
4. **Hard to misuse.** The dangerous paths — completing without payment,
   cancelling without a reason, answering the returned-items question by
   accident — are closed by the interface, not by training.
5. **Say when data is fake.** A sample order must never be mistaken for a real one.

## Screens

| Route | What it is for |
| --- | --- |
| `/admin` | Attention dashboard — what needs me now |
| `/admin/orders` | All orders, filtered and searchable |
| `/admin/orders/[id]` | One order: customer, delivery, items, money, next action |
| `/admin/products` | The catalogue, with the states that need fixing |
| `/admin/products/[sku]` | Product editor — everyday things first |
| `/admin/customers` | Who has ordered |
| `/admin/customers/[id]` | One customer and their order history |
| `/admin/more` | The rest of the admin |
| `/admin/delivery-zones` | Where you deliver and what it costs |
| `/admin/website` | Homepage words, banners and section visibility |
| `/admin/reports` | Placeholder — waiting for real orders |
| `/admin/staff` | Placeholder — waiting for sign-in |
| `/admin/settings` | Shop details, plus the role preview switch |

Navigation is **Home · Orders · Products · Customers · More** on phones, and the
same destinations in a sidebar on desktop. Nothing exists on one and not the
other.

## The order workflow

Staff never choose a status. They see where the order is, in words, and one
button naming what to do:

| Where it is | The one button |
| --- | --- |
| New order | **Confirm Order** |
| Awaiting confirmation | **Confirm Order** |
| Confirmed | **Start Preparing** |
| Preparing | **Send Out for Delivery** |
| Out for delivery | **Complete Order** |
| Completed / Cancelled / Delivery failed | *nothing — the order is finished* |

`src/lib/admin/orders.ts` is the only place this lives, so the rule cannot drift
between screens.

### The payment gate

**An order cannot be completed until a payment is recorded.** Tapping *Complete
Order* opens a dialog that asks how the customer actually paid:

- **Cash** — enough on its own.
- **Digital** — a transaction reference is **required**; the complete button
  stays disabled without one.

The customer's stated preference is shown for context, but what is recorded is
what actually happened. The two are stored separately.

### Cancelling

A quiet secondary action, never styled to compete with the primary one. It
requires a reason from a fixed list: customer changed mind, customer unreachable,
out of stock, outside delivery area, duplicate order, pricing error, suspected
fraud, other.

### Failed delivery

Marking a delivery failed asks one question:

> **Were the items returned to the shop?**  Yes / No

**Neither answer is preselected, and the two buttons are styled identically.**
The QA gate asserts both of these on every run. The future backend uses this
answer to decide whether stock goes back on the shelf, so a default would
silently corrupt inventory.

## Products

The admin sees **all 201 master rows**, not just the 95 that are publishable —
the 106 without an approved photo are exactly the ones needing attention.

Surfaced states: **Low stock · Out of stock · Not on the website · No photo ·
Sync issue**. Search covers name, item code, barcode and brand.

### The editor

Everyday controls first: price, offer price, available stock, show on the
website, featured, best seller. Everything else is behind *More product details*.

- **The item code is shown and locked.** Orders already reference it. It is never
  an editable field anywhere in the admin.
- **Stock is never a free-text overwrite.** Two actions instead:
  - **Add Stock** — new stock arrived, added to what is there.
  - **Count Stock** — this is what was on the shelf, replacing the figure.
- **No delete.** Products are **Active**, **Hidden** or **Archived**, so history
  and past orders keep their meaning.

## Delivery zones

Each zone card shows its name, its fee (or FREE), and whether it is in use. When
**Free delivery** is on, the fee box is **disabled** and the card reads FREE, so
nobody has to work out which of two numbers wins. New zones start at TSh 4,000.

The sample zones are not agreed pricing — the real list is Ibrahim's decision.

## Website

A short list of named things, never a page builder and never HTML:
announcement bar, homepage hero, promotional banner, featured products, best
sellers, category order, and a visibility switch per homepage section.

Every customer-facing string is edited in **both English and Kiswahili**, because
the storefront ships both and a half-translated homepage is worse than an
untranslated one.

## Roles

`src/lib/admin/permissions.ts` defines **Owner**, **Manager** and **Order Staff**
and a single `can(role, capability)` check. Screens ask it before offering an
action, so a role never sees a button that would fail.

**There is no authentication.** The role switch in Settings is a prototype
control that protects nothing; it exists so the permission-aware structure can be
seen working. The real boundary will be Row Level Security in the database.

## Sync states

**Saved · Syncing… · Sync pending · Sync issue** appear where they will be
meaningful. Nothing synchronises anywhere in this build. Saving in the product
editor deliberately lands on *Sync pending* rather than *Saved*, so the screen
never claims a change reached the Google Sheet.

## Global search

One box in the header. It currently routes to the screen most likely to hold the
answer, because there is nothing to search. The shape is what matters: staff
never have to know which screen a thing lives on. A real search over order
numbers, customers, phone numbers, products, item codes and barcodes replaces the
routing without moving the box.

---

# Backend constraints this UX implies

The admin is a specification for the database as much as a prototype. Building
Supabase without these would mean rebuilding these screens.

### Orders

- Order status is a **fixed set** with a **defined progression**. The next action
  is derived from status; the database must reject illegal jumps rather than
  trusting the client.
- **Payment preference and recorded payment are two different columns.** What the
  customer said is not what happened.
- `completed` must be **unreachable without a recorded payment**, and a digital
  payment must be **unreachable without a reference**. This has to be a database
  constraint, not only a form rule — the UI is the convenience, not the guarantee.
- Cancellation stores a **reason from a fixed list**.
- A failed delivery stores **items returned: true / false / not answered**. It is
  genuinely three-valued; "not answered" is not "no", and inventory must not move
  until it is answered.
- Every stage transition is an **event with a time and an actor**, not a mutated
  field. The timeline is read from those events.

### Inventory

- Stock changes must be recorded as **typed movements**, not overwrites, because
  the UI already distinguishes them:
  - receipt / addition (*Add Stock*)
  - physical count correction (*Count Stock*)
  - sale and reservation effects (from orders)
  - restoration after a returned failed delivery
  - manual adjustment
- Available stock is then **derived** from those movements. Reports and audits are
  impossible if the admin overwrites a single number.

### Products

- **SKU is immutable.** Nothing in the schema may allow a rewrite once an order
  references it.
- Products are **never deleted** — Active / Hidden / Archived. Foreign keys from
  order lines must always resolve.
- Publishability is **derived from data**, not set by hand: an approved photo, a
  plausible price, an active status. The rules already live in
  `scripts/build-catalogue.mjs` and must move into the sync layer so a bad row is
  caught before it is written.

### Roles

- `can(role, capability)` maps to **Row Level Security policies**. The front-end
  check is an affordance; the database is the boundary. Both must agree, and the
  database must be right even when the client is wrong.

### Sync

- Every record needs enough state to show **Saved / Syncing / Pending / Issue**
  honestly — a sync status, a last-synced marker and a way to surface the failure.
- The Google Sheet ↔ Supabase sync must be **loop-safe, ordered and audited**, and
  must reject invalid values rather than importing them, because the admin shows
  operators a sync issue and they will expect it to mean something.

### Content

- Customer-facing content is **localised per field** (English and Kiswahili), not
  per page.
- Catalogue content is English-only today; the admin does not pretend otherwise.
  A translations table can carry Kiswahili product copy when it exists.
