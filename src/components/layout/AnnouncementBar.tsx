"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/client";

/**
 * Thin bar above the header. On phones there is only room for one message at a
 * time, so it rotates; from `sm` up all three sit on one line.
 *
 * Floating layer: `z-10` — in flow, and it scrolls away under the sticky header.
 *
 * `override` is what the Owner typed on the Website screen. One sentence
 * replaces all three and stops the rotation, because a single message that
 * moves is harder to read than one that does not. Blank means the built-in
 * wording, never silence — the strip is hidden by its own switch instead.
 */
export function AnnouncementBar({ override }: { override?: string | null }) {
  const { t } = useLocale();
  const announcements = override ? [override] : t.announcements;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (announcements.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % announcements.length);
    }, 4000);
    return () => window.clearInterval(id);
  }, [announcements.length]);

  return (
    <div className="relative z-10 bg-gradient-to-r from-brand-700 via-brand-600 to-emerald-500 text-white">
      <div className="shell flex h-9 items-center justify-center overflow-hidden">
        {/* Modulo, not the raw index: an Owner saving an override takes the
            list from three messages to one while the timer may be on 2. */}
        <p key={index} className="fade-in text-center text-[11px] font-bold tracking-wide sm:hidden">
          {announcements[index % announcements.length]}
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
