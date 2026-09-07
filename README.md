# Jojo Usafi

Jojo Usafi is a scalable ecommerce retail store for Dar es Salaam. EcoPlus is the
first brand catalogue it sells — not the whole store.

**This repository currently contains a frontend-only storefront prototype.** There is
no Firebase, no Google Sheet connection, no order backend and no payments. See
[`PROTOTYPE_NOTES.md`](./PROTOTYPE_NOTES.md) for exactly what is real and what is mocked.

## Run it locally

You need Node 20 or newer.

```bash
npm install
npm run dev
```

Then open **http://localhost:3000**.

### What to look at

| Page | URL |
| --- | --- |
| Homepage | http://localhost:3000/ |
| Shop / catalogue | http://localhost:3000/shop |
| A category | http://localhost:3000/shop?category=laundry-care |
| Product detail | http://localhost:3000/product/multix-multipurpose-detergent-lemon-fresh-5lt |
| Cart | http://localhost:3000/cart |
| Checkout shell | http://localhost:3000/checkout |
| Track order shell | http://localhost:3000/track-order |
| Contact | http://localhost:3000/contact |

The cart drawer opens from the **CART** button in the header, and a sticky cart bar
appears at the bottom of the screen on phones once you add something.

### Seeing the phone experience

Jojo Usafi is mobile first. In Chrome: `F12` → the device-toolbar icon (`Ctrl+Shift+M`)
→ pick **iPhone 14 Pro (390px)** or set the width to **430px**.

Saved screenshots at every QA width are in [`preview/screenshots/`](./preview/screenshots).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Local development server on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm run qa:screenshots` | Screenshots every page at 390/430/768/1024/1440 and reports overflow + console errors (dev server must be running) |

## Project layout

```
src/app/                  routes (App Router)
src/components/layout/    header, footer, announcement bar, mobile menu, cart bar
src/components/home/      homepage sections
src/components/product/   product card, product artwork, add-to-cart controls
src/components/cart/      cart drawer
src/lib/catalogue/        catalogue types, mock data and the query layer
src/lib/                  cart state, formatting, site copy, colour tones
scripts/                  visual QA script
preview/screenshots/      QA screenshots
docs/                     project constitution, architecture, progress
```

Everything the UI knows about products goes through `src/lib/catalogue/queries.ts`.
That is the single seam where Cloud Firestore replaces the prototype data later.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Playwright for visual QA.
