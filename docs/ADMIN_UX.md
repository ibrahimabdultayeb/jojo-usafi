# Jojo Usafi — Admin UX

A working dashboard on the **real development database**. Since Build 08C every operational
screen reads Supabase and every control writes it: orders are worked, prices change, stock
moves through the ledger and delivery areas are edited. The design below was settled first,
as a prototype on mock data, so the backend work had a fixed target — and **no screen was
redesigned when the data became real**.

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
number. Each writes an entry to the stock ledger, which is what makes a mistyped count
traceable. A free-text box has no intent attached to it — a number that changed from 40 to 4
could be a correction, a sale or a typo, and the ledger could not tell them apart.

Since Build 08C both are real. **Add stock** writes a `receipt` and takes an optional delivery
note or invoice number. **Set counted stock** writes an `adjustment` for the **difference**,
never the total, and must say why: four reasons offered as buttons, plus an optional note. A
count that matches writes nothing and says so rather than pretending to have done work.

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
| **Order detail** | Next action at the top, then **Change what is in this order** as a secondary action while the order is still in the shop, then customer with WhatsApp and Call as full-width buttons, delivery, items, totals, payment (preference vs actually received), and a timeline of what has happened. |
| **Amend order** | A sheet: one row per item with minus, the number, plus and remove, and a search to add another product. Before saving it says in words what is changing — "Multix 5LT: 2 → 3", "Handwash removed" — and shows the new total as an **estimate**, because the shop works out the real figure. A reason is required. Once the order is out for delivery the control is gone and a line says why. |
| **Products** | Rows with photo, name, brand, size, SKU, price and stock. Badges: Low stock · Out of stock · Hidden · Missing image. Stock is **available** stock — what can actually be sold — so the list agrees with the storefront and the home counts. Filters include "Needs attention". Search covers name, SKU, barcode and brand. |
| **Product editor** | Six everyday controls above the fold — price, offer price, stock, show on website, featured, best seller. Everything else is folded into "More product details", read-only until the Sheet sync exists. SKU is shown locked with the reason. Archiving also takes the product off the website, and is reversible; there is no delete. |
| **Customers** | List with name, phone, order count, total spend, last order. Detail adds addresses, order history and WhatsApp/Call. Deliberately not a CRM. |
| **Delivery zones** | Zone cards with fee or Free delivery, active state and display order. New zones default to **TSh 4,000**. Development placeholders are badged "Example area — replace" rather than passed off as real. Turning on Free delivery **visibly disables** the fee field rather than hiding it, so it is obvious the fee is ignored rather than lost. |
| **Website** | Named slots only, no page builder: announcement strip, hero, promotion band, and which homepage sections appear. Every customer-facing field is bilingual — English and Kiswahili **side by side**, not behind a tab, because an empty translation is invisible behind a tab and obvious beside its English. A field left empty in both shows the wording the site was designed with; turning something off is always a switch. |
| **Settings** | The shop’s own WhatsApp number, phone, email and address, and how long an unconfirmed order holds stock. Every one starts empty and says "Not set yet" — a placeholder number that reaches nobody is worse than a visibly missing one. Badges at the top list what is still needed before the shop opens, computed from what the database holds. |
| **Staff** | Owner only, and it says so to anyone else rather than showing controls that will all be refused. Add someone by email; Supabase sends the invitation and owns the password, which this screen never sees. The last active Owner and your own account are drawn **without controls** — the database refuses both regardless, and offering a button that will be refused is a trap rather than a rule. |

---

## 5. What is real and what is mock

**Real, since Build 08C — everything operational.** Orders, the order timeline, customers and
their history, delivery zones, today's sales, the attention counts, the activity feed, and
every product's price, offer, stock, visibility and photograph. All of it comes from the
development Supabase project, read under the caller's own Row Level Security, and every
control writes it.

**Nothing is mock, since Build 10.** The Website, Settings and Staff screens were the last
three reading invented data; they now read `shop_settings` and `admin_profiles`, and
`src/mocks/` was deleted rather than emptied. Only **Reports** is still "Coming soon", and it
says why: there are no real orders yet to report on.

The invented orders, customers, zones, sales figures and activity are **deleted**, not kept
behind a flag. A dashboard that can fall back to plausible fiction is a dashboard that can
quietly show fiction; an empty database now produces an empty screen with a sentence
explaining it. The shared vocabulary that used to live beside them — stage labels, the next
action per stage, the cancellation reasons, the `AdminOrder` shape — moved to
`src/lib/admin/model.ts`, which was never mock.

---

## 6. Roles — enforced

`src/lib/admin/permissions.ts` holds the capability matrix for **Owner**, **Manager** and
**Order staff**, and it is now read by both halves of the dashboard:

- the screens ask `can(role, capability)` before rendering an action, and the More menu
  filters its own entries;
- `src/lib/admin/authorize.ts` asks the *same* matrix before any server action runs.

One table, so a button that is drawn and an operation that is permitted cannot drift apart.
The role comes from the signed-in staff member's `admin_profiles` row, not from a constant.

**The UI hiding a control is still never the security boundary.** Row Level Security is, and
`tests/db/09-admin-operations.test.ts` proves it with real signed-in tokens: an Order staff
member's price change updates zero rows, their stock call is refused by the function itself,
and a Manager promoting themselves to Owner changes nothing. Neither can rewrite what an
order sold for — that request dies on the column grant, before any policy is consulted.

---

## 7. Save states — honest

Editors show **Saving… → Saved**, and **Not saved** with the database's own sentence when
something is refused. There is no "Synced" badge and no "Sync pending": no Google Sheet
write-back exists, so the product editor says, separately and in plain words, *"Saved
straight to the shop, and the website updates immediately. Product sheet sync: not connected
yet."*

Saving a product invalidates the storefront's five-minute catalogue cache, so a price change
reaches a shopper immediately rather than waiting it out.

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

`npm run qa:screenshots` audits the admin alongside the storefront at
390 / 430 / 768 / 1024 / 1440: no horizontal overflow, no console errors, no broken images, no
touch target under 44 × 44 px on touch viewports, no floating-layer collisions.

Since Build 08C it signs in as the development QA Manager (`npm run qa:staff create`) and
audits the screens behind the guard — Home, Orders, an order, Products, the Product editor,
Customers, More and Delivery Zones — plus the dialogs, which only exist after a click and are
where a phone-sized dashboard usually goes wrong: Add stock, Set counted stock, Cancel order,
Delivery failed, Record the payment and the zone editor. A signed-in staff member being
bounced to `/admin/sign-in` fails the gate, and so does an order that will not open.

It then signs in as the development **Order staff** account and checks that the smaller role
really does see less: no Delivery zones, Website, Reports, Staff or Settings in the More
menu, no editable price field, no stock buttons.

The database side is proved separately by `tests/db/09-admin-operations.test.ts` — 24 tests
run as real signed-in staff tokens — and the price-to-shop path by
`npm run verify:cache`, which changes a price in the editor and reads the product page as a
signed-out shopper to prove the storefront's five-minute cache was actually invalidated.
