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

---

## 2026-09-09 — The development database is real, and the CLI points at one project only

Decision:
Build 06 links the Supabase CLI to the **Jojo Usafi Dev** project (`dyjhacbbedytcstxxjzl`,
free tier, ap-south-1) and applies every migration to it. The linked ref is verified before
any database operation, `db push --dry-run` is run before every real push, and
`supabase db reset` is never used against a hosted project. `scripts/gen-types.mjs` pins the
project ref rather than trusting whatever happens to be linked, and `tests/db/support.ts`
refuses to run if the URL is not that project.

Reason:
The same Supabase account holds an unrelated project (`mushus-stock`). "Whatever is linked"
is a fine default for a person at a terminal and a bad one for a script that disables
triggers and deletes rows. A pinned ref that must match is cheap; the mistake it prevents is
not recoverable.

Alternatives:
Read the ref from `supabase/.temp/project-ref`. Rejected: that file is exactly the thing
that would be wrong. Trust the operator. Rejected: the operator is sometimes an agent.

Impact:
No billing is attached and no paid feature is enabled — the whole build cost TZS 0. The
free tier's limits are not approached: 30 tables, no business data, three empty Storage
buckets. Production will be a separate project, and the pinned refs are the reminder to
change them deliberately.

---

## 2026-09-09 — Privileges are granted explicitly, because this project grants nothing

Decision:
`20260909130400_grants.sql` states, table by table, which verbs and columns `anon`,
`authenticated` and `service_role` hold. Nothing relies on Supabase's default privileges.

Reason:
The first fixture insert of Build 06 failed with `permission denied for table suppliers` —
using the **service-role key**. This project is provisioned from a hardened template: the
default ACL for a new table in `public` is `Dxtm` (TRUNCATE, REFERENCES, TRIGGER, MAINTAIN)
for all three API roles, and no SELECT, INSERT, UPDATE or DELETE for anybody. The same
template installs an `ensure_rls` event trigger that switches RLS on for every new table.

So the 95 policies written in `20260909130100` were necessary and not sufficient. Without
grants the schema was, briefly, one that nothing at all could read or write. Most Supabase
documentation describes the opposite default, which is why the migration that assumed it
carries a correction note rather than being quietly rewritten.

Alternatives:
`grant all on all tables to anon, authenticated`. Rejected: it reproduces the permissive
default the platform had deliberately removed, and throws away a free second lock.

Impact:
Two locks, with different jobs. **A grant decides which verbs and which columns; a policy
decides which rows.** `anon` cannot even name `orders`, `customers`, `suppliers`,
`admin_profiles`, `audit_events` or the sync tables — the request fails before a row is
examined. Nobody holds DELETE except the server. A migration that adds a table must now do
two jobs: grant it and give it a policy, or it is invisible.

---

## 2026-09-09 — The browser reads; the server writes

Decision:
There is no INSERT policy on `orders`, `order_items` or `customers` for `anon` or
`authenticated`. Checkout is a server action holding the service-role key. Order tracking is
a server lookup against an order number plus the phone that placed it, not an `anon` read
policy. The single exception is `analytics_events`, where the browser may insert the
browsing-side event kinds with no `customer_id` and no `order_id`.

Reason:
An order written by the browser is an order whose prices came from the request. Pricing the
cart from the database, reserving the stock and writing the order with its first event has
to happen in one transaction on the server, so the browser never needs the privilege. And a
policy that lets a stranger read an order by knowing its number lets them read every order
by counting.

Alternatives:
Let `anon` insert orders under a CHECK-heavy policy. Rejected: no policy can verify that a
line's `unit_price_tzs` matches the catalogue, which is the only thing that matters.

Impact:
`src/lib/supabase/admin.ts` is the checkout path, and remains `server-only`. The analytics
policy is written as an allow-list of event kinds, so a client cannot inflate the shop's
figures by claiming orders were completed.

---

## 2026-09-09 — Order staff may advance an order; nobody may rewrite what it cost

Decision:
All three staff roles hold UPDATE on `orders` through RLS, and a column grant limits them to
`state`, the payment fields, the reason fields, the lifecycle timestamps and `staff_note`.
The money, the customer snapshot and the delivery snapshot are writable only by the server.

