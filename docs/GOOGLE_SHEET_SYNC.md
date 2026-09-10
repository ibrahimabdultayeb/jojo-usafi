# Google Sheet ↔ Supabase catalogue sync

Ibrahim edits the catalogue in a Google Sheet. The admin dashboard edits the same catalogue.
This document is how those two are kept saying the same thing without either quietly
overwriting the other.

**Supabase is the operational source of truth.** The storefront reads Supabase and only
Supabase; no customer request has ever touched Google, and none ever will. The Sheet is a
human-friendly control surface for the catalogue — it is not a second database, and it owns
nothing operational.

> **Status: connected, read and checked. No sync has been run.** The service account can
> open *Jojo Usafi Ecommerce Master Control* → *Product Master*, and a read-only dry run on
> 2026-09-10 read all 201 rows, validated every header and compared them with the shop. What
> a first real sync would write is **905 cells, every one of them a system report column** —
> not one of the operator's own cells. See *The first connection* below.

---

## What the sync will and will not do

| | |
| --- | --- |
| Reads the Sheet, applies safe changes to Supabase | yes |
| Writes Supabase's own changes back to the Sheet | yes |
| Reports stock, image and publish status into the Sheet | yes, into appended read-only columns |
| Takes stock levels **from** the Sheet | **never** |
| Deletes or archives a product because its row vanished | **never** |
| Picks a winner when both sides changed the same field | **never** — a person decides |
| Creates a product from a Sheet row | reports it; creation stays a deliberate act |
| Runs on a schedule | not yet — manual **Sync now** only |
| Blocks checkout or the storefront when Google is down | **never** |

---

## Field authority

Every one of the Product Master's 39 columns is classified in
[`src/lib/sheets/columns.ts`](../src/lib/sheets/columns.ts), which is the authority — this
table is rendered from it. **A column that file does not name stops the whole run**, rather
than being guessed at: a column nobody classified is a column nobody decided the safety of.

The five directions:

- **Both ways** — catalogue control. Either side may change it. If both changed the same one
  since they last agreed, that is a conflict.
- **Sheet → Jojo Usafi** — reference and structural metadata the Sheet owns.
- **Jojo Usafi → Sheet** — read-only reporting. Written by the database, never read back.
- **Jojo Usafi only** — operational truth. The Sheet may hold a stale copy; it is never an
  instruction.
- **Not synced** — present in the master, mapped to nothing, deliberately.

