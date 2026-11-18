import LatticeLoader from "@/components/ui/LatticeLoader";

export function PageLoading({ locale }: { locale: "en" | "sw" }) {
  return (
    <div className="shell min-h-[55vh] py-12" aria-busy="true">
      <LatticeLoader label={locale === "sw" ? "Inapakia…" : "Loading…"} showTimer={false} grid={4} pattern="sweep" shape="square" cellSize={5} gap={2} className="text-brand-700" />
      <div aria-hidden="true" className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[0, 1, 2, 3].map((key) => <div key={key} className="loading-skeleton h-64 rounded-2xl bg-slate-100" />)}
      </div>
    </div>
  );
}
