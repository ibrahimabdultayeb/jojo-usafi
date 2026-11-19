"use client";

// Adapted from React Bits Animated List by David Haz. See THIRD_PARTY_NOTICES.md.
// Reuses its slide/fade poses and spring easing with document scrolling, actual
// links/table rows, capped stagger, and no nested listbox or hidden SSR content.
import { Children, createElement, isValidElement, useLayoutEffect, useRef, type ReactNode } from "react";
import { useShowroomMotion } from "@/components/layout/ShowroomMotion";

const SPRING = 'linear(0, 0.0603, 0.2033, 0.3821, 0.5633, 0.7258, 0.8584, 0.9574, 1.0242, 1.0634, 1.0809, 1.0828, 1.0747, 1.0613, 1.046, 1.0313, 1.0186, 1.0085, 1.0012, 0.9965, 0.994, 0.9931, 0.9933, 0.9941, 0.9953, 0.9966, 0.9978, 0.9988, 1)';
export function AnimatedList({ children, as = "div", className = "", resetKey = "", label, ...attributes }: {
  children: ReactNode; as?: "div" | "ul" | "ol" | "tbody"; className?: string; resetKey?: string; label?: string; "data-qa"?: string; "data-qa-variant"?: string;
}) {
  const root = useRef<HTMLElement>(null);
  const { reduced } = useShowroomMotion();
  const signature = Children.toArray(children).map((child, index) => isValidElement(child) ? child.key ?? index : index).join("|");
  useLayoutEffect(() => {
    const element = root.current;
    if (!element || !element.animate) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches || reduced) return;
    const ease = CSS.supports("transition-timing-function", "linear(0, 1)") ? SPRING : "cubic-bezier(.22,1,.36,1)";
    const animations = new Set<Animation>();
    function reveal(node: Element, index: number) {
      const animation = node.animate([
        { opacity:0, transform:"translate3d(0, 14px, 0) scale(.99)" },
        { opacity:1, transform:"translate3d(0, 0, 0) scale(1)" },
      ], {duration:380, delay:Math.min(index, 6) * 22, easing:ease, fill:"backwards"});
      animations.add(animation);
      animation.onfinish = () => animations.delete(animation);
    }
    const observer = new IntersectionObserver(entries => {
      let index = 0;
      for (const entry of entries) if (entry.isIntersecting) { reveal(entry.target, index++); observer.unobserve(entry.target); }
    }, {threshold:0.05});
    Array.from(element.children).forEach(node => observer.observe(node));
    const stop = () => { observer.disconnect(); animations.forEach(animation => animation.cancel()); animations.clear(); };
    reduce.addEventListener("change", stop);
    return () => { stop(); reduce.removeEventListener("change", stop); };
  }, [signature, resetKey, reduced]);
  return createElement(as, { ...attributes, ref:root, className:`animated-list ${className}`, "aria-label":label }, children);
}
