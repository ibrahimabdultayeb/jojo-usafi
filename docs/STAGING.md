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
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Preview + Production | no | the public key; RLS is what protects the data, not this |
| `NEXT_PUBLIC_SITE_URL` | Preview + Production | no | absolute base for canonical and `hreflang` URLs — **the deployment's own URL** |
| `APP_ENV` | Preview + Production | no | `staging` on staging. Only `production` disables the noindex |
| `SUPABASE_SERVICE_ROLE_KEY` | Preview + Production | **yes** | server-only; bypasses RLS entirely |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Preview + Production | no, but not public | which service account the Sheet is shared with |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Preview + Production | **yes** | the PEM. Never printed, never logged, never in a bundle |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Preview + Production | no, but not public | the one approved spreadsheet |
| `GOOGLE_SHEETS_TAB` | Preview + Production | no | `Product Master` |
| `SHEET_SYNC_WEBHOOK_SECRET` | Preview + Production | **yes** | ≥ 16 chars, or `/api/sync/catalogue` refuses everything |
| `RESERVATION_EXPIRY_JOB_SECRET` | Preview + Production | **yes** | ≥ 16 chars, or `/api/jobs/expire-reservations` refuses everything |

**Nothing server-side may ever be given a `NEXT_PUBLIC_` name.** That prefix is
an instruction to Next.js to inline the value into the JavaScript bundle. The
deployed check in §5 looks for exactly that mistake.

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

**Invitations and password resets are a different matter, and are not finished.**
`inviteUserByEmail` sends a link back to the project's **Site URL**, and this
application has no route that answers such a link — there is no
`/auth/callback`, no set-password screen and no "Forgot password" on the sign-in
form. So an invited person receives an email, follows it, lands on the
storefront homepage and nothing happens.

That is recorded as a launch blocker in §8 rather than papered over, and the
messages in the dashboard were corrected in Build 11 to say so: Build 10 told
the Owner to send people to "Forgot password", a control that does not exist.

When that screen is built, the Supabase configuration it needs is:

- **Authentication → URL Configuration → Site URL**: the staging URL
- **Redirect URLs**: only the exact callback path on the staging origin, e.g.
  `https://<staging-host>/admin/set-password`

A wildcard such as `https://*.vercel.app/**` would let any deployment on the
whole of Vercel receive a token minted for this project. Add the exact hosts
that need it, one line each.

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

1. **Setting a password.** An invited staff member cannot sign in. Needs a
   callback route, a set-password screen, "Forgot password" on the sign-in form,
   and the Supabase redirect configuration in §4. **This blocks every staff
   account except Ibrahim's own.**
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
| Vercel project | not created yet — needs `vercel login` (§10) |
| Staging URL | — |
| Commit deployed | — |
| `qa:deployed` | rehearsed locally: 32 checks, 0 failures |
| `qa:screenshots` against the URL | — |

## 10. What only Ibrahim can do

The Vercel CLI on this machine is **logged out**, and logging in requires a
browser and an account choice. Nothing about the deployment can proceed without
it.

```bash
vercel login
```

Then either connect `ibrahimabdultayeb/jojo-usafi` from the Vercel dashboard, or
say so and the rest — linking, the non-secret variables, the deployment and both
gates — is done from here. The secret values are pasted by Ibrahim into the
Vercel dashboard and are never sent to Claude.