Reason:
RLS decides rows, not columns, and orders need both. `orders.advance`, `orders.cancel` and
`orders.recordPayment` are exactly what Order staff exist to do, so withholding UPDATE would
be wrong; but an order is the historical record of what was sold and for how much.

Alternatives:
Route every order change through a server action and give staff read-only RLS. Rejected as
the *only* mechanism: it makes the dashboard the security boundary. The server action still
exists and still validates the transition table — this is the layer underneath it.

Impact:
A staff token that tries to set `total_tzs` gets `42501` from PostgreSQL, not a friendly
error from React. Proved in `tests/db/03-rls.test.ts`.

---

## 2026-09-09 — The first Owner claims the seat; there is no seeded account

Decision:
`public.jojo_claim_first_owner(text)` gives the Owner role to the signed-in account if and
only if no active Owner exists, takes an advisory lock so two simultaneous callers cannot
both succeed, writes an `audit_events` row, and raises for every caller afterwards.
`public.jojo_owner_exists()` is readable by `anon` so the setup screen can choose between
"claim" and "sign in". A trigger refuses to demote, deactivate or delete the last Owner.

Reason:
Only an Owner may create staff, and there was no Owner. Seeding one in SQL means a real
person's email in a file that goes into Git and a password somewhere worse. A bootstrap
script using the service-role key works, but makes the RLS-bypassing key a routine tool.

Alternatives:
Both of the above. Rejected for the reasons given.

Impact:
No password is ever typed into a file, a migration or a document. Nothing has to be deleted
afterwards. **The real Owner account has not been created** — the mechanism is built and
tested, and the two steps are in `docs/PROGRESS.md` for Ibrahim to run when he chooses.

---

## 2026-09-09 — Media buckets are public to read; a Manager replaces, only an Owner destroys

Decision:
`product-media`, `brand-media` and `site-content` are public for reading, screened by size
and MIME type, writable by Owner and Manager, and deletable by an Owner alone.

Reason:
A product photograph is an advertisement: it is meant to be fetched by a stranger, cached by
a CDN and shown in a WhatsApp preview. Signing every image URL would cost work and buy
nothing. Deleting is narrower than replacing because `product_media.media_id` is
`on delete restrict` — the schema already refuses to let a live product lose its photograph,
and the bytes underneath should be at least as hard to remove.

Alternatives:
Private buckets with signed URLs. Rejected for public catalogue imagery. One bucket for
everything. Rejected: the three differ in who writes to them and in what they accept.

Impact:
Nothing private lives in Storage. A bucket for customer documents or payment evidence would
be created private with its own policies, never by relaxing one of these. **No product
photography has been uploaded** — the 95 approved images are still committed build artifacts
in `public/products/`.

---

## 2026-09-09 — `citext` stays in the `public` schema

Decision:
Supabase's security advisor flags `citext` as an extension installed in `public` and
recommends moving it. It is deliberately left where it is, and the reason is recorded in
`20260909130500_function_hardening.sql`.

Reason:
`anon`, `authenticated` and `service_role` have no `search_path` setting of their own, so
they resolve names through the database default of `"$user", public`. `extensions` is on
`postgres`'s path and nobody else's. Moving 47 citext functions out of `public` would risk
every email comparison on `customers.email` and `admin_profiles.email` resolving to no
operator — a real outage — to remove a small amount of published API surface.

Alternatives:
Move it now. Rejected: the failure mode is worse than the finding. Drop `citext` and use
`lower(email)` with a unique index. Rejected as out of scope for Build 06, though it is the
cleaner long-term answer.

Impact:
The advisory stays open, on purpose, with a written reason. The safe order — put `extensions`
on the API roles' `search_path`, prove email lookups still work, then move the extension — is
a change worth making on its own, with its own test.

---

## 2026-09-09 — Database types are generated and then aliased, never re-described

Decision:
`src/lib/supabase/database.types.ts` is generated by `npm run db:types` from the hosted
development schema and is never hand-edited. `src/lib/supabase/types.ts` keeps the friendly
names — `ProductRow`, `OrderRow`, `AdminRoleValue` — as aliases into it. Every hand-written
row interface from Build 05 is gone. `npm run db:types:check` fails if the two have drifted.

