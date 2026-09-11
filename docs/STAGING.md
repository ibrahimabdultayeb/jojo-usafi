# Staging, and the road to production

Build 11. What a staging deployment of Jojo Usafi is, exactly how to create one,
what proves it works, and what has to be true before any of this becomes a real
shop.

**No secret appears in this file, and none ever should.** Everything below names
variables; it never carries a value.

---

## 1. What staging is, and is not

| | Staging | Production |
| --- | --- | --- |
| Database | **Jojo Usafi Dev** — `dyjhacbbedytcstxxjzl` | a separate project, not created yet |
| Google Sheet | the real Product Master | to be decided (§7) |
| Domain | a `*.vercel.app` URL | a domain nobody has chosen |
| Indexed by Google | **never** | yes |
| Orders in it | development fixtures | real customers |
| Billing | none, anywhere | to be decided |

Staging is the same code as production against the development database. That is
the whole point: the last class of defect this project has not yet been able to
find is the one that only exists on a deployment — a missing environment
variable, a header that never arrives, an auth redirect pointing at localhost, a
secret that got into a JavaScript bundle.

## 2. Staging is not advertised

Three independent mechanisms, because they fail differently:

| Mechanism | Where | Stops |
| --- | --- | --- |
| `robots.txt` `Disallow: /` | `src/app/robots.ts` | a crawler **fetching** any page |
| `<meta name="robots" content="noindex">` | root metadata | a crawler **listing** a page it heard about elsewhere |
| `X-Robots-Tag: noindex, nofollow` on `/admin/*` | `next.config.ts` | the dashboard, on **every** deployment including production |

All three read `APP_ENV`, and **anything that is not the literal string
`production` is treated as staging**. An unlabelled deployment is therefore not
indexed. That default is deliberate and its cost is asymmetric — see the comment
in `src/lib/environment.ts`, and note that `APP_ENV=production` is a numbered
step in the launch checklist rather than an assumption.

There is no development banner on the storefront. It would be visible to anybody
Ibrahim shows the site to, and the three mechanisms above already stop the only
audience that matters.

## 3. Environment variables

These names are read from the source, not invented — `grep -r "process.env"`.

### Required by the deployed application

| Variable | Scope | Secret | What it is |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Preview + Production | no | the project's API URL; reaches the browser by design |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Preview + Production | no | the **publishable** key (`sb_publishable_…`); RLS is what protects the data, not this |
| `NEXT_PUBLIC_SITE_URL` | Preview + Production | no | absolute base for canonical and `hreflang` URLs — **the deployment's own URL** |
| `APP_ENV` | Preview + Production | no | `staging` on staging. Only `production` disables the noindex |
| `SUPABASE_SERVICE_ROLE_KEY` | Preview + Production | **yes** | the **secret** key (`sb_secret_…`); server-only, bypasses RLS entirely |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Preview + Production | no, but not public | which service account the Sheet is shared with |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Preview + Production | **yes** | the PEM. Never printed, never logged, never in a bundle |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Preview + Production | no, but not public | the one approved spreadsheet |
| `GOOGLE_SHEETS_TAB` | Preview + Production | no | `Product Master` |
| `SHEET_SYNC_WEBHOOK_SECRET` | Preview + Production | **yes** | ≥ 16 chars, or `/api/sync/catalogue` refuses everything |
| `RESERVATION_EXPIRY_JOB_SECRET` | Preview + Production | **yes** | ≥ 16 chars, or `/api/jobs/expire-reservations` refuses everything |

**Nothing server-side may ever be given a `NEXT_PUBLIC_` name.** That prefix is
an instruction to Next.js to inline the value into the JavaScript bundle. The
deployed check in §5 looks for exactly that mistake.

### The key names are historical — the keys are not

The two variable names say `ANON_KEY` and `SERVICE_ROLE_KEY` because that is what
they were called when this project started. **The development project's legacy
JWT keys have since been disabled**, on purpose, and the values these variables
must now carry are the new-format ones:

| Variable | Value it must hold | Supabase calls it |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_…` | publishable |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_…` | secret |

Putting a legacy key in either one produces a build that compiles and then fails
with **"Could not read the shelf: Legacy API keys are disabled"** — which is
exactly what the first staging deployment did. The variables were not renamed
because renaming them touches every environment at once for no functional gain;
this table is the note that stops the next person guessing.

### They are needed at BUILD time, not only at runtime

This is the detail most likely to cause a confusing first failure. The product
pages are prerendered — `generateStaticParams` reads `product_shelf` and emits a
page per product per language — so **`next build` itself talks to Supabase.**

Two consequences:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must exist in
  the environment Vercel *builds* in, not merely the one it serves from. Vercel
  exposes environment variables to the build by default, so scoping them to the
  right environment is all that is required — but a variable added only after a
  failed build needs a redeploy to take effect.
- A missing one **fails the build loudly**. `readPublicEnv()` throws rather than
  returning a default, so the failure is a build error naming the variable, not
  a silently empty shop. That is deliberate and it is the behaviour to expect.

The catalogue is therefore baked in at build time and revalidated every five
minutes at runtime, so a price changed in the dashboard does not need a
redeployment — `npm run verify:cache` proves that path.

### Never set on Vercel

`BASE_URL`, `QA_ONLY`, `DSF`, `INSPECT_REAL_SHEET`, `SYNC_STEP_A` … `SYNC_STEP_H`.
These arm local QA and the staged sync operations. On a deployment they are
meaningless at best.

### How the values get there

