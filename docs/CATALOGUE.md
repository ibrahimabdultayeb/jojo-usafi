# Catalogue Pipeline

How the Jojo Usafi shelf is built from the restored source inputs, and the rules that
decide what a customer is allowed to see.

Run it with:

```bash
npm run catalogue:build     # rebuild assets, generated data and the report
npm run catalogue:check     # verify the committed output still matches the sources
```

## Sources

| Path | What it is |
| --- | --- |
| `imports/jojo-usafi-product-master.csv` | Product Master, 201 rows, 39 columns |
| `imports/white-bg-products/` | 96 approved white-background PNGs |

`imports/` is **source-only and excluded from Git**. It is read, never written. Everything
the application uses is generated from it and committed.

## Output

| Path | What it is |
| --- | --- |
| `public/products/<SKU>.webp` | one approved photo per publishable SKU (800px, white-flattened) |
| `src/lib/catalogue/generated/catalogue.json` | brands, categories, suppliers and **all 201 rows** |
| `src/lib/catalogue/generated/report.json` | machine-readable validation report |
| `docs/CATALOGUE_REPORT.md` | the same report, for people |

The build is **deterministic**: no timestamps, stable ordering, identical bytes on a rerun.
`npm run catalogue:check` fails if the committed output has drifted from the sources.

## Identity rules

1. **SKU is the only identity key.** An image is matched to a product by the exact leading
   SKU token of its filename (`EP01-A02 - 5L Multix ….png` → `EP01-A02`).
2. **No fuzzy matching.** Product names are never compared. A near-miss is a miss.
3. **No borrowed photographs.** A product without its own approved image is never given
   another SKU's picture — it is withheld instead.
4. **Nothing is invented.** Prices, stock, descriptions, categories and product identity
   come from the master or do not appear at all. 200 of 201 rows have no description, and
   those products simply show none.

## What reaches a customer

A row is `publishable` only when it carries none of these blocking flags:

| Flag | Meaning |
| --- | --- |
| `MISSING_APPROVED_IMAGE` | no approved photo matched this SKU |
| `PRICE_MISSING` | no usable price |
| `PRICE_IMPLAUSIBLE` | price below TZS 1,000 — cannot be a genuine retail price here |
| `BRAND_UNRESOLVED` / `CATEGORY_UNRESOLVED` | the row does not resolve against the master |
| `WEBSITE_STATUS_NOT_SHOW` / `PRODUCT_STATUS_NOT_ACTIVE` | the master says do not sell it |

`PRICE_INVERSION` (a larger pack priced below a smaller one in the same family) is recorded
as a **warning only** and does not withhold a product.

All 201 rows stay in `generated/catalogue.json` with their flags. `queries.ts` filters to
`publishable` before anything reaches the UI, and `getAllProductRecords()` exposes the full
set for validation work only.

## Current state

| | |
| --- | --- |
| Master rows | 201 |
| Approved images | 96 |
| Exact SKU matches | 95 |
| **Publishable products** | **95** |
| Hidden — no approved image | 106 |
| Orphan images (no master row) | 1 — `EP23-A02` Spirix Methylated Spirit |

## Open items for Ibrahim

- **`EP01-A01` — Multix Multipurpose Detergent Lemon Fresh 20LT, listed at TZS 128.**
  Flagged `PRICE_IMPLAUSIBLE` and withheld. Its siblings sell at 34,000 (5LT) and 11,400
  (750ML), so 128 cannot be right — but the correct figure is commercial data and has
  **not been guessed or corrected**. The product stays hidden until Ibrahim confirms it.
- **`EP23-A02` — Spirix Methylated Spirit 5L.** An approved photograph exists with no
  matching master row. It is reported, never invented as a product. It needs a row in the
  Product Master before it can sell.
- **106 products have no approved photograph** and are therefore not on the shelf. They
  need photography, not code.

## When Supabase arrives

This pipeline becomes the seed and validation layer rather than the runtime source:
`queries.ts` switches to async Supabase reads, `public/products/` moves to Supabase
Storage, and the same validation rules move into the Google Sheet ↔ Supabase sync so a bad
row is caught before it is written rather than after.