Reason:
A hand-written `ProductRow` can disagree with the database and nothing notices until a query
returns `undefined` at runtime. An alias cannot: delete a column, regenerate, and every use
of it stops compiling. Build 05 said this file would be replaced and that any difference
would be a bug in the hand-written version; this is that replacement.

Alternatives:
Keep both and compare them in `schema:check`. Rejected: two descriptions of one table is the
drift, not the fix.

Impact:
The aliases are the only hand-written part and they cannot describe a column that is not
there. One caveat found by testing: `supabase gen types` does NOT mark a `GENERATED ALWAYS`
column as read-only, so `inventory.available` appears in the Insert and Update types and
writing it compiles. The database refuses it with `428C9`, and a test asserts exactly that.

---

## 2026-09-09 — The two npm advisories are build-time only and are not force-fixed

Decision:
`npm audit` reports 2 vulnerabilities — 1 high, 1 moderate — both in `postcss@8.4.31`, the
copy **bundled inside `next`** (`node_modules/next/node_modules/postcss`). No fix is applied.
`npm audit fix --force` was not run.

Reason:
The only fix npm offers is `next@16.3.4`, a **semver-major** framework upgrade, to resolve
advisories that cannot affect this application:

- The four advisories (GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, GHSA-fxqj-rqcc-2cmp,
  GHSA-r28c-9q8g-f849) are path traversal via an attacker-controlled `sourceMappingURL`
  comment, and XSS via an unescaped closing style tag in stringify output.
- All of them require the attacker to control the **CSS being compiled**. This project's CSS
  is `src/app/globals.css` plus Tailwind, authored in-repo and compiled at build time on a
  developer machine and on Vercel. No user input reaches PostCSS, ever.
- PostCSS is a **build-time devDependency**. It is not in the runtime bundle a shopper loads,
  so no shopper is exposed under any configuration.

The direct `postcss` devDependency is already `8.5.28`, which is unaffected. Only Next's own
pinned nested copy is behind.

Alternatives:
`npm audit fix --force`. Rejected: explicitly forbidden, and a major framework upgrade to
patch a build-time tool against an input this project does not have is a far larger risk than
the finding. An `overrides` entry pinning Next's nested `postcss` to `^8.5.28`. Considered and
rejected for now: it substitutes an untested minor version into Next's own CSS pipeline, which
the QA gate would have to re-prove, for the same zero runtime exposure.

Impact:
Reassessed when Next 16 is adopted deliberately, which resolves it as a side effect. Recorded
here so a later reader knows the finding was read rather than ignored.

---

## 2026-09-09 — The Owner seat was claimed without anybody handling a password

Decision:
The first-Owner bootstrap was completed for `Ibrahim Abdul Tayeb`. The claim ran inside a
genuine session belonging to the account being claimed, obtained the passwordless way:
`auth.admin.generateLink` mints a single-use magic-link token, `verifyOtp` exchanges it for a
real session on the **anon** key, and `jojo_claim_first_owner` is then called with that
session. `scripts/claim-first-owner.mjs` is that sequence, and it discovers the target
account rather than naming it.

Reason:
`jojo_claim_first_owner` grants EXECUTE to `authenticated` and to nobody else — not `anon`,
not `service_role`, not PUBLIC — and gives the seat to `auth.uid()`. So the claim cannot be
made on somebody's behalf with a privileged key; it must happen inside their own session.
The operator running it must not be told the password, and the account holder was not at the
terminal.

Step 3 of the same instruction said to use the existing admin authentication infrastructure.
There wasn't any: no sign-in page, no middleware, no session handling, and a hard-coded
`currentUser` mock. So it was built — `/admin/sign-in`, `/admin/setup`, session refresh
middleware and `src/lib/admin/session.ts` — and the script performs exactly what the form
performs.

Alternatives:
Ask for the password. Refused by the instruction, and rightly. Insert an `admin_profiles` row
directly with the service-role key. Rejected: it bypasses RLS, skips the advisory lock, skips
the existence check and writes no audit row — it would produce a row that looks like an Owner
without any of the guarantees that make one. Hard-code the email. Rejected by the instruction
and by good sense; the script refuses if more than one confirmed non-fixture login exists.

Impact:
Ibrahim Abdul Tayeb is the Owner, linked by foreign key to his `auth.users` row, with an
`audit_events` row recording the claim. Verified from the database, not from the script's own
output. Nothing else can create staff; every further account is added by the Owner.