| Sheet column | Catalogue field | Direction | Why |
| --- | --- | --- | --- |
| `SKU` | `sku` | **Sheet → Jojo Usafi** | The identity. Matched exactly, never fuzzily, and immutable once a product exists. |
| `FAMILY CODE` | `familyCode` | **Sheet → Jojo Usafi** | Groups pack sizes into one product family. Structural; the dashboard does not edit it. |
| `ITF` | `itf14` | **Both ways** | Carton barcode. 14 digits or blank. |
| `EAN` | `ean` | **Both ways** | Retail barcode. 8 or 13 digits or blank. |
| `SUPPLIER` | `supplierName` | **Sheet → Jojo Usafi** | Internal. Resolves to a supplier row; never shown to a shopper. |
| `BRAND GROUP` | — | **Not synced** | Not modelled: the schema has brands and suppliers, and a third grouping has no home yet. |
| `PRODUCT BRAND` | `brandName` | **Both ways** | Resolves to an existing brand by name. An unknown brand is a sync issue, never a new brand. |
| `PRODUCT VARIANT` | `displayName` | **Both ways** | The descriptive product name the shelf shows. |
| `SIZE` | `packSizeLabel` | **Both ways** | Pack size as printed — 5LT, 500ML. |
| `SELLING UOM` | — | **Not synced** | Every row is sold as a unit; the schema has no unit-of-measure column. |
| `SYSTEM NAME` | — | **Not synced** | The operator's own internal label. Not a catalogue field. |
| `SHORT NAME` | — | **Not synced** | Unused by the storefront, which shows the full descriptive name. |
| `DESCRIPTION` | `description` | **Both ways** | Storefront copy, stored in product_content for the English locale. |
| `CATEGORY` | `categoryName` | **Both ways** | Resolves to an existing category by name. An unknown category is a sync issue. |
| `SUBCATEGORY` | — | **Not synced** | The schema has one level of category today. Modelling a second is a schema decision, not a sync one. |
| `TAGS` | — | **Not synced** | No tag model exists. Importing free text into nothing would lose it silently. |
| `WEBSITE STATUS` | `storefrontVisible` | **Both ways** | "Show" means visible. Anything else means not. |
| `PRICE TZS` | `priceTzs` | **Both ways** | Whole shillings. Validated exactly as the admin editor is. |
| `OFFER PRICE TZS` | `offerPriceTzs` | **Both ways** | Blank means no offer. Must be below the price, as the database CHECK also insists. |
| `STOCK QTY` | — | **Jojo Usafi only** | NOT AUTHORITATIVE. The ledger owns stock. A Sheet edit here moves nothing; the current figure is reported back instead. |
| `LOW STOCK THRESHOLD` | `lowStockThreshold` | **Both ways** | A merchandising setting, not a stock level. Safe in both directions. |
| `ALLOW BACKORDER` | — | **Not synced** | Out-of-stock ordering is not allowed and is not a per-product setting. |
| `AVAILABILITY MESSAGE` | — | **Not synced** | Availability wording is computed from real stock, never typed per product. |
| `DELIVERY CLASS` | — | **Not synced** | Delivery is priced by area, not by product class. |
| `IMAGE URL` | — | **Not synced** | Images live in Supabase Storage, matched on exact SKU. A URL here never becomes a product photograph. |
| `IMAGE ASSET KEY` | — | **Not synced** | Same: media mapping is by SKU and is not driven from the Sheet. |
| `CARD SIZE` | — | **Not synced** | A layout hint from an earlier design. The grid is uniform. |
| `BEST SELLER` | `bestSeller` | **Both ways** | Merchandising flag. |
| `FEATURED` | `featured` | **Both ways** | Merchandising flag. |
| `NEW ARRIVAL` | — | **Not synced** | No new-arrival flag in the schema; the shelf has no such row. |
| `PRODUCT PRIORITY` | `sortPriority` | **Both ways** | Display order within a listing. |
| `PRODUCT STATUS` | `lifecycle` | **Both ways** | Active / Hidden / Archived / Draft. Archiving from the Sheet is allowed; deleting is not. |
| `SEO SLUG` | `slug` | **Both ways** | The web address. Changing it changes a link customers may have saved. |
| `SEO TITLE` | — | **Not synced** | Page titles are generated from the product name today. |
| `META DESCRIPTION` | — | **Not synced** | Generated. A per-product override is a later decision. |
| `WEIGHT KG` | — | **Not synced** | No shipping-weight model: delivery is priced by area. |
| `DIMENSIONS` | — | **Not synced** | Same. |
| `TAX CLASS` | — | **Not synced** | Prices are VAT-inclusive retail shillings; no per-product tax model. |
| `NOTES` | — | **Not synced** | The operator's own scratch column. Deliberately untouched. |
| `SYSTEM AVAILABLE STOCK` | `availableStock` | **Jojo Usafi → Sheet** | What can actually be sold right now: on hand minus what is promised to open orders. |
| `SYSTEM IMAGE` | `imageStatus` | **Jojo Usafi → Sheet** | Whether an approved photograph is filed for this SKU. |
| `SYSTEM ON WEBSITE` | `publishStatus` | **Jojo Usafi → Sheet** | Whether a shopper can see and buy it right now. |
| `SYSTEM BLOCKED REASON` | `blockedReason` | **Jojo Usafi → Sheet** | Why it is not on the website, in plain words. Blank when it is. |
| `SYSTEM LAST SYNCED` | `lastSyncedAt` | **Jojo Usafi → Sheet** | When this row was last compared with Jojo Usafi. |

---

## Stock is never taken from the Sheet

This is the rule the whole design is arranged around.

The Product Master has a `STOCK QTY` column, and it was authoritative once. It is not any
more: the inventory ledger is. If somebody changes that cell from 10 to 1000, **the sync
creates no units** — it does not treat the cell as an instruction at all, in either
direction. What it does instead is write the shop's real figure into the read-only
`SYSTEM AVAILABLE STOCK` column beside it, so the Sheet shows the truth without being able
to dictate it.

Stock moves in exactly four ways, all of them already built and all of them ledger-backed:

- **Add stock** — a delivery arrived (`jojo_add_stock`, writes a `receipt`)
- **Set counted stock** — a stock take (`jojo_count_stock`, writes the *difference*)
- **A customer orders** — reserved (`jojo_place_order`)
- **An order completes, is cancelled, or fails delivery** — sold, released or written off

Proved by:

- `src/lib/sheets/plan.test.ts` — the plan contains no inventory field, ever
- `tests/db/10-sheet-sync.test.ts` — `STOCK QTY` set to 999,999 moves `on_hand` by nothing
  and adds **zero** rows to `inventory_movements`

## SKU is the identity

Exact match, and nothing else. No fuzzy name matching, no matching by row number, no
barcode-only identity, no guessing from a product name. A SKU is immutable once the product
exists — a database trigger refuses to change one that has been ordered.

A row with a **blank SKU** is reported and left alone. No SKU is invented, ever.
Two rows with the **same SKU** are both refused: that is two people describing different
products with one code, and neither can be applied.

## New rows

A SKU the shop has never seen is **reported**, not silently created. When creation is turned
on it will produce an internal, non-public record — `lifecycle = draft`, not visible, no
stock — and the existing publishability rules decide when it can be sold. A product with no
approved photograph, no valid price or missing identity data can never reach the storefront,
because `product_shelf` requires all three regardless of how the row got there.

**`EP23-A02` stays an orphan.** An approved photograph exists in Storage with no Product
Master row. An image does not create a product. It needs a real master row first.

**`EP01-A01` stays blocked at TSh 128.** The sync carries the value across as the unresolved
figure it is; it does not infer that 128 means 128,000, and it does not correct it. If
Ibrahim changes it deliberately, in either place, normal validation processes the correction
like any other edit.

## Rows that disappear

A product that is no longer in the Sheet is reported as *no longer in the sheet* and
**nothing else happens to it**. It is not deleted, not archived, not hidden.

Two reasons. Orders placed last week still point at it, and an order must never lose the
product it was for. And a row can vanish for reasons that have nothing to do with intent —
a bad sort, a filtered view, a row deleted by accident. Retiring a product is a deliberate
act, done in the Product editor.


## The first connection — 2026-09-10

A read-only pass against the real *Product Master*. It wrote nothing: the gateway was wrapped
in a proxy whose write methods throw, so the safety of the pass did not depend on the dry-run
flag being honoured. Repeatable as
`INSPECT_REAL_SHEET=1 npx vitest run --config vitest.db.config.ts tests/db/11-real-sheet-inspection.test.ts`.

### What is there

| | |
| --- | --- |
| Rows returned | 202, one of them the header row |
| Data rows | 201 |
| Columns | 39 — every one recognised, none unknown, none missing |
| Rows read cleanly | 200 |
| Unique SKUs | 200 |
| Duplicate SKUs | 0 |
| Rows with a problem | 1 |
| Prices differing from the shop | **0** |

The one problem is **EP04-A01**, row 50: its `PRODUCT PRIORITY` cell contains the text `True`
— a boolean pasted into a number column. The row is refused, reported, and nothing about that
product is touched. Its price, name and status are all fine; only the one cell is wrong.

### Two faults this pass found, both now fixed

**A first sync would have overwritten Ibrahim's own columns.** The original first-meeting rule
was "the database is the operational truth, so bring the sheet up to it". Against real data
that meant rewriting **105 `WEBSITE STATUS` cells from `Show` to `Hide`**, and **14
`PRODUCT PRIORITY` cells to `0`**.

Neither database value was a decision anybody had made. All 105 products are hidden because
the Build 07 importer found no approved photograph — not because anyone chose to hide them.
The `0` priorities are a column default for a field that was never imported at all. Ibrahim's
`Show` and his 1–6 ordering were the only stated intentions in either pair, and they would
have been destroyed silently, in his own columns, on the first press of the button. Worse:
when photographs later arrived, the sheet would have said `Hide` and nothing would have put it
back.

**The rule is now: on a first meeting, neither side wins.** Nothing flows in either direction.
The run records what the database holds as the agreed base and writes only the read-only
system columns. From the second run on, a real edit reads as a real edit — so those 105 `Show`
values will appear as genuine sheet changes, visible in a dry run, and can be applied
deliberately.

**A row that could not be read was also reported as missing from the sheet.** EP04-A01 was
counted under both headings at once. A row with a problem is not an absent row, and conflating
the two is how somebody ends up retiring a product that never went anywhere. Rows are now
marked seen before they are validated.

### What a first real sync would do today

| | |
| --- | --- |
| Sheet → Supabase | **0 changes** |
| Supabase → Sheet | 200 rows, **905 cells** |
| Conflicts | 0 |
| New SKUs in the sheet | 0 |
| Products missing from the sheet | 0 |
| Rows needing attention | 1 (EP04-A01) |

Every one of those 905 cells is a system report column:

| Column | Cells |
| --- | --- |
| `SYSTEM AVAILABLE STOCK` | 200 |
| `SYSTEM IMAGE` | 200 |
| `SYSTEM ON WEBSITE` | 200 |
| `SYSTEM LAST SYNCED` | 200 |
| `SYSTEM BLOCKED REASON` | 105 |

Plus five header cells, appended to the right of the existing 39 columns. **No column of
Ibrahim's is written, moved, renamed or reordered.**

### Stock

The dry run proposed **zero** changes of any kind to the shop, so the stock question is
settled twice over: no inventory field appears in any proposed change, and `STOCK QTY` is not
among the cells that would be written. The sheet's stock snapshot stays exactly as Ibrahim
typed it, and the shop's real availability appears beside it in `SYSTEM AVAILABLE STOCK`.

### The two watchlist SKUs

**EP01-A01** — in the sheet at row 2 at TSh 128; in the shop at TSh 128, off the website,
blocked for *no approved photo* and *switched off*. The sync proposes no change to it. The
figure is neither corrected nor multiplied.

**EP23-A02** — not in the sheet at all, and not in the shop. Still an approved photograph with
no product. The sync proposes nothing; an image does not create a product.

## Conflicts

A conflict is precisely one thing: **the same field changed on both sides since they last
agreed**. Not "the two differ" — differing is normal and is exactly what a sync is for.

- Sheet changes the name, dashboard changes the price → **merged**, no conflict.
- Sheet changes the price to 10,000, dashboard changes it to 12,000 → **conflict**. Neither
  is applied. Neither is defaulted to. There is no last-write-wins anywhere in this system.

The comparison is three-way: the Sheet's value, the database's value, and the **base** — what
the two last agreed on. Without the base a change cannot be told apart from a value that was
simply always different, which is the mistake that makes naive syncs lose data.

**On a first meeting there is no base, so neither side wins.** Nothing flows either way; the
run records the database's values as the agreed base and writes only the read-only system
columns. From the next run on, a real edit reads as a real edit. See *The first connection*.

An open conflict **freezes that product**. Later runs neither re-raise it nor quietly pick a
side; the row waits for a person.

**Resolution** happens on *Admin → More → Catalogue sync*, and only for an Owner or a
Manager. Each conflict shows the product, the field, both values, and two equally weighted
buttons. Choosing records who decided and when, writes the chosen value, and clears the
frozen state so the next sync carries the decision to the other side.

## Echo, staleness and idempotency

Three things keep the loop from spinning, all from `src/lib/domain/sync.ts` (Build 05, 35
unit tests):

- **Echo** — the incoming values carry the fingerprint we last wrote to that side, so this is
  our own handwriting coming back. It contributes nothing in that direction. It does **not**
  stop the *other* direction: a dashboard change still reaches a Sheet that happens to be
  showing our last write. (That distinction was a real bug, caught by a test.)
- **Stale write** — the row was edited against a version we have already moved past. Reported,
  not applied, so it cannot silently undo whatever changed in between.
- **Idempotency** — every job and every event carries an idempotency key built from what the
  instruction *is*, not from when it arrived, so the same instruction twice is one change.

Running the sync twice in a row makes **zero** writes the second time, and the second run
writes no Sheet cells at all — only cells whose value actually differs are written.

## Audit

Every run writes to the four sync tables from migration `0007`:

| Table | Holds |
| --- | --- |
| `sync_jobs` | one row per run: who asked, started, finished, status, rows seen / applied / skipped / failed, the error if it failed |
| `sync_events` | one row per attempted change: direction, operation, SKU, sheet row, the fields, **the values before and after**, status, error |
| `sync_state` | the last agreed fingerprint per SKU, per side — the loop breaker |
| `sync_conflicts` | the disagreements, who resolved each and when |

Between them they answer: *what changed, which direction, which field, from what to what, and
was it automatic or decided by a person.* All four are readable by an Owner or a Manager and
by nobody else; none of them is writable from a browser token.

**No credential is ever written to any of them**, or to a log line, or to an error message.
Google's own error text is passed through and truncated; a key-parsing failure is reported
without the exception, because a `node:crypto` key error can echo part of the key.

## When Google is unavailable

Nothing happens to the shop.

- the storefront keeps serving from Supabase
- checkout keeps taking orders
- admin order operations keep working
- admin product edits keep saving to Supabase and revalidating the storefront
- the sync is recorded as **failed**, with a retry still possible

