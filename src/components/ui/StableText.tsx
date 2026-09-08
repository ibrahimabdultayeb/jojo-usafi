import { localeVariants, type Dictionary } from "@/lib/i18n";

/**
 * A label that occupies the same width in every language.
 *
 * THE PROBLEM
 *   "Track Order" and "Fuatilia Agizo" are not the same width, so a header laid
 *   out around whichever one is on screen is a different header in each
 *   language: the nav gets wider, the search field shrinks to absorb it, and
 *   the language control and the cart button slide sideways. Nothing is broken,
 *   but switching EN ↔ SW visibly jolts controls that have nothing to do with
 *   the word that changed.
 *
 * THE FIX
 *   Every translation of the label is rendered into the same single-cell grid.
 *   The cell is therefore as wide as the longest one, and the visible text sits
 *   centred inside it. The alternates are `visibility: hidden`, so they still
 *   occupy their box — which is the whole point — while being invisible,
 *   unclickable, uncopyable and skipped by screen readers.
 *
 * WHY NOT A MEASURED WIDTH
 *   A hard-coded `min-w-[7.5rem]` would be a guess that goes stale the moment a
 *   translation is edited or a third language is added, and it guesses in `ch`
 *   units about a font it cannot see. Letting the browser measure the real
 *   strings in the real font is exact, needs no maintenance, and stays correct
 *   for any locale added to `locales`.
 *
 * COST
 *   One extra hidden span per label per additional language. It is used on the
 *   handful of persistent controls that frame the page — nav, cart, the shop
 *   filters and the hero actions — not on body copy, where reserving the
 *   longest translation would open ugly gaps rather than close them.
 */

interface StableTextProps {
  /** The label in the language currently on screen. */
  children: string;
  /** Where to find that same label in every dictionary. */
  pick: (t: Dictionary) => string;
  className?: string;
}

export function StableText({ children, pick, className = "" }: StableTextProps) {
  const alternates = localeVariants(pick).filter((variant) => variant !== children);

  return (
    <span className={`inline-grid grid-cols-1 grid-rows-1 justify-items-center ${className}`}>
      <span className="col-start-1 row-start-1 whitespace-nowrap">{children}</span>
      {alternates.map((variant) => (
        <span
          key={variant}
          aria-hidden="true"
          className="invisible col-start-1 row-start-1 whitespace-nowrap"
        >
          {variant}
        </span>
      ))}
    </span>
  );
}

/**
 * The reserving half of `StableText` on its own, for a control that cannot hold
 * children — a `<select>`, whose own width is set by its widest option and so
 * changes with the language.
 *
 * Put it in the same grid cell as the control and give the control
 * `col-start-1 row-start-1 w-full`: the cell ends up as wide as the longest
 * option in any language, and the control fills it.
 */
export function WidthReserver({
  variants,
  className = "",
}: {
  variants: string[];
  className?: string;
}) {
  return (
    <>
      {[...new Set(variants)].map((variant) => (
        <span
          key={variant}
          aria-hidden="true"
          className={`pointer-events-none invisible col-start-1 row-start-1 whitespace-nowrap ${className}`}
        >
          {variant}
        </span>
      ))}
    </>
  );
}
