# Jojo Usafi — Admin UX

A working prototype on **mock data**. No backend of any kind: no Supabase, no Google Sheet, no
writes. The point was to settle how the dashboard *works* before it is wired to anything, so
the backend work has a fixed target.

Originally built on the previous laptop and recovered onto the Supabase baseline. The
implementation is backend-agnostic — it always was — so the recovery was a port of the
frontend plus a rewording of the few backend-facing notes.

**Everything below is a decision the backend implementation must respect.**

---

## 1. Where it lives

| | |
| --- | --- |
| Routes | `/admin/**` |
| Language | English-first |
| Layout | its own root layout in `src/app/(admin)/`, alongside `src/app/(en)` and `src/app/(sw)` |
| Indexing | `robots: { index: false }` |

The storefront and the admin are separate root layouts in one Next application. They share
fonts, the brand palette and the floating-layer contract, and nothing else — the admin never
loads storefront chrome, and the storefront never loads admin code.

There is no middleware to change: the storefront serves English at `/` and Kiswahili at
`/sw/` through route groups, so `/admin` is simply a third group.

---

## 2. Information architecture

**Mobile bottom navigation** — five destinations, thumb height, safe-area aware:

```
Home    Orders    Products    Customers    More
```

**Desktop** uses a left sidebar with the identical five. Nothing exists only on desktop.

Under **More**: Delivery zones · Website · Reports* · Staff* · Settings*
(*placeholders that explain what will be there, rather than empty pages).

---

## 3. Principles the backend must not undo

### One obvious next action

An order screen shows a single large primary button labelled with the **action**, never a
status dropdown:

| Stage | Button |
| --- | --- |
| New / Awaiting confirmation | Confirm order |
| Confirmed | Start preparing |
| Preparing | Send out for delivery |
| Out for delivery | Complete order |

Terminal stages show no action at all, and say so. Internal stage strings
(`out_for_delivery`) never appear on screen — `STAGE_LABEL` maps every one to plain language.

### Exceptions are visibly secondary

Cancel and Delivery failed live behind a collapsed "Something went wrong with this order".
Both **require a reason** before they will complete, and *Other* additionally requires a note.

### The returned-items question has no default

Marking a delivery failed asks **"Were the items returned to the shop?"** with two equally
weighted buttons, neither preselected, each stating its stock consequence ("Stock goes back" /
"Stock written off"). Guessing this wrong silently loses or invents inventory, so the operator
must answer it.

### Completion is gated on payment

Choosing "Complete order" opens the payment sheet first. Method is Cash or Digital, and
**Digital requires a transaction reference** before the button enables. An order cannot be
completed without recording what was actually collected.

### Stock is an action, not a text box

The product editor has **Add stock** and **Set counted stock**, never an editable stock
number. Each becomes an entry in the stock ledger once that exists, which is what makes a
mistyped count traceable. A free-text box has no intent attached to it — a number that changed
from 40 to 4 could be a correction, a sale or a typo, and the ledger could not tell them apart.

### No delete, anywhere

There is no delete control on any screen. Products are hidden or archived; orders and
customers are never removed. The editor says so in plain words.

### Minimal typing

Reasons, payment methods, filters and the returned-items answer are all taps. The only free
text is a note, a price, a stock count and a zone name.

---

## 4. Screens

| Screen | What it does |
| --- | --- |
| **Home** | Attention cards first (counts, tappable straight to the filtered list), then today's sales/orders/average, then recent orders and activity. A single "All clear" line collapses everything at zero, so the screen shrinks on a good day. |
| **Orders** | Cards on phones, never a table. Order number, customer, short phone, zone, total, item count, friendly status, Open order. Filters: All · New · Confirm · Preparing · Delivery · Completed · Problems, each with a live count. Search by order number, name or phone. |
| **Order detail** | Next action at the top, then customer with WhatsApp and Call as full-width buttons, delivery, items, totals, payment (preference vs actually received), and a timeline of what has happened. |
| **Products** | Rows with photo, name, brand, size, SKU, price and stock. Badges: Low stock · Out of stock · Hidden · Missing image · Sync issue. Filters include "Needs attention". Search covers name, SKU, barcode and brand. |
| **Product editor** | Six everyday controls above the fold — price, offer price, stock, show on website, featured, best seller. Everything else is folded into "More product details". SKU is shown locked with the reason. |
| **Customers** | List with name, phone, order count, total spend, last order. Detail adds addresses, order history and WhatsApp/Call. Deliberately not a CRM. |
| **Delivery zones** | Zone cards with fee or Free delivery, active state and display order. New zones default to **TSh 4,000**. Turning on Free delivery **visibly disables** the fee field rather than hiding it, so it is obvious the fee is ignored rather than lost. |
| **Website** | Named slots only, no page builder: announcement bar, homepage banner, promotion banner, and which homepage sections show and in what order. Every customer-facing field is bilingual with an EN/SW tab; an empty Kiswahili field is marked with a dot and says it will fall back to English. |

---

## 5. What is real and what is mock

**Real**, straight from the generated catalogue: every product's SKU, name, brand, size,
price and photograph, and the count of products the pipeline withheld for having no approved
photograph.

**Mock**, and only in `src/mocks/admin/data.ts`: orders, customers, delivery zones, today's
figures, activity, and each product's stock, visibility, offer price and sync state. The
Product Master has no columns for those, and inventing them in the catalogue would be
inventing business data.

---

## 6. Roles, prepared but not enforced

`src/lib/admin/permissions.ts` holds the capability matrix for **Owner**, **Manager** and
**Order staff**. The prototype signs in as Owner.

Screens already ask `can(role, capability)` before rendering an action, and the More menu
filters its own entries. When real authentication arrives, an Order staff account sees a
shorter menu and fewer buttons **without any screen being redesigned**.

**The UI hiding a control is never the security boundary.** The real boundary will be
Supabase Row Level Security plus a check in every server action, enforcing this same matrix.

---

## 7. Mock save states

Editors show **Saved → Sync pending** after a change, to establish the vocabulary before the
real sync exists. A real save will be a server action that writes Supabase, queues the Sheet
write-back, revalidates the storefront and records who changed what.

Nothing in this build writes anything, and every editor says so.

---

## 8. WhatsApp

The "WhatsApp customer" actions on the order and customer screens use the one canonical
mark, `src/components/ui/WhatsAppIcon.tsx`, shared with the storefront.

They were drawing `Icon.tsx`'s `whatsapp` entry, which the shared line-icon set rendered
with its 2px unfilled stroke — tracing the glyph's silhouette as a scribble rather than
filling it, which is why the buttons looked broken. That entry has been removed rather than
repaired: a brand mark is a filled shape and does not belong in a line-icon set.

They stay ordinary full-width actions inside the customer card. WhatsApp is a floating
button on the storefront because a shopper may want support at any moment; in the admin it
is one of the things you do to an order, and it sits with the others.

---

## 9. Layering

The admin reuses the floating-layer contract documented at the top of `src/app/globals.css`:
the sticky top bar on **z-40**, the bottom navigation on **z-50**, sheets and toasts on
**z-60**. No admin element invents a z-index.

---

## 10. Verified

`npm run qa:screenshots` audits all ten admin screens alongside the storefront at
390 / 430 / 768 / 1024 / 1440: no horizontal overflow, no console errors, no broken images, no
touch target under 44 × 44 px on touch viewports, no floating-layer collisions.