---

## 2026-09-09 — The bootstrap is disabled by state, not by revoking it

Decision:
`/admin/setup` asks `jojo_owner_exists()` first and renders no form once an Owner exists, and
`jojo_claim_first_owner` raises for every caller once the seat is taken. Neither the page nor
the function's EXECUTE grant was removed.

Reason:
Removing it was considered and is wrong. A migration applies to **every** environment,
including a fresh production project on its first day — which will have no Owner and will
need exactly this screen and exactly this function. A migration that revoked the bootstrap
because this development database had finished with it would arrive in production having
already disabled the thing production depends on.

The correct gate for a capability whose availability differs per environment is a question
about that environment's state, asked at the moment it matters. Both layers ask it: the page
so a person is not shown a form that cannot work, and the function — with an advisory lock,
so two simultaneous callers cannot both succeed — because that is the one that is actually
load-bearing.

Alternatives:
`revoke execute on function public.jojo_claim_first_owner(text) from authenticated` in a new
migration. Rejected for the reason above. Deleting the setup route. Rejected: same problem,
and it would have to be written again.

Impact:
The residual surface is a signed-in non-staff account being able to call an RPC that
immediately raises "Jojo Usafi already has an Owner" — which `jojo_owner_exists()` already
tells `anon` by design. Tested in `tests/db/02-auth.test.ts`.

---

## 2026-09-09 — Test teardown identifies fixtures by what they are, never by what happened

Decision:
`tests/db/teardown.sql` deletes rows only by patterns that identify the **entity** as a
fixture (`ZZTEST` SKUs, `zztest-` emails, the `+2557000000%` phone range). The clause
`or action = 'admin_profile.first_owner_claimed'` has been removed from the `audit_events`
cleanup.

Reason:
That clause was written in Build 06, when the only claim that could ever have happened was a
fixture's. Once the real bootstrap ran, the next test run deleted Jojo Usafi's own audit row —
a real record of a real event — as tidy-up. It was caught immediately by a test asserting the
row exists, and the row was reconstructed from `admin_profiles.invited_at` with
`request_id = 'reconstructed-2026-09-09-after-test-teardown-deleted-it'`, so the trail is
honest about its own repair.

The clause was also redundant: a fixture claim writes
`entity_key = 'zztest-owner@jojo-usafi.test'`, which the remaining pattern already matches.

Alternatives:
Keep it and exclude the real Owner by email. Rejected: that is a hard-coded exception that
goes stale the moment a second real person exists. The rule is the general one — teardown
matches fixtures, never events.

Impact:
A companion change in `tests/db/02-auth.test.ts`: the last-Owner guard is now exercised
against the real Owner row, and every attempt is wrapped in a restore that puts the row back —
including re-inserting it from a snapshot — if the guard ever fails. A test that discovers a
broken guard must not also be the thing that leaves the shop without an Owner. That safety net
earned its place on the first run, when the guard tests failed for an unrelated reason (a
second Owner was present) and the deletion actually went through.

---

## 2026-09-09 — Test fixtures are scoped to one run, and teardown never matches on business state

Decision:
Every database test run mints an eight-hex-character token. Every fixture identifier carries
it — SKU, slug, email, phone, storage path, analytics session — and `teardown.sql.tmpl` is
rendered per run and deletes exactly that token, plus the previous run's token if it crashed.
No rule matches a role, an action name, a lifecycle or a shared email domain.
`05-real-data-untouched.test.ts` compares every real `admin_profiles` and `audit_events` row
against a snapshot taken before any fixture existed, byte for byte.

Reason:
The Owner bootstrap exposed two ways the old fixtures could reach real data. Teardown deleted
`audit_events where action = 'admin_profile.first_owner_claimed'` — a rule about what had
*happened* rather than about who had made the row — and destroyed Jojo Usafi's real audit
entry. Separately, the last-Owner tests mutated the real Owner directly, and on one run a
DELETE went through, saved only by a restore net. Neither was acceptable with real catalogue
data about to land.

The general fix is a rule, not a patch: **teardown identifies rows by who made them.** A
class marker like `ZZTEST%` is not that — it cannot tell this run's rows from a previous
run's, and it invites "while we are here" clauses like the one that caused the incident.