Through the **Vercel dashboard**, pasted by Ibrahim from his own `.env.local`
(Vercel's environment-variable screen accepts a pasted `.env` block). They are
not typed into a terminal, not passed as CLI flags, and never sent to Claude.
`.env.local` is git-ignored and stays that way.

## 4. Supabase Auth on a deployment

**Signing in needs no configuration.** The dashboard uses
`signInWithPassword`, which is a direct API call with no redirect, so it works
from any origin the moment the two `NEXT_PUBLIC_SUPABASE_*` variables are set.

**Invitations and password resets are built, as of Build 11.** Three routes, and
each exists because a link can arrive in more than one shape:

| Route | Handles |
| --- | --- |
| `/admin/forgot-password` | asks Supabase to email a link. One screen for "I forgot mine" and "I never had one", because those are our words for the same need |
| `/admin/auth/callback` | the `?code=` shape (PKCE, when the flow started in this browser) and the `?token_hash=&type=` shape. Anything else it forwards, because the tokens may be in a fragment it cannot see |
| `/admin/set-password` | the **fragment** shape, read in the browser, which is the only place it exists |

That last one is the subtle half. Supabase delivers an admin-generated link's
session as `#access_token=…`, a fragment is never transmitted to a server, and
`@supabase/ssr` builds its browser client with `flowType: "pkce"` — whose own URL
detection looks for `?code=` and **ignores hash tokens entirely**. So the
fragment is parsed by hand and handed to `setSession`. Every server-side test
passed while a real person still landed on a page that said their link was
broken; it took driving a real browser to find.

All three are in the middleware's public allow-list, because reaching them is how
somebody with no password gets one. `npm run qa:deployed` asserts that on the
deployment, since an allow-list that is right locally and wrong in production
locks out every invited staff member with no way back.

### What Supabase needs configuring

- **Authentication → URL Configuration → Site URL**: the staging URL
- **Redirect URLs**, these two exact paths and no wildcard:
  - `https://<staging-host>/admin/set-password`
  - `https://<staging-host>/admin/auth/callback`

A wildcard such as `https://*.vercel.app/**` would let any deployment on the
whole of Vercel receive a token minted for this project. Add the exact hosts that
need it, one line each.

Until it is set, a link emailed from the deployed site points at whatever the
Site URL currently says — which is still somebody's laptop.

## 5. Proving a deployment

Two gates, and they check different things.

```bash
BASE_URL=https://<staging-host> npm run qa:screenshots   # layout, touch, overflow, dashboard
npm run qa:deployed -- https://<staging-host>            # only true on a real deployment
```

`qa:deployed` is Build 11's, and every check in it is something that is true on
localhost by accident:

- the security headers actually arrive over HTTPS
- `robots.txt`, the `noindex` meta tag and the `/admin` `X-Robots-Tag`
- five `/admin` routes redirect a stranger to sign-in
- both job endpoints answer **401** with no credential and with a wrong one
- **no server secret is in anything a browser can download** — the homepage and
  every `_next/static` bundle it loads are scanned for a PEM header, a
  `…iam.gserviceaccount.com` address, a JWT claiming `service_role`, and the
  secret variable names beside a value. Only the rule that matched is ever
  printed, never the match
- the public Supabase URL *is* present, because its absence would mean the
  browser cannot reach the database at all
- product photographs really load from Supabase Storage, and prices render
- all six pages answer in both languages and `/sw` declares `lang="sw"`

It exits non-zero on any failure. Rehearsed against `http://localhost:3000`:
**32 checks, 0 failures.**

## 6. What is deliberately not done

**No Content-Security-Policy yet.** This application loads photography from
Supabase Storage, opens XHR and websockets to a Supabase project, and serves two
Google fonts. A CSP written without measuring those origins breaks images,
sign-in or both, and a broken CSP is normally discovered by a customer. The
headers that cannot break anything are shipped; the CSP is final-hardening work
with a real measurement pass behind it.

**No sitemap.** `robots.ts` deliberately does not name one rather than point a
crawler at a 404. It belongs with the production domain.

**No schedule for anything.** Neither job endpoint is called by a cron, a Vercel
schedule, a Supabase job or anything else.

## 7. Production architecture — the plan, not the execution

Nothing below has been done. It is written now so that the decisions are made
deliberately rather than at the moment of launching.

### The database: a separate project

**Recommendation: create a new Supabase project for production.** Do not promote
the development project.

The development project is not a clean slate and should not pretend to be one.
It holds fixture orders placed by `scripts/seed-dev-orders.mjs`, four placeholder
delivery zones, QA staff logins, and an audit trail of every experiment since
Build 06 — including this build's. Those rows are append-only by design, so
"cleaning it up" is partly impossible and entirely inadvisable. A shop's first
order should be order one.

It also removes a whole class of accident: with two projects, a test that runs
against the wrong one fails a project-ref assertion instead of touching real
customers. Every script in this repository already refuses to run against
anything but `dyjhacbbedytcstxxjzl`; those guards become the thing that protects
production the day a second ref exists.

The cost is that the free tier allows two projects per organisation, so this is
still TZS 0.

### The order it has to happen in

1. **Create the project.** Region `ap-south-1`, matching development.
2. **Apply the migrations** — all 21, with `supabase db push`, in order, against
   the new ref. `db reset` is never used on a hosted project.
3. **Generate and check the types** against production; they must match
   development exactly, which is the proof the two schemas are the same.
4. **Bootstrap the Owner.** `jojo_claim_first_owner()` is single-use by
   construction: Ibrahim signs up and claims the seat before anybody else can.
   This must happen before the project is reachable by anybody else.
5. **Import the catalogue** with `scripts/import-catalogue.mjs`, from
   `imports/`, after §8's price and stock confirmations — not before. Importing
   unconfirmed prices into production is how unconfirmed prices get sold.
6. **Move the photography.** The images are in the development project's
   `product-media` bucket and are the deterministic output of
   `scripts/build-catalogue.mjs` from `imports/`. Re-running that build against
   production is preferable to copying bucket to bucket: it is reproducible, and
   it proves the source material still produces what is on the shelf.
7. **Set the real delivery zones** through the dashboard, replacing nothing —
   production has never had the placeholders.
8. **Set the shop's own details** on More → Settings.
9. **Google Sheet:** point production at the same Product Master. It is a human
   control surface, not a database, and a second copy of it would immediately
   disagree with the first. Staging then either stops syncing or keeps reading
   it — see below.
10. **Vercel Production environment** — same variable names, production values,
    plus `APP_ENV=production`, which is what turns indexing on.
11. **Custom domain**, then **Supabase Auth Site URL** updated to it.
12. Re-run both gates against the production URL before announcing anything.

### The Sheet, once there are two shops

The Product Master is Ibrahim's control surface and there is only one of him, so
there is only one sheet. Production owns it. Staging must then **never write to
it** — otherwise a test edit made in staging travels to the real shop.

The mechanism already exists: the sync is manual, and a deployment with no
`SHEET_SYNC_WEBHOOK_SECRET` and no Google credentials cannot reach Google at
all. Recommendation: **remove the Google variables from the staging environment
the day production starts syncing**, and let staging's Catalogue Sync screen
report that Google is not configured — which it already does gracefully.

### Rollback

- **The application**: Vercel keeps every deployment. Rolling back is promoting
  the previous one, and it is instant. This is why the deployed commit is
  recorded in §9.
- **The schema**: migrations are forward-only and none of them drops data. A bad
  migration is corrected by a new migration, never by editing an applied one.
- **The data**: Supabase Free retains daily backups for 7 days. That is the real
  limit of the free tier and it should be understood before launch: a mistake
  found on day 8 is not recoverable from a backup. The append-only ledgers
  (`order_events`, `inventory_movements`, `audit_events`) mean most mistakes are
  reconstructable from the record even so.

## 8. Launch readiness

### Technically ready

- Schema, 21 migrations, RLS across 30 tables, append-only ledgers
- Storefront in English and Kiswahili, 95 published products, real photography
- Guest checkout, atomic reservation, authoritative server-side pricing
- Track Order needing the number **and** the phone
- Admin: orders, products, stock, customers, delivery zones, website, settings,
  staff, catalogue sync
- Order lifecycle, payment recording, cancellation, both delivery-failure
  outcomes, amendment before dispatch
- Two-way Google Sheet sync with conflict detection, echo and stale-write
  protection, and stock that the Sheet can never move
- Reservation-expiry engine, doing nothing until configured
- 203 offline tests, 255 database tests, QA at five widths in both languages
- Security headers, staging noindex, closed-by-default job endpoints

### Needs Ibrahim — business input

1. **Final retail prices** — confirm every sellable price, or correct the master
   and re-import
2. **Physical stock quantities** — the imported figures are a spreadsheet
   snapshot, not a count of a shelf
3. **Real delivery areas and fees** for Dar es Salaam
4. **Reservation warning and expiry durations** — nothing expires until set
5. **Return and refund wording**, in his own words
6. **Real WhatsApp number**
7. **Real phone number**
8. **Real email address**
9. **Real business address**
10. **Final logo and brand assets**
11. **The production domain**
12. **`EP01-A01`** — the TSh 128 price, still not guessed
13. **`EP23-A02`** — an approved photograph with no Product Master row

*Not blockers, and decided against for V1: a global free-delivery spend
threshold, and a same-day delivery cut-off. Free delivery is per area; delivery
timing is confirmed with the order.*

### Needs building — engineering

1. ~~**Setting a password.**~~ **Done in Build 11.** An invited staff member can
   now choose a password and sign in, proved end to end in a real browser by
   `npm run verify:password-link`. It still needs the Supabase redirect
   configuration in §4 before it works on the deployment.
2. **Uploading a logo and product photographs** from the dashboard
3. **A sitemap**, with the production domain
4. **A Content-Security-Policy**, measured
5. **Reports** — the last "Coming soon" screen
6. **A schedule** for the sync and for reservation expiry
7. **`APP_ENV=production`** on the production environment — one variable, and
   the shop is invisible to Google without it

## 9. This deployment

*Filled in when the staging deployment exists. It records the URL, the exact
commit, and the outcome of both gates against it.*

| | |
| --- | --- |
| Vercel project | `ecoplus/jojo-usafi`, created 2026-09-11, GitHub connected |
| Staging URL | **https://jojo-usafi-staging.vercel.app** (a stable alias onto the latest preview deployment) |
| Vercel environment | **Preview**. Production is deliberately left with no variables at all, so an accidental production deploy fails the build loudly instead of quietly serving the development database as the real shop |
| Build | **succeeds** — 217 static pages, 95 product pages per language, read from the real catalogue at build time |
| Deployment protection | **Vercel Authentication stays on**, with a single **exception** for `jojo-usafi-staging.vercel.app`. Every other deployment is still private |
| `qa:deployed` | **38 checks, 0 failures** |
| `verify:password-link` | **passes** against the deployment |
| `verify:commerce` | **28 checks, 0 failures** — a real order placed, tracked, amended, delivered and paid |
| Step I sync | **passes** — both directions, and the Sheet still cannot move stock |
| `verify:cache` | **passes** — a price saved in the dashboard reaches the shop immediately |
| `verify:website` | **11 checks, 0 failures** — an Owner's announcement reaches both languages of the deployed shop; clearing it restores the site's own wording; a Manager is refused |

### Variables set so far

`NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` ·
`NEXT_PUBLIC_SITE_URL` · `APP_ENV=staging` · `SUPABASE_SERVICE_ROLE_KEY` ·
`GOOGLE_SHEETS_SPREADSHEET_ID` · `GOOGLE_SHEETS_TAB`

The two Supabase keys were moved directly from the Supabase CLI into Vercel
through a pipe, so neither value was ever displayed, logged or written to disk.
The spreadsheet id and tab were already committed in this repository.

`GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` were
added by Ibrahim from his own `.env.local`, and the deployed Catalogue Sync
screen now reaches Google — proved by Step I, which syncs the real Product
Master in both directions from the deployed dashboard.

**Still unset, deliberately:**

| Variable | Consequence |
| --- | --- |
| `SHEET_SYNC_WEBHOOK_SECRET` | `/api/sync/catalogue` refuses every request — the correct closed state until something is scheduled |
| `RESERVATION_EXPIRY_JOB_SECRET` | `/api/jobs/expire-reservations` likewise |

Nothing schedules either endpoint, and an endpoint with no secret is shut.
`qa:deployed` asserts both answer 401 to a request with no credential **and** to
one with a wrong credential.

## 10. Deployment protection, and how automation reaches it

Vercel Authentication is **on** for this project, as it is by default for a
team. Left alone it answers every route — the storefront included — with a 302
to `vercel.com/sso-api`, so neither gate can run and no customer flow can be
tested.

The resolution was a **Deployment Protection Exception** for exactly one domain:

```
jojo-usafi-staging.vercel.app
```

Every other deployment of this project stays private behind Vercel
Authentication. No bypass secret was created, no protection was disabled
project-wide, and no paid feature was enabled — exceptions are free on all
plans.

Staging is therefore publicly reachable, and is kept out of search results by
the three mechanisms in §2 rather than by Vercel's login.

## 11. What the deployment was actually proved to do

Everything below ran against `https://jojo-usafi-staging.vercel.app`, not against
localhost.

| Gate | Result |
| --- | --- |
| `npm run qa:deployed -- <url>` | **38 checks, 0 failures** — headers over HTTPS, robots and noindex, five `/admin` routes redirecting a stranger, the three password routes reachable *without* a session, both job endpoints answering 401 with no credential and with a wrong one, no server secret in any downloadable bundle, real Storage photography, both languages |
| `BASE_URL=<url> npm run verify:password-link` | an emailed link lets somebody choose a password and sign in; a switched-off staff member is shut out and told why |
| `BASE_URL=<url> npm run verify:commerce` | **28 checks, 0 failures** |
| `DEPLOY_URL=<url> SYNC_STEP_I=1 npm run sync:op -- tools/sync/i-deployed-round-trip.op.ts` | the deployed dashboard syncs the real Product Master both ways, and the Sheet still cannot move stock |
| `BASE_URL=<url> npm run verify:cache` | a price saved in the dashboard reaches the shop immediately |
| `BASE_URL=<url> npm run qa:screenshots` | layout, touch targets and locale stability at 390/430/768/1024/1440, storefront and dashboard |

### The customer journey, on the deployment

A real order placed through the deployed checkout — product page, cart,
checkout, an authoritative quotation, an order number, and the confirmation. The
total was priced by the shop, not the browser. It was then tracked with the
number **and** the phone, and refused when the phone was wrong.

Staff signed in, amended it before dispatch (the extra unit reserved, not
conjured), and took it Confirmed → Preparing → Out for delivery → Completed with
cash. The amend control was gone once it was with the rider. Four more orders
covered the other endings: a digital payment with its reference, a cancellation
that released the stock it held, and delivery failing both with the items
returned and with them written off.

Afterwards every product's running total still reconciled with its ledger, and
the fixtures were removed by exact phone number, with the shelf provably back
where it started.

### Stock, once more, from the deployment

`STOCK QTY` set to **999,999** in the real Product Master and synced from the
deployed dashboard:

```
On hand            446 → 446
Reserved             1 → 1
Available          445 → 445
Ledger movements    12 → 12
```

The operator's own cell is left exactly as they typed it — `STOCK QTY` is
classified `database`, which means it is never READ as an instruction, not that
it is overwritten — and the real figure is reported into
`SYSTEM AVAILABLE STOCK` beside it.

### Two defects only a deployment could have shown

**An Owner could type exactly one character into any website copy field.**

`Pair` — the English/Kiswahili box pair — was declared **inside**
`WebsiteSettings`. A component declared inside another component is a new
component type on every render, so React cannot match it to the one before: it
unmounts the old tree and mounts a fresh one. The inputs are controlled, so every
keystroke re-rendered the parent, remounted the input, and took the cursor with
it. The blur that saves never fired on the element being typed in.

It survived review because it looks tidy, and it survived local QA because the
screenshot gate photographs screens rather than typing into them. It was found by
a script trying to fill in the announcement on the deployment.



**React hydration error #418, on the signed-in dashboard, at all five widths.**

`SyncManager` is a client component, so its first render happens on the server.
A server in Virginia formats the last-sync time as "14:22"; the same moment in
Dar es Salaam is "17:22". React compared the two, found different text, and
threw.

It could not have been found locally: in development the server and the browser
are the same laptop in the same timezone, so the strings always matched. The
fix renders nothing timezone-dependent on the first pass and fills the local
time in from an effect.

This is the single best argument for staging existing at all. It was found
within minutes of there being one.

## 12. Three things this deployment taught

**A conflicted row is frozen, and that will stop a test dead.** An aborted run of
the sync operation left a pending conflict on one product, and every later run
reported a broken sync — because the row was correctly refusing to move until a
person decided. The operation now settles its own leftovers and **fails loudly**
if it finds a disagreement that is not its own.

**`BASE_URL` is reserved by Vite.** Vitest sets `process.env.BASE_URL` to an
empty string, so a perfectly good `BASE_URL=https://…` arrives inside a
`tools/` operation as `""`. Anything under `tools/` takes `DEPLOY_URL` instead;
the plain Node scripts in `scripts/` still take `BASE_URL`, because none of them
runs under Vitest.

**Two gates must not share the QA staff account.** `qa:screenshots` and the
verification scripts each reset the development QA Manager's password when they
start. Run concurrently, the second one signs the first one out, and the first
reports "QA STAFF COULD NOT SIGN IN" — which looks exactly like a broken
dashboard. Run them one at a time, as `test:db` and `qa:screenshots` already
must be.

## 13. What only Ibrahim can do

All three of the previous items are **done**. What remains is business input —
see §8 — and, before any of this becomes production, the ordered procedure in
§7.
