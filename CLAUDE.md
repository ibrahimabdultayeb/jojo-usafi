# JOJO USAFI — PERMANENT CLAUDE CODE INSTRUCTIONS

## PROJECT IDENTITY

Jojo Usafi is a scalable ecommerce RETAIL STORE.

Jojo Usafi is not EcoPlus.

EcoPlus is currently the first catalogue/product group sold by Jojo Usafi.

The architecture must support future:

- brands
- suppliers
- categories
- products
- product types

without requiring the application to be rebuilt.

Initial market:

Tanzania only.

Currency:

TZS.

---

# AUTONOMY

You are the primary implementation agent for this repository.

For ordinary TECHNICAL decisions:

DO NOT ASK THE USER.

Decide, implement, test and continue.

You are expected to independently decide matters such as:

- component structure
- database implementation details
- TypeScript types
- state management
- route structure
- API implementation
- library choice within the agreed stack
- refactoring
- file organization
- testing implementation
- accessibility implementation
- responsive implementation
- error handling
- caching
- validation
- code formatting
- debugging
- fixing tests
- fixing TypeScript errors
- fixing lint errors
- fixing build errors
- implementation-level UI details

Never ask things such as:

"Should I fix this error?"
"Should I run the tests?"
"Should I continue?"
"Should I refactor this?"
"Which React component structure should I use?"
"Should I make it responsive?"
"Should I implement the mobile version?"
"Should I install a technically appropriate dependency?"

Make the technically appropriate decision and continue.

---

# WHEN TO ASK THE USER

Ask only when the answer materially changes a BUSINESS or PRODUCT rule.

Examples:

- selling prices
- discount policy
- delivery fee
- free delivery threshold
- payment methods
- return/refund policy
- cancellation policy
- whether out-of-stock ordering is allowed
- loyalty program rules
- tax/business policy
- order workflow
- required customer fields
- WhatsApp business workflow
- promotion rules
- customer-facing policy wording
- a materially ambiguous new feature

You may also stop for:

- external authentication/login requiring the user
- credentials that only the user can provide
- destructive production actions
- irreversible production migrations
- paid-service activation
- domain/DNS changes
- major security-policy changes

Do not ask for approval for ordinary development work.

---

# MOBILE FIRST

Jojo Usafi is MOBILE FIRST.

The website will most frequently be used from phones.

Primary QA widths:

390px
430px

Also verify:

768px
1024px
1440px

Do not create a desktop UI and merely shrink it for phones.

Both storefront and admin must feel intentionally designed for touch.

---

# ADMIN DASHBOARD

The admin dashboard may be used by someone with almost no technical experience.

It must therefore be extremely simple.

Requirements:

- plain language
- large touch targets
- minimal typing
- clear primary actions
- simple search
- simple filtering
- strong confirmation states
- understandable errors
- no developer terminology
- no database jargon
- avoid giant desktop tables on phones
- mobile-friendly cards/drawers where appropriate
- prevent invalid actions instead of explaining technical errors
- order-status buttons should be obvious
- WhatsApp/customer communication actions should be obvious
- important business information should be understandable at a glance

The admin experience should feel closer to a polished small-business ecommerce product than a developer console.

---

# VISUAL REFERENCE

Canonical storefront reference:

https://ecoplusbrands.com/

The user previously built this website and wants Jojo Usafi to reproduce its visual experience extremely closely.

Do not redesign it simply because another visual style is fashionable.

Use the live EcoPlus website as the visual reference for:

- layout
- navigation
- spacing
- section structure
- typography feel
- product cards
- category presentation
- responsive behaviour
- proportions
- visual hierarchy
- transitions
- motion
- polish

Jojo Usafi branding and retailer-specific copy will replace EcoPlus corporate/factory wording where necessary.

If historical EcoPlus source code becomes available, inspect it and use useful implementation patterns from it.

The live website remains the visual reference when historical source differs from the current live version.

---

# UI UX PRO MAX

UI UX Pro Max is installed in this repository.