Alternatives:
Keep the class prefix and exclude real rows by email. Rejected: a hard-coded exception that
goes stale the moment a second real person exists. A separate test project. Rejected: it
would need a third Supabase project and the free tier is not to be stretched without asking.

Impact:
Fixture Owners are never the last Owner, so the `admin_profiles_last_owner` trigger no longer
has to be disabled during cleanup — one fewer dangerous capability in the test path. The
suite also **fails closed**: if there is not exactly one real active Owner before it starts,
nothing runs, because a suite that cannot identify the fixtures cannot be trusted to decide
what to delete.

---

## 2026-09-09 — The last-Owner guard is exercised in a transaction that always rolls back

Decision:
`tests/db/last-owner-guard.sql` opens a transaction, creates two probe Owners, stands every
other Owner down *inside the transaction*, exercises all three refusals (demote, deactivate,
delete) against the probes, and `ROLLBACK`s unconditionally.

Reason:
The guard fires only for the last active Owner. Jojo Usafi's Owner is permanent, so any
fixture Owner is always a second one and the guard never fires on it — the scenario simply
cannot be reached without a world containing exactly one Owner. Build 06 reached it by
attacking the real row, which is what Build 07 was told to stop doing.

A rolled-back transaction is the sanctioned way out: nothing is ever committed, a crash makes
PostgreSQL roll back for us, and the byte-for-byte regression test proves the outcome
independently rather than taking the transaction's word for it.

Alternatives:
Test a copy of the trigger on a clone table. Rejected: it would prove a copy correct, and the
copy is exactly the thing that could drift. Drop the test. Rejected: this guard is the only
thing standing between the shop and being locked out of its own staff management.

Impact:
A discovery along the way, now asserted: **a staff member named in the audit trail cannot be
deleted by anybody**, because the delete nulls `audit_events.actor_admin_id` and that table
is append-only. Deactivation is the only way to retire someone — which is what the dashboard
already offers.

---

## 2026-09-09 — The importer reads the built artifact, not the CSV a second time

Decision:
`scripts/import-catalogue.mjs` reads `src/lib/catalogue/generated/catalogue.json` and
re-runs `build-catalogue.mjs --check` first, refusing to continue if the artifact has drifted
from `imports/`. `build-catalogue.mjs` gained the columns the database needs and the shelf
never showed: EAN, ITF-14, offer price, stock quantity, low-stock threshold.

Reason:
Parsing the Product Master twice would put SKU-to-photograph matching in two places, and that
is the one rule this catalogue cannot afford to get wrong — a product wearing another
product's photograph is worse than a product with none. One deterministic build, guarded by
`catalogue:check`, keeps "the CSV" and "the artifact" incapable of disagreeing.

Alternatives:
Parse the CSV in the importer. Rejected for the reason above. Import from the CSV and drop the
artifact. Rejected: the artifact is also what the QA gate reads to know which SKUs are
publishable, and it is the deterministic step that makes the whole pipeline reproducible.

Impact:
`npm run catalogue:build` is now the only place the master is interpreted. The importer's own
validation — SKU pattern, integer money, duplicate SKUs, resolvable brand and category — is a
second gate over that, not a second interpretation.

---

## 2026-09-09 — A blocked product is never made visible by an import

Decision:
The importer sets `storefront_visible` to true only when a product carries no blocking flag.
The master's WEBSITE STATUS is honoured for everything else, but it can never *raise*
visibility on a product the catalogue build blocked. Nothing is ever deleted: a row that
disappears from the master stays in the database.

Reason:
Re-imports will be routine once the Google Sheet is connected, and the failure that matters is
a spreadsheet edit quietly publishing a product with an implausible price or no photograph.
Making "blocked" win is the rule that survives somebody typing "Show" in a cell.

Deleting is worse than useless: `products` is referenced by `order_items`, and a row vanishing
from an export means somebody stopped exporting it, not that the product stopped existing.

Alternatives:
Let the master decide visibility outright. Rejected — that is the hole. Delete rows absent
from the master. Rejected — it would destroy order history and cannot be undone.

Impact:
`EP01-A01` is in the database at its unchanged price of TZS 128, active, and invisible. The
106 products with no approved photograph are all present and none is public. Asserted in
`tests/db/06-catalogue.test.ts` against the anon key.

