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
unapproved. The schema is authored (Build 05) but has not been applied to a database.

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

## Order rules — implemented in Build 05

Approved states:
`new` · `awaiting_confirmation` · `confirmed` · `preparing` · `out_for_delivery` ·
`completed` · `cancelled` · `delivery_failed`. Staff never see these names; the dashboard
shows plain-language labels and one obvious next action.

Payment:
The customer chooses **Cash on delivery** or **Pay digitally on delivery**. What actually
happened is recorded separately, as **Cash** or **Digital**, because a customer may say one
and do the other. A digital payment requires its transaction reference. **An order cannot be
completed until the payment has been recorded** — enforced both in the application and as a
database constraint.

Delivery fee:
A newly created delivery area starts at **TSh 4,000**. This is a starting value for a new
area, not a fixed price; each area is edited in the admin dashboard. An area marked "free
delivery" must have a fee of 0, so a free area can never leak a charge onto a total.

Money:
Every amount is a whole number of shillings. `total = subtotal − discount + delivery fee`.

Stock:
Available stock is `on hand − reserved` and can never go negative. Stock cannot be promised
to two orders at once.

### Two judgement calls awaiting confirmation

Both are implemented as described and are cheap to change:

1. **A failed delivery is not the end of the order.** `delivery_failed` can go back to
   `out_for_delivery` (try again) or to `cancelled`. The alternative — a failed delivery
   ending the order outright — would force staff to re-key the whole order to retry.
2. **An order can be cancelled at any point before it is dispatched**, and after a failed
   delivery, but not once it is out for delivery or completed.

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

## Production blockers — must be confirmed before launch

Added in Build 08, when the shop became able to take an order. Development is not
blocked by any of these; going live is.

**The figures the shop would sell on.** The Product Master's prices and stock quantities are
being treated as authoritative *for the development environment*. They are not
production-verified, and the first real order would be priced from them.

- [ ] **Final retail prices.** Confirm every sellable price, or correct the master and re-import.
- [ ] **Current physical stock quantities.** The 12,822 units imported are a snapshot of a
      spreadsheet, not a count of a shelf. Once real orders exist, the ledger is the
      authority and a re-import will not overwrite it — so this has to be right *before*
      the shop opens, not after.
- [ ] **`EP01-A01`** — the TZS 128 price. Still blocked and still not guessed.
- [ ] **`EP23-A02`** — still an approved photograph with no Product Master row.

**The rules a customer would be held to.**

- [ ] **The real delivery zones and their fees.** Four development placeholders exist
      (`scripts/seed-dev-zones.mjs`), each carrying a `notes` value saying so. They must be
      replaced through the admin Delivery Zones screen.
- [ ] **Free-delivery threshold** and **same-day cut-off time** — still unset.
- [ ] **Reservation expiry durations.** `shop_settings.reservation_warning_minutes` and
      `reservation_expiry_minutes` are deliberately null: how long an unconfirmed order may
      hold stock is a business decision, and a default would be a guess. Until they are set,
      nothing expires and reservations are released only by cancellation.
- [ ] **Return and refund wording**, in the customer's own words, for the storefront and for
      what staff say on the phone.

**The shop's own details.**

- [ ] Real WhatsApp number, phone, email and address.
- [ ] The Jojo Usafi logo.
