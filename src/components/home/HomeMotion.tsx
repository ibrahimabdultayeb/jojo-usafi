"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useShowroomMotion } from "@/components/layout/ShowroomMotion";

/** Progressive enhancement: content is visible before hydration and without JS. */
export function HomeMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const { reduced } = useShowroomMotion();
  useEffect(() => {
    if (reduced || !root.current || !("IntersectionObserver" in window)) return;
    const sections = Array.from(root.current.querySelectorAll<HTMLElement>(":scope > section:not(.showroom-hero):not(.showroom-brands) > .showroom-wrap"));
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) {
        (entry.target as HTMLElement).dataset.reveal = "visible";
        observer.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -24px 0px", threshold: 0 });
    for (const section of sections) {
      if (section.getBoundingClientRect().top >= window.innerHeight) {
        section.dataset.reveal = "pending";
        observer.observe(section);
      }
    }
    return () => {
      observer.disconnect();
      sections.forEach((section) => delete section.dataset.reveal);
    };
  }, [reduced]);
  return <div ref={root} className="showroom-home">{children}</div>;
}