---

## 2026-09-09 — Variant axes come from the data, not from the brand we happen to sell

Decision:
The importer declares the size axis for a family only when that family's SKUs genuinely have
more than one distinct pack size. Scent is not modelled at all.

Reason:
The project constitution forbids assuming the current catalogue is the model. EcoPlus varies
by size and, in its product names, by scent — but the Product Master has a SIZE column and no
scent column, so a scent axis would have to be guessed out of names. That is the fuzzy
identity matching this catalogue refuses everywhere else, and it would bake a cleaning-product
assumption into the schema's data.

Alternatives:
Declare size and scent for everything. Rejected: it invents an axis and asserts a variant
structure the source does not contain. Declare no axes. Rejected: the size chooser on the
product page is real and the data supports it.

Impact:
65 families, 65 of them varying by size, 12 size values, 201 assignments. A future brand
varying by colour, grit or voltage adds axis rows and values — no migration, and no
re-interpretation of what a variant is.

---

## 2026-09-09 — The storefront reads a cached view, three queries for the whole catalogue

Decision:
`queries.ts` fetches `product_shelf` plus the brand and category lists once, through
`unstable_cache` with a five-minute revalidation, using a **session-less anon client**. Client
components receive the published catalogue through `CatalogueProvider` instead of importing a
JSON file.

Reason:
The constitution forbids a Firestore-style read per product per visitor. Ninety-five products
on a Shop All page must never be ninety-five round trips to Mumbai. The shelf changes when
Ibrahim changes it, which is rarely and never mid-page-load, so one shared fetch is both
correct and enormously cheaper.

Reading `product_shelf` rather than `products` matters as much: the view is the single
definition of "a customer may see this", so the storefront **cannot** publish something the
database considers hidden — it has no way to see it. A session client would have made every
page dynamic for no gain, since the shelf is identical for everyone.

Alternatives:
`React.cache`. Rejected: it dedupes within one render, so still one round trip per page view.
Per-query reads with joins. Rejected: more queries, and a second definition of "public" in
TypeScript.

Impact:
95 product pages per language prerender with 5-minute ISR. Caching is time-based rather than
invalidated by the importer: a `revalidateTag('catalogue')` endpoint needs an authenticated
caller to be safe, so it belongs with the admin write path. A re-import is visible within five
minutes. Commerce is explicitly excluded — checkout will price the cart from the database at
the moment of the order, not from this snapshot.

---

## 2026-09-09 — The admin reads the catalogue as the caller, not as the server

Decision:
`src/lib/catalogue/admin.ts` uses the request's session client. It asks `jojo_is_staff()`
first and selects the stock columns that answer permits: staff get `on_hand` and `reserved`,
anyone else gets `available` only. The page says which of the two happened.

Reason:
The ten dashboard screens are still not behind a sign-in guard, because they showed mock data
and there was nothing to protect. Now they show real prices and stock. A service-role read
would hand the shop's full commercial position to anyone who typed `/admin`; the session
client makes Row Level Security answer instead.

This surfaced immediately: the admin pages returned 500 with `permission denied for table
inventory`, because `anon` holds a column grant covering `available` and not `on_hand`. That
is the boundary working. Asking only for permitted columns is the fix; widening the grant
would not have been.

Alternatives:
Service role plus a guard on the page. Rejected as the only mechanism: it makes the page the
security boundary. Guard all ten screens now. Rejected as scope — the guard belongs with the
build that lets those screens write.

Impact:
Product writing is still not enabled. Orders and customers stay mock. `src/mocks/admin/data.ts`
no longer invents stock, visibility or sync state, because those are real columns now.

---

## 2026-09-09 — Photographs go in the existing bucket, filed under SKU

Decision:
The 95 approved WebP files are uploaded to `product-media`, at
`<SKU>/<sku>-primary-1.webp`, with each file's sha256 stored on its `media_assets` row. A
new `product-images` bucket was not created.

Reason:
`product-media` already exists with the policies Build 06 wrote and tested — public read,
Owner-and-Manager write, Owner-only delete, size and MIME screening. A second bucket would
duplicate that surface to gain a different name. The path is the convention already recorded
on `media_assets.storage_path`, SKU-first so renaming a product never moves its photographs
and an orphaned folder reads immediately as a SKU that no longer exists.

