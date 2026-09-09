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

## Stock rules — as the dashboard applies them (Build 08C)

**Stock is never typed over.** There are exactly two ways an operator changes it, and both
write a movement to the append-only ledger with who, when, how many and why:

| Control | Means | Ledger |
| --- | --- | --- |
| **Add stock** | *this many arrived* — added to what is there | a `receipt`, carrying the delivery note or invoice number if one was given |
| **Set counted stock** | *this is what is actually on the shelf* | an `adjustment` for the **difference**, never the total |

A count that matches the system writes nothing and says so. A count that differs **must say
why** — the database refuses one without a reason — so a missing bottle and a mistyped
number do not look identical a month later. The reasons are offered as four buttons, not a
text box: an operator on a phone will tap, and free text cannot be counted.

**The dashboard shows AVAILABLE stock**, not what is physically in the store. Ten bottles
with ten promised to open orders cannot be sold, so the product list, the badges and the
"out of stock" and "low stock" filters all count `available`. The breakdown — on the shelf
versus set aside — is shown on the product only when something is actually reserved.

**A failed delivery asks where the goods are.** Returned to the shop: nothing moves, and the
order still holds its reservation so it can be sent out again. Not returned: `on_hand` falls
by the quantity, a `damage_loss` movement records the write-off, and the reservation is
released. There is no default answer, because guessing it invents or loses inventory.

## Product rules — as the dashboard applies them

- **The SKU never changes.** It is read-only in the editor, and the database refuses to
  change one that has been ordered.
- **There is no delete.** A product that is gone is **archived**, which also takes it off the
  website — an archived product that is still buyable is a contradiction a customer would
  find. Archiving is reversible.
- **An offer price must be lower than the price.** Said in the editor as a sentence and
  enforced as a database CHECK, so neither can be the only guard.
- **A price change reaches the shop immediately.** The storefront shelf is cached for five
  minutes, and saving a product invalidates that cache rather than waiting it out.
- **Nothing claims to be synced.** There is no Google Sheet write-back yet, so the editor
  says "Saved" and, separately, "Product sheet sync: not connected yet". A badge reading
  "Synced" would be the dashboard lying about where the truth is.

## Who may do what

| | Owner | Manager | Order staff |
| --- | :-: | :-: | :-: |
| See and work on orders — confirm, prepare, dispatch, complete, cancel, delivery-failed | ● | ● | ● |
| Record a payment | ● | ● | ● |
| See customers | ● | ● | ● |
| Prices, offers, stock, website visibility | ● | ● | |
| Delivery zones, website content, reports | ● | ● | |
| Add, remove or change staff | ● | | |
| Shop settings | ● | | |

**A Manager cannot promote themselves to Owner**, and neither can Order staff: the
`admin_profiles` update policy admits only an Owner. **The last Owner cannot be demoted,
deactivated or deleted.** Both are enforced in the database, not in the screens — the
dashboard hides controls as a courtesy, and Row Level Security is what refuses.

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