None of those paths import the sync module at all, and no Google call is ever made inside a
customer request. If the Sheet write half of a run fails after the database half succeeded,
the database half stands and the Sheet catches up next run — the two halves are applied
separately for exactly that reason.

Admin product edits say **Saved** as soon as Supabase has them. They never wait on Google,
and the product editor says plainly that Sheet sync is not connected rather than showing a
reassuring "Synced".

## Efficiency

- **One** read for the whole tab, per run.
- **One** batched write for every changed cell, per run — never a call per cell.
- Only cells whose value actually differs are written; the operator's own columns are never
  rewritten with values they already hold.
- The report columns are **appended** to the right of the existing layout, never inserted,
  never reordering anything.
- The access token is minted once per run and cached.
- Google is never polled from a customer page request.

## Running it

**Admin → More → Catalogue sync**, Owner or Manager only (`catalogue.sync`).

- **Sync now** — reads, applies, writes back, records.
- **Check first, change nothing** — the same run with the applier switched off. A dry run
  reads the Sheet and reports exactly what would happen.

The screen shows: connected or not, when it last ran and how it went, how many products, how
many need a decision, and how many rows need fixing. The outcome is a sentence — *"Sync
complete. 3 products updated from the sheet. 1 product needs a decision."* — never JSON.

### The protected endpoint

`POST /api/sync/catalogue` exists so that a schedule, when one is decided, has something safe
to call. It requires `Authorization: Bearer <SHEET_SYNC_WEBHOOK_SECRET>`, compared in
constant time.

**Unset, or shorter than 16 characters, the endpoint refuses every request.** A deployment
that forgets to configure it is closed, not open. There is no anonymous catalogue-sync
endpoint. `?dryRun=true` is supported.

**Nothing schedules it.** No cron, no Apps Script poller, no paid scheduler — Build 09 ships
manual syncing on purpose, because automation nobody watches is worse than a button somebody
presses.

## Connecting it

**This is done.** The Google Cloud project *Jojo Usafi Sheets Sync* exists, the Sheets API is
enabled, and the service account `jojo-usafi-catalogue-sync@…` has Editor access to that one
spreadsheet and nothing else. The four values live in the git-ignored `.env.local`, and the
downloaded JSON key has been deleted. No billing account was involved at any point.

The steps are kept below for the day the shop moves to a production project.

Human-only setup, in this order. **Everything here is free** — the Google Sheets API has no
cost at this scale and no billing account is required.

1. **A Google Cloud project.** console.cloud.google.com → new project (any name).
2. **Enable the Google Sheets API** for it. APIs & Services → Library → "Google Sheets API" →
   Enable. Do **not** enable the Drive API; it is not needed and would widen the access.
3. **Create a service account.** APIs & Services → Credentials → Create credentials →
   Service account. No roles are needed — it gets its access from the Sheet itself, not from
   the cloud project.
4. **Create a JSON key** for that service account and download it. It contains
   `client_email` and `private_key`.
5. **Share the spreadsheet with the service account.** Open the Product Master → Share →
   paste the `client_email` → **Editor**. This is the only access it will ever have: one
   spreadsheet, shared the way it would be shared with a colleague.
6. **Fill in `.env.local`** — never the repository, never a chat message:
   - `GOOGLE_SHEETS_SPREADSHEET_ID` — the long id in the sheet's URL, between `/d/` and `/edit`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` — `client_email` from the JSON
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` — `private_key` from the JSON, with its newlines
     written as the two characters `\n`
   - `GOOGLE_SHEETS_TAB` — the tab name, if it is not `Product Master`
   - `SHEET_SYNC_WEBHOOK_SECRET` — only if the protected endpoint will be used
7. **Delete the downloaded JSON** once the values are in `.env.local`.

Then open **Catalogue sync** and press **Check first, change nothing**. It will read the real
sheet, validate the headers and report exactly what a real sync would do, without touching
anything.

### Never commit

Private keys, the service-account JSON, OAuth tokens, the webhook secret. `.env.local` is
gitignored; `.env.example` holds names and placeholders only.

## Future work

- **Creating products from the Sheet.** Reported today; the writing half needs brand, category
  and family to resolve to existing rows, and a decision about what happens when they do not.
- **A schedule.** The endpoint is ready; the deployment architecture is not.
- **Kiswahili product content.** `product_content` is per-locale; the master has one language.
- **Media.** Images stay matched on exact SKU in Supabase Storage. A Sheet image URL never
  becomes a product photograph — the workflow for changing a photo is a separate, deliberate
  build.