The checksum is what makes re-imports cheap and safe: unchanged bytes are not re-uploaded, and
no image is re-encoded, so the approved Build 03 processing is preserved exactly.

Alternatives:
A new bucket named for the instruction. Rejected: names are cheap, tested policies are not.
Re-process images during import. Rejected: it would change approved photography and create a
duplicate transformed asset on every run.

Impact:
2.6 MB in Storage, comfortably inside the free tier. `EP23-A02` — the orphan approved image —
is **not** uploaded and exists only in the import report.

---

## 2026-09-09 — Stock is reserved inside one PostgreSQL transaction, not in TypeScript

Decision:
`jojo_place_order` locks the relevant `inventory` rows with `SELECT … FOR UPDATE`
in product-id order, then prices, checks, reserves, writes the order, its lines, two ledger
movements and two order events — all in one function, therefore one transaction. Carts
reserve nothing; stock is committed at exactly one moment.

Reason:
Two shoppers can reach the last jerrycan in the same millisecond. Deciding "is there enough?"
in application code and then writing the reservation is two round trips with a gap in the
middle, and that gap is where overselling lives. Inside one function the second transaction
waits for the first and then sees the truth.

Locking in a deterministic order is not decoration: two orders containing the same two
products in opposite order would otherwise deadlock each other.

Alternatives:
Check-then-write from a server action. Rejected — that is the bug. Optimistic concurrency with
a version column and a retry loop. Rejected: more moving parts, and it still needs the
database to arbitrate, so it is a lock with extra steps.

Impact:
Proved rather than asserted: 1 in stock with 2 simultaneous orders yields exactly 1 success;
3 in stock with 5 yields exactly 3, with three distinct order numbers. A refused attempt
leaves no order, no lines, no events and no stock movement, and one bad line among several
reserves nothing at all.

---

## 2026-09-09 — The browser may say what it wants, never what it costs

Decision:
`jojo_quote_order` and `jojo_place_order` accept SKUs, quantities and a delivery-zone slug.
There is no parameter — in the SQL, in `src/lib/commerce/checkout.ts`, or in the server
action — for a unit price, an offer price, a subtotal, a delivery fee, a discount or a total.

Reason:
A trust boundary made of validation is a boundary you have to remember to defend. A trust
boundary made of *absence* defends itself: a hostile request carrying its own figures changes
nothing because there is nowhere to put them. A test sends `unit_price: 1` and gets 10,000
back.

The same reasoning puts `jojo_place_order` behind the service-role key alone. An anonymous
caller receives `42501` before the function body runs; the reachable path is a server action,
which is where request shaping and rate limiting belong.

Alternatives:
Accept a client total and verify it server-side. Rejected: it invites "verify" to drift into
"trust", and there is no reason for the number to make the journey at all.

Impact:
Delivery fee comes from the zone row, and a zone marked `free_delivery` yields 0 whatever the
stored fee says. Quotes are a snapshot and promise nothing — availability can change between
quoting and ordering, which is why the order path checks again under the lock.

---

## 2026-09-09 — An order's initial state is `new`, not `awaiting_confirmation`

Decision:
`jojo_place_order` writes `state = 'new'` and one `order_created` event. It does not
immediately transition to `awaiting_confirmation`.

Reason:
The architecture does not separate system receipt from a staff confirmation queue — `new` IS
the queue. `NEXT_ACTION` in `src/lib/domain/orders.ts` already gives `new` the button
"Confirm order", and `awaiting_confirmation` exists for the different situation where staff
have contacted the customer and are waiting for them. Auto-advancing would mean every order
claiming a conversation that has not happened.

Alternatives:
Create at `awaiting_confirmation`. Rejected: it would make the state a lie on arrival and
leave the admin with two states that mean the same thing.

Impact:
The admin's "one obvious next action per stage" still holds: a new order's action is Confirm.
Recorded here because it is the kind of decision that looks arbitrary later.

---

## 2026-09-09 — Cancellation is idempotent, and stock is never given back twice

Decision:
`jojo_cancel_order` is safe to call repeatedly. `orders.reservation_released_at` records that
the release has happened; a second call returns `already: true` and releases nothing.

