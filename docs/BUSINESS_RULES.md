# Confirmed Business Rules

Store:
Jojo Usafi.

Market:
Tanzania only.

Currency:
TZS.

Languages:
English (default) and Kiswahili. Cart = **Kikapu**, Checkout = **Kamilisha Agizo**,
Order = **Agizo**.

Current catalogue:
EcoPlus.

Future non-EcoPlus brands:
Expected.

Admin:
Must be extremely simple for non-technical operators.

Primary device:
Mobile phone.

Backend:
Supabase PostgreSQL, Auth, Storage and Row Level Security. Firebase is permanently
unapproved. No backend work has started.

Catalogue:
Editable through both Google Sheets and the Jojo Usafi admin, synchronized both ways.

Orders:
Must exist in the database before any WhatsApp handoff.

WhatsApp:
Communication channel, not the system of record.

## Catalogue integrity rules

- SKU is the identity key. Images are matched on the exact SKU, never on product name.
- A product with no approved photograph is not shown to customers.
- Prices, stock, descriptions, categories and product identity are never invented.
- Data that looks wrong is flagged and withheld, never silently corrected.

## Open decisions — Ibrahim

These change how the store operates, so nothing has been assumed:

- delivery fee
- free-delivery threshold
- same-day cut-off time
- which Dar es Salaam areas are served
- loyalty / rewards scheme
- confirmed retail prices (the catalogue currently carries EcoPlus prices)
- **`EP01-A01` — the TZS 128 price on the 20LT Multix Lemon Fresh.** Flagged and withheld.
  Its 5LT sells at 34,000 and its 750ML at 11,400, so 128 cannot be right, but the correct
  figure has not been guessed. The product stays hidden until confirmed.
- **`EP23-A02` Spirix Methylated Spirit 5L** — an approved photograph exists with no
  Product Master row. It needs a row before it can sell.

Unresolved business decisions should be added to `docs/DECISIONS.md` once settled.