Use it for:

- responsive implementation
- interaction quality
- accessibility
- UI QA
- polish

It must NOT redesign the EcoPlus visual reference unless explicitly requested.

---

# DATA ARCHITECTURE

Operational live database:

Cloud Firestore.

Authentication:

Firebase Authentication.

Product/image storage:

Firebase Storage.

Human-friendly product control:

Google Sheets.

Required structure:

Google Sheet
      ↕
secure synchronization layer
      ↕
Cloud Firestore
      ↕
Storefront + Admin Dashboard

The public website should read Firestore.

Do NOT query Google Sheets directly for every storefront page request.

---

# TWO-WAY GOOGLE SHEET SYNC

The user must be able to change catalogue information through Google Sheets.

Those changes must synchronize to Firestore.

Admin-dashboard changes must:

1. update Firestore immediately
2. synchronize to the corresponding Google Sheet field
3. be recorded in an audit/sync log

The sync architecture must protect against:

- infinite synchronization loops
- stale writes
- invalid values
- duplicate SKUs
- partial failures
- conflicting edits

SKU is the stable product identifier.

Never silently change an SKU that has already been used in orders.

---

# INITIAL PRODUCT CATALOGUE

The current catalogue is EcoPlus.

This does NOT mean:

- EcoPlus owns the store architecture
- all future products are cleaning products
- all future brands use EP codes
- the system may hard-code EcoPlus-specific assumptions

Future completely unrelated brands must be possible.

---

# PREFERRED STACK

Use:

- Next.js
- React
- TypeScript
- Tailwind CSS
- Vercel
- Cloud Firestore
- Firebase Authentication
- Firebase Storage
- Google Sheets API
- Google Apps Script when appropriate
- Playwright
- GitHub

Do not replace major stack components without a compelling technical reason.

If replacement materially affects cost/business operations, ask first.

---

# ECOMMERCE ARCHITECTURE

Design for:

- products
- variants
- brands
- suppliers
- categories
- stock/inventory
- carts
- customers
- orders
- order events
- promotions
- discounts
- admin users
- website content
- sync jobs
- audit logs
- analytics

Orders must be stored BEFORE WhatsApp is opened.

WhatsApp is a communication channel.

WhatsApp is NOT the database.

---

# ORDER ANALYTICS

Important events should be measurable, including:

- page view
- product impression
- product view
- search
- add to cart
- remove from cart
- checkout started
- order created
- WhatsApp initiated
- order confirmed
- preparation
- dispatched/out for delivery
- completed
- cancelled
- failed delivery

---

# QUALITY REQUIREMENT

When relevant, verify:

- TypeScript
- lint
- tests
- integration tests
- production build
- Playwright tests
- Firestore rules
- mobile layout
- laptop/desktop layout
- loading states
- empty states
- error states
- accessibility
- synchronization
- security assumptions

A failed build/test is a problem to solve.

It is not a reason to stop and ask the user what to do.

Process:

diagnose
→ fix
→ rerun
→ continue

---

# GIT

Use Git continuously.

Make logical commits after verified milestones.

Never commit secrets.

Never commit:

- .env
- .env.local
- service-account credentials
- private keys
- tokens
- Firebase Admin keys
- Google API private credentials

Never force-push without user approval.

---

# DOCUMENTATION

Keep these current:

docs/PROJECT_CONSTITUTION.md
docs/ARCHITECTURE.md
docs/BUSINESS_RULES.md
docs/DATA_MODEL.md
docs/UI_REFERENCE.md
docs/TESTING_REQUIREMENTS.md
docs/DECISIONS.md
docs/PROGRESS.md

Update documentation when implementation materially changes the architecture.

---

# STOPPING RULE

Do not stop merely because the first approach failed.

Continue until:

1. the requested objective is completed and verified, OR
2. a genuine business/product decision is required, OR
3. external authentication requires the user, OR
4. a protected/destructive action requires user approval, OR
5. an external system failure makes progress impossible.

Otherwise keep working.
