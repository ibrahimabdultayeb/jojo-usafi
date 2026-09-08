# Data Model

The final **Supabase PostgreSQL** schema will be documented here. Firebase/Firestore is
permanently unapproved — see `docs/DECISIONS.md`, 2026-09-08.

**No schema exists yet.** No Supabase project, migration or table has been created.

## Expected tables

```
products              brands                suppliers
categories            product_images        inventory_movements
customers             addresses             delivery_zones
carts                 cart_items
orders                order_items           order_events
promotions            discounts
admin_users           admin_roles
site_content          translations
sync_jobs             sync_log              audit_log
analytics_events
```

## Identity

**SKU is the unique, stable product identifier.** It is never silently rewritten once it
has been used on an order. Everything — image matching, cart lines, order lines and the
Google Sheet sync — keys off it.

## What the built catalogue already models

`src/lib/catalogue/types.ts` is shaped like the intended tables, so the eventual migration
is a port rather than a redesign:

| Type | Becomes |
| --- | --- |
| `Product` | `products` (+ `publishable` and `flags` as validation columns) |
| `ProductImage` | `product_images`, with `source` kept as the approval audit trail |
| `Brand`, `Supplier`, `Category` | their own tables |
| `CartLine` | `cart_items` |

`ProductFlag` is the validation vocabulary the Sheet ↔ Supabase sync will reuse, so a bad
row is caught before it is written rather than after.

## Authorization

Row Level Security is the authorization boundary, not application code. Policies will be
written and tested alongside the schema:

- public read of publishable catalogue rows only
- customers read and write only their own carts, orders and addresses
- admin access scoped by role — Owner / Manager / Order Staff
- sync service writes through a dedicated, audited role

## Localisation

Interface copy lives in the application (`src/lib/i18n/dictionaries`). Catalogue content is
English-only in the Product Master today; a `translations` table will carry Kiswahili
product content when it exists. Until then the storefront falls back to English rather than
inventing translations.
