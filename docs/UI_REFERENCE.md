# UI Reference

Canonical visual reference:

https://ecoplusbrands.com/

Jojo Usafi should reproduce this storefront visual experience extremely closely.

Mobile is the primary UI.

Mandatory QA widths:

390
430
768
1024
1440

Every width is QA'd in **both English and Kiswahili** — Kiswahili copy is longer, and
buttons, chips and nav items have to hold it without wrapping badly or overflowing.

UI UX Pro Max should improve implementation quality but must not replace the reference
design.

## Product shelf density

The reference shows five products per row on a wide desktop. Jojo Usafi matches it:

| Width | Columns |
| --- | --- |
| < 768px | 2 |
| >= 768px | 3 |
| >= 1024px | 4 |
| >= 1280px | 5 |

Five columns start at `xl`, not `lg`. The shell is capped at 1400px, so at 1280px a
five-across card is ~227px wide — the same card the four-across laptop layout already
ships — while at 1024px it would fall to ~176px and squeeze the product name, the pack
size and the price row. The card proportions, gaps, image area and price prominence never
get tighter than the approved ones; the row simply gains a fifth card once there is room
for it. `npm run qa:screenshots` asserts the column count at every QA width rather than
leaving it to be eyeballed.

A fixed-length homepage shelf is handed enough products for the widest row (5 for a
category rail, 10 for best sellers) and trims its own tail at narrower column counts, so
it always ends on a complete row instead of leaving one orphan card under a full one. See
`.shelf-rail` / `.shelf-two-rows` in `globals.css`. Shop All deliberately does not trim: a
part-full last row there is simply where the catalogue ends.

## Language stability

Switching EN ↔ SW must change the **text**, not the furniture. Kiswahili labels are longer
than their English originals, and an interface laid out around whichever one is on screen
shifts the search field, the language control and the cart button sideways every time the
shopper switches — which reads as a glitch even though nothing is broken.

So the persistent controls reserve the width of their **longest translation** rather than
fitting the one currently showing. `StableText` renders every translation of a label into
one grid cell: the cell is as wide as the longest, the visible text sits centred in it, and
the alternates are `visibility: hidden` — present for layout, invisible to eyes, mouse and
screen readers. The browser measures the real strings in the real font, so there are no
magic widths to go stale when a translation is edited or a third language is added.

Reserved today: the four desktop nav slots, the cart label, the shop "All" chip, the sort
menu and the two hero actions. Deliberately **not** reserved: body copy and headlines,
where reserving the longest translation would open gaps rather than close them.

Fonts are never shrunk to make a translation fit.

**What is held stable, and what is allowed to move.** Horizontal position and width are
locked everywhere — sideways movement is the glitch, and no honest translation requires it.
Vertical position is locked only inside the header, which is fixed furniture. Further down
a page a translated paragraph is entitled to take one more line than its English original
and push what follows down; failing that would leave only reserved blank space or smaller
type, both worse than the wrap they would hide.

## WhatsApp

One component draws the WhatsApp mark everywhere it appears —
`src/components/ui/WhatsAppIcon.tsx` — on the storefront floating support button, the
mobile menu, the footer, the contact and track-order pages, and the admin's "WhatsApp
customer" actions. It is a filled path, never a font glyph and never traced with the
line-icon stroke set: `Icon.tsx` carries no `whatsapp` entry, precisely so nobody reaches
for one. Roughly 20px inside a labelled action button; icon-only controls keep their 44px
target and name themselves with an `aria-label`.

## Floating layer contract

Every fixed or sticky surface sits on exactly one named layer, defined in
`src/app/globals.css`. Nothing invents its own z-index.

| Layer | What lives there |
| --- | --- |
| `z-10` | announcement bar — in flow, scrolls away under the header |
| `z-40` | sticky header |
| `z-50` | floating actions — mobile cart dock, WhatsApp support button |
| `z-60` | modal surfaces — cart drawer, mobile menu, language chooser |
| `z-70` | skip link, when focused |

Within `z-50` the cart dock owns the bottom edge: the support button lifts clear of it
whenever the cart has something in it. The QA gate fails the build if any two floating
surfaces overlap.

## Product photography

Approved white-background photographs, matched to products on the exact SKU. They are
drawn `object-contain` inside a fixed square box, so there is no distortion, no cropping
and no layout shift. A product with no approved photograph is not shown at all — there is
no placeholder artwork any more.

## Touch

Every control on a touch viewport is at least 44×44px, and the QA gate enforces it. Where
a small link sits inside a card, the whole card is the tap target (a stretched link), and
the check measures that real hit area rather than the text box.
