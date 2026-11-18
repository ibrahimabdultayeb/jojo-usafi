"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const storageKey = "jojo-usafi.reduce-motion";
const MotionContext = createContext({ reduced: false, systemReduced: false, toggle: () => {} });

export function ShowroomMotion({ children }: { children: ReactNode }) {
  const [systemReduced, setSystemReduced] = useState(false);
  const [preference, setPreference] = useState<boolean | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReduced(media.matches);
    update();
    media.addEventListener("change", update);
    try {
      const saved = window.localStorage.getItem(storageKey);
      setPreference(saved === "true" ? true : saved === "false" ? false : null);
    } catch {
      // The control still works for this visit.
    }
    return () => media.removeEventListener("change", update);
  }, []);

  const reduced = preference ?? systemReduced;
  useEffect(() => {
    document.documentElement.toggleAttribute("data-showroom-reduced", reduced);
    if (preference !== null) document.documentElement.dataset.showroomMotion = reduced ? "reduced" : "full";
    else delete document.documentElement.dataset.showroomMotion;
    return () => {
      document.documentElement.removeAttribute("data-showroom-reduced");
      delete document.documentElement.dataset.showroomMotion;
    };
  }, [reduced, preference]);

  function toggle() {
    const next = !reduced;
    setPreference(next);
    try {
      window.localStorage.setItem(storageKey, String(next));
    } catch {
      // The control still works for this visit.
    }
  }

  return <MotionContext.Provider value={{ reduced, systemReduced, toggle }}>{children}</MotionContext.Provider>;
}

export function useShowroomMotion() {
  return useContext(MotionContext);
}

export function MotionPreference({ label }: { label: string }) {
  const { reduced, toggle } = useShowroomMotion();
  return (
    <button type="button" className="showroom-motion-toggle" aria-pressed={reduced} onClick={toggle}>
      <span aria-hidden="true" /><span>{label}</span>
    </button>
  );
}
