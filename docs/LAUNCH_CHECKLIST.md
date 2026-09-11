# Launch checklist

The one document to read before Jojo Usafi opens. Four sections, in the order
they matter:

- **A** — what the engineering has finished
- **B** — what Ibrahim must provide or confirm
- **C** — the production setup, step by step
- **D** — what to watch once it is open

`npm run launch:check` answers most of section B from the database itself, so
this document and the shop cannot drift apart. Run it rather than trusting the
list below.

**No secret appears in this file, and none ever should.**

---

## A. Engineering complete

### The shop

- Storefront in English and Kiswahili, 95 published products, real photography
- Guest checkout: priced on the server, stock reserved atomically, the order
  written before anything else happens
- Track Order needing the order number **and** the phone
- Cart in `localStorage`, holding SKUs and quantities only — never prices

### The dashboard

- Orders, with one obvious next action per stage
- Order amendment before dispatch, in one transaction that cannot oversell
- Payment recorded as cash or digital, a reference required for digital
- Cancellation and both delivery-failure outcomes
- Products: price, offer, stock, visibility, lifecycle — **and photographs**
- Customers, delivery zones, website words, shop settings, staff
- **Reports**: sales today/week/month, order counts, averages, how orders ended,
  the cash/digital split, what is selling, what is running out, and what still
  has no photograph
- Catalogue sync with the Google Sheet, both ways, manual

### The guarantees

- Row Level Security on all 30 tables; 95 policies
- Append-only ledgers: order events, stock movements, audit events
- `product_shelf` as the single definition of "a customer may see this"
- Stock the Google Sheet can never move, proved from the deployment
- Reservation expiry engine, doing nothing until it is configured
- Two protected job endpoints, closed by default, scheduled by nothing

### The deployment

- Staging at `https://jojo-usafi-staging.vercel.app`, public by a Deployment
  Protection Exception for that one domain
- Security headers including a **measured** Content-Security-Policy
- `robots.txt`, `noindex` and an `X-Robots-Tag` on `/admin`
- A sitemap, empty on staging and complete on production
- 203 offline tests, 271 database tests, QA at five widths in both languages
- Deployed gates: `qa:deployed`, `verify:commerce`, `verify:website`,
  `verify:password-link`, `verify:cache`, and the Step I sync round trip

### Known engineering compromises, stated rather than hidden

- **`script-src 'unsafe-inline'`.** The App Router emits inline scripts on every
  page and the usual answer, a per-request nonce, cannot work on statically
  prerendered pages. Buying it would mean making 217 static pages dynamic. The
  rest of the policy still stops an injected script from sending anything
  anywhere. See the comment in `next.config.ts`.
- **No automatic scheduling.** Both job endpoints exist and are protected;
  nothing calls them. See section C step 14.
- **Photographs are validated, not transformed.** An upload that is the wrong
  shape is refused with a sentence rather than cropped into one. See
  `src/lib/admin/media.ts`.

---

## B. Ibrahim must provide or confirm

Run `npm run launch:check` for the live answer. As of Build 12 it reports
**7 blocked, 5 warnings** against the development project, all of them business
input rather than defects.

### Blocked — the shop cannot open without these

| | What is needed | Why it blocks |
| --- | --- | --- |
| 1 | **Real WhatsApp number** | the storefront's WhatsApp button reaches a placeholder |
| 2 | **Real phone number** | the same, for the Call button |
| 3 | **Real email address** | the contact page shows a placeholder |
| 4 | **Real shop address** | the same |
| 5 | **Reservation expiry duration** | until it is set, an abandoned order holds its stock for ever |
| 6 | **Real Dar es Salaam delivery areas and fees** | all four current areas are development placeholders |
| 7 | **`EP01-A01`'s real price** | it is TSh 128, which is almost certainly missing three zeros. It stays off the website until somebody says |

Entered on **More → Settings** (1–5) and **More → Delivery zones** (6), and in
the product editor or the Product Master (7).

### Also needed before opening

| | What is needed |
| --- | --- |
| 8 | **Verified final retail prices** across the catalogue |
| 9 | **A physical stock count** — see section C step 11 |
| 10 | **Return and refund wording**, in Ibrahim's own words |
| 11 | **The logo** |
| 12 | **The production domain** |
| 13 | **A decision on `EP23-A02`** — an approved photograph with no product row. It stays an orphan until somebody creates one |

### Worth doing, not blocking

- **106 products have no photograph** and are held off the website until they do.
  The dashboard can now upload them: Reports lists every one, each linking
  straight to its product.

### Deliberately not on this list

A **global free-delivery spend threshold** and a **same-day delivery cut-off**
were decided against for V1 on 2026-09-09. Free delivery is a property of a
delivery area; delivery timing is confirmed with the order. Neither is a blocker
and neither should be added back without Ibrahim asking.

---

## C. Production setup, in order

Nothing in this section has been done. **Do not start it until section B is
settled** — several steps import data that would otherwise be wrong.

`npm run rehearse:production` checks, before any of this, that the migration
files really are what built the development database and that a fresh project
would start numbering at **JU-000001**.

### The database

1. **Create a Supabase project.** Free tier, region `ap-south-1`, matching
   development. The free tier allows two projects per organisation, so this costs
   nothing.
2. **Link and apply the migrations.** `npx supabase link --project-ref <new>`
   then `npx supabase db push`. All 21, in order. `db reset` is never used on a
   hosted project.
3. **Generate and check the types.** `npm run db:types` against the new ref, then
   `npm run db:types:check`. They must match development exactly — that is the
   proof the two schemas are the same.
