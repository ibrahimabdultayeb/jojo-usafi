"use client";

import type { ReactNode } from "react";

/**
 * The hero's down control.
 *
 * A real `<button>`, so it is reachable by tab and operable by Enter, Space and
 * touch — not a decorative chevron. It respects `prefers-reduced-motion` by
 * jumping instead of animating, and it moves keyboard focus to the target so a
 * keyboard user carries on from where the page just scrolled to instead of
 * continuing from the hero.
 */

interface ScrollToSectionProps {
  /** `id` of the section to scroll to. */
  targetId: string;
  label: string;
  className?: string;
  children: ReactNode;
}

export function ScrollToSection({ targetId, label, className, children }: ScrollToSectionProps) {
  function scrollToTarget() {
    const target = document.getElementById(targetId);
    if (!target) return;

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });

    // Sections are not focusable by default; make this one focusable just long
    // enough to receive focus, so the tab order follows the viewport.
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }

  return (
    <button type="button" onClick={scrollToTarget} aria-label={label} className={className}>
      {children}
    </button>
  );
}
