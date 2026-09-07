"use client";

import { useEffect, useState } from "react";
import { announcements } from "@/lib/site";

/**
 * Thin bar above the header. On phones there is only room for one message at a
 * time, so it rotates; from `sm` up all three sit on one line.
 */
export function AnnouncementBar() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % announcements.length);
    }, 4000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="relative z-50 bg-gradient-to-r from-brand-700 via-brand-600 to-emerald-500 text-white">
      <div className="shell flex h-9 items-center justify-center overflow-hidden">
        <p key={index} className="fade-in text-center text-[11px] font-bold tracking-wide sm:hidden">
          {announcements[index]}
        </p>
        <div className="hidden items-center gap-3 text-[11px] font-bold tracking-wide sm:flex md:gap-5 md:text-xs">
          {announcements.map((message, i) => (
            <span key={message} className="flex items-center gap-3 md:gap-5">
              {i > 0 && <span aria-hidden className="h-1 w-1 rounded-full bg-white/50" />}
              <span>{message}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
