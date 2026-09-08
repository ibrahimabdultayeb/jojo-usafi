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

## 2026-09-08 — Five product columns start at 1280px, not 1024px

Decision:
The product shelf runs 2 / 3 / 4 / 5 columns at `< 768` / `>= 768` / `>= 1024` / `>= 1280`.
The fifth column arrives at `xl`, not at `lg`.

Reason:
The EcoPlus reference shows five products per row on a wide desktop and Jojo Usafi was
showing four. The shell is capped at 1400px, so at 1280px a five-across card is ~227px —
the same card the four-across laptop layout already ships — while at 1024px it would be
~176px and would squeeze the product name, the pack size and the price row. Five columns
were the goal; five cramped columns were not.

Alternatives:
Five from `lg` (1024px). Rejected: it makes the card narrower than any card currently
approved. Reducing the card's internal padding or type to fit. Rejected: that is
redesigning the approved card rather than adding a column.

Impact:
`ProductGrid` gains an `xl:grid-cols-5` step and the QA gate asserts the rendered column
count at each width. Card proportions, gaps, image area and price prominence are unchanged.

---

## 2026-09-08 — A fixed-length shelf trims itself to complete rows

Decision:
Homepage shelves are handed enough products to fill the widest row — 5 for a category
rail, 10 for best sellers — and CSS trims the tail at narrower column counts, so a rail
shows 4 / 3 / 4 / 5 and best sellers show 8 / 9 / 8 / 10. Shop All trims nothing.

Reason:
2, 3, 4 and 5 do not divide the same count. A shelf sized for a five-across row leaves an
orphan card dangling under a full row at some narrower width, which reads as a bug rather
than as the end of a list. Trimming in CSS keeps one shelf length in the markup and one
prerendered page per language.

Alternatives:
Serve a different product count per breakpoint. Rejected: the count is not known at build
time and would need client-side measurement. Leave the orphan. Rejected: it is exactly the
kind of ragged edge the reference does not have.

Impact:
`.shelf-rail` and `.shelf-two-rows` in `globals.css`, mirroring Tailwind's md/lg/xl. The
QA gate fails a fixed-length shelf that renders a part-full row. Shop All is exempt on
purpose: a part-full last row there is where the catalogue ends.

---

## 2026-09-08 — Persistent controls reserve the longest translation

Decision:
The nav slots, cart label, shop "All" chip, sort menu and hero actions size themselves to
the longest translation of their label rather than to the one on screen. `StableText`
renders every locale's version of a label into one grid cell and hides all but the current
one with `visibility: hidden`.

Reason:
Kiswahili labels are longer than their English originals, so the header was laid out
differently in each language: the nav grew, the search field shrank to absorb it, and the
language control and cart button slid sideways. Switching language looked glitchy even
though nothing was broken.

Alternatives:
Hard-coded `min-width` values. Rejected: a guess, in units of a font it cannot see, that
goes stale the moment a translation is edited. Shrinking the type until Kiswahili fits the
English width. Rejected outright — it degrades the language rather than fixing the layout.
Truncating with an ellipsis. Rejected: it hides copy to solve a layout problem.

Impact:
The browser measures the real strings in the real font, so the reserved widths need no
maintenance and a third language would be reserved for automatically. The cost is one
hidden span per label per additional language, on a handful of controls. Body copy and
headlines deliberately do not reserve, because there the longest translation would open
gaps rather than close them.

---

## 2026-09-08 — Locale stability is a QA assertion, not a review note

Decision:
`qa:screenshots` compares the boxes of every `data-qa-anchor` control between English and
Kiswahili at all five QA widths. Horizontal position and width must match within 2px
everywhere; vertical position must match as well inside the header.

Reason:
"The header should not jump" is the kind of thing that is true on the day it is fixed and
quietly false three commits later. It is cheap to measure and expensive to notice by eye.

Alternatives:
Pixel-diffing EN against SW screenshots. Rejected: the text is *supposed* to differ, so
every screenshot would differ; the comparison has to be geometric, not visual.

Impact:
Vertical drift is deliberately not enforced outside the header: a translated paragraph may
honestly take one more line than its English original, and failing that would leave only
reserved blank space or smaller type as ways to pass. Adding a persistent control means
adding an anchor attribute to it.

---

## 2026-09-08 — One filled WhatsApp mark, and none in the line-icon set

Decision:
`src/components/ui/WhatsAppIcon.tsx` is the only WhatsApp mark in the repository, used by
the storefront support button, the mobile menu, the footer, the contact and track-order
pages and the admin's "WhatsApp customer" actions. `Icon.tsx` carries no `whatsapp` entry
at all.

Reason:
The admin's WhatsApp buttons looked broken. `Icon.tsx` draws its set on a 24px grid with a
2px stroke and `fill: none`, which is right for a cart or a search icon; applied to the
WhatsApp handset it traced the glyph's silhouette as a scribble instead of filling it. The
storefront had already worked around this with a separate filled glyph, so the mark existed
twice and only one of them was correct.

Alternatives:
Fix the stroke paths in place. Rejected: a brand mark is a filled shape and does not belong
in a line-icon set. An icon font or an icon package. Rejected: a network request and a
dependency for one glyph.

Impact:
Removing the entry makes the wrong thing unreachable rather than merely discouraged. Admin
action buttons now carry the mark at 20px; icon-only controls keep their 44px target and
their `aria-label`.

---

## 2026-09-09 — Docker is off the critical path; Supabase is unchanged

Decision:
Build 05 authored the entire Supabase schema, domain layer and client boundary **without a
running database**. Docker Desktop cannot start on this laptop — WSL returns
`Wsl/CallMsi/E_ACCESSDENIED` — so `supabase start` and `supabase db reset` are unavailable.
No time was spent repairing Docker or WSL. Supabase remains the approved and only backend.

