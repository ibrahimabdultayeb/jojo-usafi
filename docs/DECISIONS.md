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

---

## 2026-09-08 — Firebase is replaced by Supabase

Decision:
Firebase (Firestore, Firebase Auth, Firebase Storage) is permanently unapproved for Jojo
Usafi. The approved backend direction is Supabase PostgreSQL, Supabase Auth, Supabase
Storage, Supabase Row Level Security and Supabase migrations, with Next.js on Vercel and a
validated two-way Google Sheet ↔ Supabase synchronization.

Reason:
Ibrahim's decision, given during the recovery of the project onto a replacement laptop.

Alternatives:
Stay on Firebase. Rejected by the project owner.

Impact:
Documentation-only during recovery. No Supabase work has started, no packages are
installed, no cloud resources exist and nothing in the application connects to a backend.
`docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/PROJECT_CONSTITUTION.md`,
`docs/BUSINESS_RULES.md`, `docs/TESTING_REQUIREMENTS.md` and the Claude permission
guardrails were rewritten to the Supabase direction. The catalogue query module stays the
single seam a real backend will occupy.

---

## 2026-09-08 — The catalogue is generated from the Product Master, not hand-written

Decision:
`scripts/build-catalogue.mjs` builds `src/lib/catalogue/generated/catalogue.json`, the
committed product photography in `public/products/`, and `docs/CATALOGUE_REPORT.md` from
`imports/jojo-usafi-product-master.csv` and `imports/white-bg-products/`. `imports/` is
source-only and git-ignored. The build is deterministic and `npm run catalogue:check`
fails if the committed output drifts from the sources.

Reason:
The catalogue is business data. Hand-maintaining it in TypeScript invites silent drift
from the master and makes the eventual Supabase seeding a rewrite rather than a port.

Alternatives:
Keep the hand-written prototype module. Rejected: its SKUs were synthetic (`EP-0001`),
which made exact SKU↔photo matching impossible.

Impact:
SKU is now the real identity key throughout. Editing the catalogue means editing the
master and rerunning the build, which is the same shape as the future Sheet → Supabase sync.

---

## 2026-09-08 — Withheld products stay in the data and out of the shop

Decision:
All 201 master rows are kept in the generated catalogue, each carrying `flags` and a
`publishable` boolean. `src/lib/catalogue/queries.ts` exposes only publishable rows to the
UI; `getAllProductRecords()` exposes the full set for validation only.

Reason:
Two different needs. Validation and future sync work need every row; a customer must never
see a product with no approved photograph or an implausible price.

Alternatives:
Drop non-publishable rows at build time. Rejected: it destroys the audit trail and hides
exactly the rows that need Ibrahim's attention.

Impact:
95 of 201 products are on the shelf. 106 are withheld for having no approved photograph.
`EP01-A01` is withheld for both a missing image and its TZS 128 price.

---

## 2026-09-08 — Flagged commercial data is reported, never corrected

Decision:
`EP01-A01` (Multix Multipurpose Detergent Lemon Fresh 20LT) is listed at TZS 128. It is
flagged `PRICE_IMPLAUSIBLE`, withheld from the storefront, and recorded in
`docs/CATALOGUE_REPORT.md`. The price has **not** been changed, and no correction has been
inferred from its sibling pack sizes.

Reason:
Selling prices are a business decision. Ibrahim explicitly instructed that inferring
128 → 128,000 would be guessing commercial data.

Alternatives:
Infer the intended price from the 5LT and 750ML rows. Explicitly rejected by Ibrahim.

Impact:
One bad row withholds one product and does not block the other 200. The detection rule is
generic — any price below TZS 1,000 is flagged — rather than a hard-coded SKU.

---

## 2026-09-08 — Approved images with no master row are reported, not invented

Decision:
`EP23-A02` (Spirix Methylated Spirit 5L) has an approved photograph and no row in the
Product Master. It is listed in `docs/CATALOGUE_REPORT.md` as an orphan image, no product
is created for it, and no asset is written for it.

Reason:
Creating a product would mean inventing its price, stock, category and identity.