Reason:
Retries are ordinary — a dropped connection, a double tap on a phone, a queue redelivering.
An operation that releases stock must be safe under all of them, or a cancelled order quietly
inflates availability by however many times somebody pressed the button.

Alternatives:
Guard on `state = 'cancelled'` alone. Rejected: it conflates "is cancelled" with "has been
released", and those come apart the moment cancellation is ever split across two steps.

Impact:
Also refuses cancellation of a completed or out-for-delivery order, and refuses any
cancellation with no reason — the schema requires one and the function asks for it in words a
person can act on.

---

## 2026-09-09 — Reservation expiry has a home, and no invented duration

Decision:
`shop_settings.reservation_warning_minutes` and `reservation_expiry_minutes` both start
**null**. `orders.reservation_expires_at` is stamped only when the setting exists, and
`jojo_stale_reservations()` lists what would qualify. No scheduler is built.

Reason:
How long an unconfirmed order may hold stock is a business decision, and a default would be a
guess wearing the costume of a rule. Null means undecided; zero would mean "immediately",
which is a different and wrong answer.

What matters architecturally is that no reservation can be held forever with no way to find
it — that question has an answer today even though nothing acts on it yet.

Alternatives:
Pick 24 hours. Rejected: inventing commercial policy. Leave the columns out. Rejected: it
would make the eventual answer a migration and a code change rather than a row.

Impact:
Ibrahim sets the two durations; the scheduler is then a small job over a query that already
exists.

---

## 2026-09-09 — Real-data admin routes are guarded, but middleware does not decide authorisation

Decision:
`src/middleware.ts` redirects a signed-out visitor from every `/admin` route except
`/admin/sign-in` and `/admin/setup`. It checks only whether anybody is signed in. Whether that
person is staff stays with Row Level Security and each page's own `getAdminSession()`.

Reason:
Build 06 left the dashboard open deliberately, because it showed invented data and there was
nothing to protect. Real prices, stock and orders ended that.

Splitting the two questions is the point: a middleware that decided authorisation would be a
second opinion that could drift from the database's, and the database's is the one that
actually governs the data. Middleware's job is to send a stranger somewhere useful instead of
showing them an empty dashboard.

Alternatives:
Check the staff role in middleware too. Rejected for the drift above, and it would add a
database round trip to every admin request to re-derive something RLS already knows.

Impact:
The QA gate asserts all seven real-data routes redirect. It also **lost** the ten dashboard
screenshots, because those screens now need a session — a real gap, recorded in
`docs/TESTING_REQUIREMENTS.md`, to be closed with a seeded QA staff account.

---

## 2026-09-09 — Cache invalidation is a staff-only server action

Decision:
`revalidateCatalogue()` calls `revalidateTag("catalogue")` and refuses anybody who is not
active staff, using the same `getAdminSession()` the admin screens use.

Reason:
The storefront caches the shelf for five minutes, which is right for browsing and wrong for an
Owner who has just changed a price. But an open invalidation endpoint is a cheap way to make a
shop slow: call it in a loop and every request rebuilds. Reusing the existing session check
means there is one answer to "is this person staff", not two.

Alternatives:
A secret-token webhook. Rejected: another credential to manage for something a session already
answers. Shorter cache time. Rejected: it makes every shopper pay for an Owner's convenience.

Impact:
Not yet called from anywhere, because the admin write screens are not built — it is ready for
the build that finishes them.

---

## 2026-09-09 — Development delivery zones exist, and say so in the data

Decision:
`scripts/seed-dev-zones.mjs` writes four placeholder zones. Every row carries a `notes` value
stating it is a development fixture awaiting Ibrahim's real list and fees. They are not in
`supabase/seed.sql`.

Reason:
Checkout cannot be exercised at all without one active delivery area, and the real list is a
business decision that has not been made. The compromise is to make the placeholder impossible
to mistake for a decision: the marker lives in the row, not only in a document.

Alternatives:
Seed nothing. Rejected: it makes the whole commerce path untestable in development. Seed them
in `seed.sql`. Rejected: that file's entire premise is that it inserts no business data, and
the prototype's illustrative zone names must never arrive looking like production truth.

Impact:
A production blocker, recorded with the others: the real zones and fees replace these before
launch, through the admin Delivery Zones screen.