Reason:
There is a five-day delivery target. Local containers are a convenience for running
PostgreSQL on this machine; they are not the architecture. Everything that does not need a
live server — migrations, constraints, domain rules, validation, types, tests — is the
larger part of the work and none of it was blocked.

Alternatives:
Fix WSL first. Rejected: an open-ended Windows problem in front of a fixed deadline.
Install PostgreSQL natively on Windows. Rejected: it would verify the SQL but not Supabase
Auth, Storage, RLS or the CLI workflow, so Build 06 would have to repeat the verification
against a real project anyway. Switch backend. Rejected outright — Supabase is approved and
nothing about it caused this.

Impact:
Build 06 must create a **free** Supabase development project and be the first build that can
honestly say the migrations apply, the constraints fire and the policies hold. Until then,
`docs/DATA_MODEL.md` and `docs/TESTING_REQUIREMENTS.md` mark every such claim PENDING. Local
Docker may be revisited later purely for convenience.

---

## 2026-09-09 — Migrations are the single source of truth, not `supabase/schemas/`

Decision:
The schema lives in `supabase/migrations/` as ordered, hand-written SQL. The CLI's
declarative `supabase/schemas/` directory is deliberately not used, and `schema_paths` in
`config.toml` is left empty.

Reason:
Declarative schemas generate migrations by diffing. Keeping both would mean two files
describing the same table and a build that has to decide which one is real. One ordered
sequence of migrations is also the only form that can express the things this schema
actually needs — a foreign key added after both tables exist, a trigger, a backfill.

Alternatives:
Declarative-only. Rejected: it cannot express the ordering above without escape hatches.
Both. Rejected: that is the drift.

Impact:
Every change is a new migration file. `npm run schema:check` reads the migration directory
directly, so nothing else needs to know.

---

## 2026-09-09 — Row Level Security on, with no policies at all

Decision:
Migration `20260909090700` enables RLS on all 30 tables and writes **no policies**. The
`anon` and `authenticated` roles can therefore read and write nothing.

Reason:
A table with RLS switched off is readable by anyone holding the anon key, which is public by
design. Nothing in the application reads Supabase yet, so a closed door costs nothing today
and is the only safe default for the moment a project is created. Enabling RLS later, table
by table, is exactly how a table gets missed.

Alternatives:
Write the policies now. Rejected: an untested policy is worse than an absent one, because it
looks like protection. Policies need a running database to test against, which Build 06 has
and this build does not. Leave RLS off until Build 06. Rejected: that is a hole with a date
on it.

Impact:
Build 06 opens specific doors and tests each one: public read of `product_shelf`, customers
limited to their own orders and addresses, staff scoped by role, and a dedicated audited
role for the sync worker. The two views are `security_invoker = on` so they enforce the
caller's policies rather than the view owner's.

---

## 2026-09-09 — Every amount is an integer number of shillings

Decision:
All money is a PostgreSQL `integer` column named `*_tzs`, constrained `>= 0`. No `numeric`,
`decimal`, `real`, `double precision` or `money` type appears anywhere in the schema, and
`npm run schema:check` fails the build if one does.

Reason:
TZS retail prices are whole shillings. Floating point eventually puts
"TSh 33,999.999999" on an order, and `numeric` invites a `.toFixed()` somewhere in the UI
that rounds a total the customer already agreed to.

Alternatives:
`numeric(12,2)`. Rejected: it models cents that do not exist here and still needs the same
non-negative constraints. Storing money as text. Rejected: unsortable, unsummable.

Impact:
`total_tzs = subtotal_tzs - discount_tzs + delivery_fee_tzs` and
`line_total_tzs = unit_price_tzs * quantity` are CHECK constraints. `src/lib/domain/money.ts`
refuses a decimal on input rather than rounding it, so a mistyped price is a message rather
than a silently wrong figure. The ceiling is 2,147,483,647 — the column's own limit.

---

## 2026-09-09 — Variants are option axes, not a size column

Decision:
`product_families` declare which axes they vary by (`product_family_axes`), axes and their
values are rows (`product_option_axes`, `product_option_values`), and each SKU records one
value per axis (`product_option_assignments`). "Size" and "Scent" are seeded rows, not
schema.

Reason:
EcoPlus varies by size and scent. The next brand may vary by colour, grit, voltage or
nothing at all. A `size` column plus a `scent` column would make that brand a migration —
which is precisely what the project constitution forbids.

Alternatives:
Two columns on `products`. Rejected: single-brand thinking. A JSONB attribute bag. Rejected:
unconstrainable and unjoinable, so the size chooser could never be sorted correctly.

Impact:
`is_ordinal` on an axis and `numeric_rank` on a value are what make "500ML" sort before
"5LT" instead of alphabetically. A family with no axis rows has exactly one SKU, which is
legitimate and needs no special case.

---

## 2026-09-09 — A hand-authored schema contract, clearly labelled unverified

Decision:
`src/lib/supabase/types.ts` is written by hand from the migrations, with a header stating in
full that it has never been checked against a running PostgreSQL. Build 06 replaces it with
`supabase gen types typescript` output.

Reason:
Without it every future query is `any`. With it, but presented as if generated, a wrong
column name would look like verified truth. Labelling it is the difference between a useful
placeholder and a lie.

Alternatives:
`any` until Build 06. Rejected: the client modules could not be written at all. Generating
types from the SQL with a parser. Rejected: a second implementation of PostgreSQL's own
understanding of the schema, which would be wrong in different ways.

Impact:
`npm run schema:check` compares the contract's table list and every enum against the SQL, so
those two cannot drift silently. Individual column types are the part still awaiting
generation, and Build 06 treats any difference as a bug in this file.
