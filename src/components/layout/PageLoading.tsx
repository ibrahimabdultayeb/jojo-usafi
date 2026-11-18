import { Spinner } from "@/components/ui/Spinner";

export function PageLoading({ locale }: { locale: "en" | "sw" }) {
  return (
    <div className="shell min-h-[55vh] py-12" aria-busy="true">
      <p role="status" className="flex items-center gap-3 font-semibold text-slate-600"><Spinner />{locale === "sw" ? "Inapakia…" : "Loading…"}</p>
      <div aria-hidden="true" className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[0, 1, 2, 3].map((key) => <div key={key} className="loading-skeleton h-64 rounded-2xl bg-slate-100" />)}
      </div>
    </div>
  );
}
