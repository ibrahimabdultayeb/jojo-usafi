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

70 screenshots land in `preview/screenshots/`, named `page-locale-width.png`.

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
