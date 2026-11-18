"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const storageKey = "jojo-usafi.reduce-motion";
const MotionContext = createContext({ reduced: false, systemReduced: false, toggle: () => {} });

export function ShowroomMotion({ children }: { children: ReactNode }) {
  const [systemReduced, setSystemReduced] = useState(false);
  const [preference, setPreference] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReduced(media.matches);
    update();
    media.addEventListener("change", update);
    try {
      setPreference(window.localStorage.getItem(storageKey) === "true");
    } catch {
      // The control still works for this visit.
    }
    return () => media.removeEventListener("change", update);
  }, []);

  const reduced = systemReduced || preference;
  useEffect(() => {
    document.documentElement.toggleAttribute("data-showroom-reduced", reduced);
    return () => document.documentElement.removeAttribute("data-showroom-reduced");
  }, [reduced]);

  function toggle() {
    const next = !preference;
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
  const { reduced, systemReduced, toggle } = useShowroomMotion();
  return (
    <button type="button" className="showroom-motion-toggle" aria-pressed={reduced} onClick={toggle} disabled={systemReduced}>
      <span aria-hidden="true" /><span>{label}</span>
    </button>
  );
}