Alternatives:
Create a placeholder product. Rejected: it would put invented commercial data in front of
customers.

Impact:
The Product Master needs a row for `EP23-A02` before it can sell.

---

## 2026-09-08 — English is unprefixed, Kiswahili is prefixed, each with its own root layout

Decision:
English lives at `/` and Kiswahili at `/sw/`. `src/app/(en)` and `src/app/(sw)` are
separate Next.js root layouts, both rendering the shared `StorefrontLayout`; every route
file is a thin wrapper around a shared view in `src/views/`.

Reason:
`<html lang>` has to be correct in the static HTML for screen readers and search engines.
Reading the locale from a request header would make every page dynamic and lose the static
prerendering of 95 products per language; correcting `lang` after hydration would ship the
wrong value in the HTML.

Alternatives:
A `[locale]` segment (would prefix English too), or middleware plus `headers()` (kills
static rendering). Both rejected.

Impact:
205 pages prerender. Crossing between languages is a full page load, which is the accepted
trade-off for multiple root layouts; the cart survives it because it lives in
`localStorage` keyed by SKU.

---

## 2026-09-08 — Catalogue content is not translated

Decision:
Interface copy is translated into Kiswahili. Product names, brand names, pack sizes,
category names and product descriptions stay in English on both sides of the site.

Reason:
That content is owned by the Product Master, which holds English only. Translating it in
the front end would be inventing catalogue data — and 200 of 201 rows have no description
to translate in the first place.

Alternatives:
Machine-translate product copy. Rejected: it fabricates catalogue content.

Impact:
Kiswahili pages read as Kiswahili UI over an English catalogue, which is the honest state
until the database carries Kiswahili product content.

---

## 2026-09-08 — Product images are pre-processed and served unoptimised

Decision:
`build-catalogue.mjs` writes 800px white-flattened WebP files to `public/products/`, and
`next.config.ts` sets `images.unoptimized`.

Reason:
The assets are already square, right-sized and deterministic, so the built-in optimiser
would re-encode them at request time for no gain and add a runtime dependency. 95 photos
total 2.6 MB, which matters on Tanzanian mobile data.

Alternatives:
Ship the 26.6 MB source PNGs, or optimise at request time. Both rejected.

Impact:
Committed, reproducible assets. `ProductPhoto` still supplies width, height and `sizes`,
so there is no layout shift and images below the fold stay lazy.

---

## 2026-09-08 — The admin is its own root layout at /admin

Decision:
The admin lives under `src/app/(admin)/admin/…` with its own Next.js root layout,
alongside the two storefront root layouts. It is English-first, marked
`noindex, nofollow`, and carries none of the shop chrome.

Reason:
The admin shares nothing with the storefront frame — no announcement bar, no
cart, no language chooser, no WhatsApp support button. Sharing a layout would
mean stripping those out by condition on every render, and one missed condition
would put a customer control in front of staff.

Alternatives:
Put the admin inside the English storefront layout and hide the chrome. Rejected:
the hiding logic is the bug surface.

Impact:
Three root layouts. Crossing from the shop to the admin is a full page load,
which is correct for what is really a different application.

---

## 2026-09-08 — Staff never see an order status; they see one next action

Decision:
There is no status dropdown anywhere in the admin, and no raw status value is
ever rendered. `src/lib/admin/orders.ts` maps each status to plain language and
to exactly one next action, and every screen reads from it.

Reason:
A dropdown asks a member of staff to know the workflow. A single button named
for what it does asks them only to know what just happened in the real world.

Alternatives:
A status select, as most admin templates ship. Rejected by the project owner and
by the design principle.

Impact:
The QA gate fails the build if an internal value such as `out_for_delivery`
appears as visible text. The database must own the legal transitions, because the
UI no longer offers a way to express an illegal one.

---

## 2026-09-08 — Completing an order requires a recorded payment

Decision:
*Complete Order* opens a payment dialog. Cash is enough on its own; digital
requires a transaction reference before the confirm button enables. The customer's
stated preference and the payment actually recorded are separate fields.

Reason:
An order marked delivered with no money recorded is the single most expensive
mistake a small shop can make, and the hardest to reconstruct later.

