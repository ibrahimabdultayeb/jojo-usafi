"use client";

import Link from "next/link";
import Image from "next/image";
import { useLocale } from "@/lib/i18n/client";

export function Logo({ compact = false }: { compact?: boolean }) {
  const { t, path } = useLocale();

  return (
    <Link
      href={path("/")}
      data-qa-anchor={compact ? undefined : "logo"}
      className="showroom-logo flex min-h-11 shrink-0 items-center gap-2 lg:gap-2.5"
      aria-label={t.header.homeLabel}
    >
      <Image src="/showroom/jojo-usafi.webp" alt="" width={42} height={42} />
      <span
        className={`font-display leading-none font-extrabold tracking-tight ${
          compact ? "text-lg" : "hidden text-lg min-[360px]:block lg:text-xl"
        }`}
      >
        JOJO <span>USAFI</span>
      </span>
    </Link>
  );
}
