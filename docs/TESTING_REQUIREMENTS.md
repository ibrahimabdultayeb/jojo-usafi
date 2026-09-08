# Testing Requirements

## The gate today

Every one of these must pass before a commit:

```bash
npm run typecheck        # TypeScript, no emit
npm run lint             # ESLint
npm run i18n:check       # en + sw key, placeholder and array parity
npm run catalogue:check   # committed catalogue still matches imports/
npm run build            # production build
npm run qa:screenshots    # needs a running server (npm run start)
```

## What the QA gate checks

`scripts/qa-screenshots.mjs` walks every key page in **both languages** at **390 / 430 /
768 / 1024 / 1440** and fails on anything a shopper would notice:

- horizontal overflow
- console errors and uncaught page errors
- broken or missing product images
- a product showing another SKU's photograph
- product images with no accessible name
- touch targets under 44px on touch viewports (the hit area accounts for stretched links)
- floating layers overlapping — the WhatsApp button and the mobile cart dock
- the hero down control failing to scroll, or failing to move focus
- the first-visit language chooser failing, or reappearing after a choice
- the EN/SW switcher losing the page, the query string or the cart
- a withheld product (`EP01-A01`) being reachable
- an orphan image (`EP23-A02`) or any unapproved photo reaching the shelf

It then walks all 11 admin screens at the same widths and additionally fails on:

- an internal status value or validation flag appearing as visible text
- any control labelled delete or destroy
- the bottom navigation not having five destinations, or not navigating
- a status dropdown existing on an order
- completing an order before a payment method is chosen
- a digital payment being accepted with no transaction reference
- the returned-items question having a preselected or differently styled answer
- cancelling with no reason given
- the item code being editable, or not visibly marked as locked
- the stock actions being missing
- the zone fee box staying active while free delivery is on

125 screenshots land in `preview/screenshots/`, named `page-locale-width.png` for
the storefront and `admin-screen-width.png` for the admin.

## Production readiness — still required

- unit tests
- integration tests
- Playwright user-journey tests (only the QA gate exists today)
- **Supabase Row Level Security policies tested** — the authorization boundary
- Google Sheet ↔ Supabase synchronization tested, including loop, stale-write, duplicate
  SKU, invalid value and partial failure handling
- order workflow verified end to end
- cart and checkout verified against a real backend
- loading, empty and error states verified
- accessibility audit beyond the automated checks

Mobile QA is mandatory for UI work, in both languages.
