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