Alternatives:
Record payment separately, after completion. Rejected: it makes the gap possible.

Impact:
`completed` must be unreachable in the database without a payment row, and a
digital payment unreachable without a reference. The UI is the convenience; the
constraint has to be in Postgres.

---

## 2026-09-08 — "Were the items returned?" has no default

Decision:
After marking a delivery failed, the returned-items question offers Yes and No
with neither preselected and both styled identically. Nothing can be saved until
one is chosen. The stored value is three-valued: yes, no, or not yet answered.

Reason:
The future backend uses this answer to decide whether stock returns to the shelf.
A default would be answered by accident and would silently corrupt inventory.

Alternatives:
Default to "Yes", which is the common case. Explicitly rejected.

Impact:
Inventory must not move on a failed delivery until the question is answered, and
"not answered" must be representable in the schema.

---

## 2026-09-08 — Stock is recorded as events, never overwritten

Decision:
The product editor has no editable stock box. It has *Add Stock* (what arrived)
and *Count Stock* (what was on the shelf), which are different facts.

Reason:
Overwriting a single number destroys the difference between a delivery arriving
and a count correcting an error, and makes shrinkage impossible to see.

Alternatives:
A plain number input. Rejected: it is the reason small-shop inventory data is
usually worthless.

Impact:
Supabase needs typed inventory movements — receipt, count correction, sale,
reservation, restoration, manual adjustment — with available stock derived from
them, not stored as a mutable column.

---

## 2026-09-08 — No delete in the admin; SKU is immutable

Decision:
There is no delete control anywhere. Products are Active, Hidden or Archived. The
item code is displayed prominently and is never an editable field.

Reason:
Order lines reference products by SKU. Deleting a product or rewriting a code
would rewrite history that customers and accounts depend on.

Alternatives:
A delete with a confirmation dialog. Rejected: confirmation does not make data
loss recoverable.

Impact:
The QA gate fails on any control labelled delete or destroy, and asserts that no
editable field holds the SKU.

---

## 2026-09-08 — Permission structure now, authentication later

Decision:
`can(role, capability)` and a `RoleProvider` exist and every screen already asks
before offering an action. There is no authentication, and the role switch in
Settings is a labelled prototype control.

Reason:
Retrofitting permission checks across finished screens is where permission bugs
come from. The shape is cheap now and the answer changes in one place later.

Alternatives:
Add permissions when Supabase Auth lands. Rejected.

Impact:
These checks protect nothing today and the code says so. Row Level Security will
be the real boundary; the capability list is the specification for those policies.

---

## 2026-09-08 — Admin mock data is invented; admin product data is real

Decision:
Orders, customers, delivery zones and website content are invented mock modules.
Products, prices, item codes, barcodes and photos come from the real recovered
catalogue. Stock for six named SKUs is overridden by a clearly isolated demo
overlay so low and out-of-stock states are reachable.

Reason:
The admin has to be judged against the real shelf, and the real master has healthy
stock almost everywhere, so those states would otherwise be invisible. Mixing the
override into the catalogue would corrupt the one source of truth.

Alternatives:
Edit stock values in the Product Master. Explicitly forbidden — the CSV is
source-only and read-only.

Impact:
`src/lib/admin/mock/inventory.ts` is one small module that is deleted outright
when real inventory lands. Every screen showing invented data carries a visible
notice.

---

## 2026-09-08 — Admin copy is English-first with a localisation seam

Decision:
The admin ships English only. `src/lib/admin/copy.ts` holds the repeated
vocabulary — navigation, actions, shared labels — behind `getAdminCopy(locale)`,
typed so a second dictionary is additive. Longer screen prose is still inline.

Reason:
Staff are a small known group and the storefront was the bilingual requirement.
Fully externalising every admin sentence now would double the work of a prototype
whose wording will change once it is used.

Alternatives:
Translate the admin now. Not requested. Or hard-code English with no seam.
Rejected: it is the version that makes localisation expensive later.

Impact:
`npm run i18n:check` covers the storefront dictionaries only; the admin is
deliberately outside it until a Kiswahili admin dictionary exists.