4. **Confirm the buckets exist.** Migration 0011 creates `product-media`,
   `brand-media` and `site-content` with their policies. Nothing to do by hand.

### The people

5. **Bootstrap the Owner.** Ibrahim signs up and claims the seat at
   `/admin/setup`. `jojo_claim_first_owner()` is single-use by construction, so
   this must happen **before the project is reachable by anybody else**.
6. **Do not migrate any staff.** No QA Manager, no QA Order staff, no test auth
   users. The Owner invites real staff afterwards, and each one sets their own
   password through the link they are emailed.

### The catalogue

7. **Import the catalogue** with `scripts/import-catalogue.mjs` from `imports/`,
   *after* the prices in section B are confirmed. Importing unconfirmed prices is
   how unconfirmed prices get sold.
8. **Re-run the catalogue build** (`npm run catalogue:build`) against production
   and upload the photographs. Re-running the deterministic build is preferable
   to copying bucket to bucket: it is reproducible, and it proves the source
   material still produces what is on the shelf.
9. **`EP01-A01`** keeps whatever price Ibrahim confirms. If it is still
   unconfirmed it stays blocked, and `launch:check` will keep saying so.
10. **`EP23-A02`** is not created. Its photograph stays an orphan, listed on the
    Reports screen, until somebody deliberately creates the product row.

### The stock

11. **Count the shelf, then record it as an opening count.**

    **The development figures are not production figures.** The 12,822 units in
    development are a snapshot of a spreadsheet, not a count of a shelf, and
    copying them would make the first oversell a certainty. Production stock is
    entered through **Products → Set counted stock**, which writes an
    `opening_count` movement to the ledger saying who counted it and when.

    `launch:check` in production mode blocks until that movement exists.

### The shop's own details

12. **Delivery zones**, entered through the dashboard. Production never had the
    placeholders, so there is nothing to replace — only to create.
13. **Settings**: WhatsApp, phone, email, address, logo, and the two reservation
    durations.

### The deployment

14. **Vercel production environment.** The same variable names as staging, with
    production values, plus **`APP_ENV=production`** — without it the real shop
    carries `noindex` and Google never sees it. The Supabase variables are needed
    at **build** time, because product pages are prerendered.
15. **The Google Sheet.** Production owns the real Product Master. Staging must
    then never write to it: remove the Google variables from the staging
    environment, and its Catalogue Sync screen will report Google as not
    configured, which it already does gracefully.
16. **Custom domain**, then **Supabase Auth → URL Configuration**: Site URL set
    to the domain, and Redirect URLs limited to
    `https://<domain>/admin/set-password` and
    `https://<domain>/admin/auth/callback`. Exact paths, never a wildcard.
17. **A scheduler, if wanted.** See below. Not required to open.
18. **Run everything against the production URL** before telling anybody:
    `npm run qa:deployed`, `BASE_URL=… npm run qa:screenshots`,
    `LAUNCH_MODE=production npm run launch:check`.

### The scheduler, when it is wanted

Neither job endpoint is called by anything today, and the shop opens perfectly
well that way: stock is released by cancelling an order, and the catalogue is
synced by pressing Sync Now.

When automation is wanted, **Vercel Cron is the zero-cost option already
available**: cron jobs are included on every plan, with a minimum cadence of once
a day on Hobby and once a minute on Pro. It is configured by adding a `crons`
array to `vercel.json` — nothing else changes, because the endpoints already
exist, already require a bearer secret, and already refuse an anonymous caller.

Before enabling it:

- set `RESERVATION_EXPIRY_JOB_SECRET` (≥ 16 characters) in the production
  environment, and `SHEET_SYNC_WEBHOOK_SECRET` if the sync is to be scheduled too
- confirm the cadence the plan allows is useful — a once-daily expiry run is
  nearly pointless for a 30-minute reservation window, which is an argument for
  deciding the duration first
- confirm `npm run qa:deployed` still reports 401 from an anonymous call, which
  is the check that the secret did not accidentally open the endpoint

**The Google Sheet sync should not be scheduled at launch.** It is two-way, and
an automatic run that meets a conflict has nobody to ask. Manual Sync Now is the
right shape until there is a reason to change it.

---

## D. After it opens

### The first week

- **Watch the first real order end to end.** Place it, confirm it, deliver it,
  record the payment, and check the ledger agrees.
- **Check `npm run launch:check` weekly.** It reads the live database, so it
  keeps answering as the shop changes.
- **Watch the Reports screen** for orders completed with no payment recorded.
  The database refuses that, so a non-zero figure means something is wrong.

### Things that will need attention

- **Supabase Free keeps 7 days of backups.** A mistake found on day 8 is not
  recoverable from a backup. The append-only ledgers mean most mistakes are
  reconstructable from the record even so — but this is the real limit of the
  free tier and it should be understood before launch, not after.
- **The free tier pauses a project after a week of inactivity.** A live shop will
  not be inactive, but a quiet first fortnight could be.
- **`APP_ENV`** — confirm the production site is indexable by fetching
  `/robots.txt` and looking for `Allow: /`.

### Still to build, in rough order of usefulness

1. **Kiswahili product content.** `product_content` is per-locale; the Product
   Master holds one language.
2. **A nonce-based CSP**, if the storefront ever becomes dynamic for another
   reason. Not worth making 217 pages dynamic on its own.
3. **Brand and site-content media upload.** The product path is built; the other
   two buckets have policies and no screen.
4. **A scheduled sync**, once conflicts are rare enough that an automatic run is
   not a question nobody can answer.
