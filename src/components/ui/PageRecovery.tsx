"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/ui/LoadingLink";
import { Icon } from "./Icon";
import { Spinner } from "./Spinner";

/** A retry path for data-loading errors, without exposing the server exception. */
export function PageRecovery({ reset, admin = false, sw = false }: { reset: () => void; admin?: boolean; sw?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <section className={`flex min-h-[70dvh] flex-col items-center justify-center gap-5 px-5 py-12 text-center ${admin ? "text-slate-200" : "text-slate-900"}`}>
    <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-current/15"><Icon name="sync" className="h-7 w-7"/></span>
    <h1 className="font-display text-3xl font-bold">{sw ? "Ukurasa haujapakia" : "This page couldn’t load"}</h1>
    <p role="alert" className={`max-w-md text-base leading-relaxed ${admin ? "text-slate-400" : "text-slate-600"}`}>{sw ? "Huenda muunganisho au huduma haipatikani kwa muda. Jaribu kupakia ukurasa tena." : "The connection or service may be temporarily unavailable. Try loading the page again."}</p>
    <div className="flex flex-wrap justify-center gap-3">
      <button type="button" disabled={pending} aria-busy={pending} onClick={() => startTransition(() => { router.refresh(); reset(); })} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60">
        {pending && <Spinner/>}{pending ? sw ? "Inapakia…" : "Loading…" : sw ? "Jaribu tena" : "Try again"}
      </button>
      <Link href={admin ? "/admin" : sw ? "/sw/shop" : "/shop"} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-current/20 px-6 font-bold">{admin ? "Back to overview" : sw ? "Rudi dukani" : "Back to shopping"}</Link>
    </div>
  </section>;
}
