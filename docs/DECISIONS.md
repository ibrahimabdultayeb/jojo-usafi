# Decision Log

Record material business and architecture decisions here.

Format:

## YYYY-MM-DD — Decision

Decision:

Reason:

Alternatives:

Impact:

---

## 2026-09-07 — Ordering happens on the site; WhatsApp is support only

Decision:
The storefront places orders through its own checkout. WhatsApp appears as a floating
support button and in the footer, never as the way to submit an order.

Reason:
The project constitution requires orders to exist in Firestore before any WhatsApp handoff,
and requires WhatsApp to be a communication channel rather than the system of record. The
EcoPlus reference does the opposite — its cart opens WhatsApp — so this is a deliberate
divergence from the visual reference.

Alternatives:
Reproduce the EcoPlus WhatsApp-first flow. Rejected: it would make WhatsApp the database.

Impact:
The prototype ships a checkout shell. The real checkout must write the order document first,
then optionally message the customer.

---

## 2026-09-07 — All catalogue reads go through one query module

Decision:
`src/lib/catalogue/queries.ts` is the only module the UI reads catalogue data through. It is
currently backed by `src/lib/catalogue/mock-data.ts`.

Reason:
It gives Firestore a single seam to replace later. No component imports catalogue data
directly, so swapping the data source is a data change rather than a UI rewrite.

Alternatives:
Import the mock data directly in components. Rejected: it spreads the migration across the
whole component tree.

Impact:
When Firestore lands, these functions become async reads and the components change from
`const x = getX()` to `const x = await getX()`.

---

## 2026-09-07 — The catalogue model is brand-neutral

Decision:
Brands, suppliers, categories, product families and pack sizes are all data. Nothing in the
types or components assumes cleaning products, EcoPlus, or EP-prefixed codes. The storefront
carries a "Brands we stock" section rather than a single-brand identity.

Reason:
The constitution requires that future unrelated brands not force an application rebuild.

Alternatives:
Model the catalogue around the EcoPlus range directly. Rejected: it hard-codes the current
supplier into the product.

Impact:
Adding an unrelated brand later means adding rows, not new types or new components.

---

## 2026-09-07 — Delivery pricing left unspecified in the prototype

Decision:
The prototype states "delivery calculated at checkout" and never shows a delivery fee, a
free-delivery threshold or a same-day cut-off time.

Reason:
These are business decisions for Ibrahim, and the constitution says to ask rather than
invent them. The EcoPlus reference advertises "FREE delivery over TSh 30,000" and a 2pm
same-day cut-off; neither is assumed to carry over to Jojo Usafi.

Alternatives:
Copy the EcoPlus numbers. Rejected: it would put unapproved commercial terms in front of
customers.

Impact:
Once decided, the copy lives in `src/lib/site.ts` and a delivery rule is added to the cart
and checkout summaries.

---

## 2026-09-07 — Header sticks instead of being fixed with a JS offset

Decision:
The announcement bar scrolls away and the header uses `position: sticky`.

Reason:
The reference uses `position: fixed` with a JavaScript-maintained `--banner-offset` custom
property. Sticky gives the same feel with no offset arithmetic and no first-paint layout
jump. `overflow-x: clip` is used on `body` instead of `hidden` so sticky keeps working.

Alternatives:
Reproduce the fixed-plus-offset approach. Rejected: more moving parts for no visible gain.

Impact:
None on appearance; less layout code to maintain.
