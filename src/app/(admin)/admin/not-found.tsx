import Link from "next/link";
import { Card, PageHeader, Screen } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";

export default function AdminNotFound() {
  return (
    <>
      <PageHeader title="Not found" />
      <Screen>
        <Card>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <Icon name="search" className="h-6 w-6" />
          </span>
          <h2 className="mt-4 font-display text-lg font-bold text-slate-900">
            That page is not here
          </h2>
          <p className="mt-1.5 text-sm font-medium text-slate-500">
            The order, product or customer you were looking for does not exist.
          </p>
          <Link
            href="/admin"
            className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-6 font-display text-base font-bold text-white transition-colors hover:bg-brand-600"
          >
            Back to Home
            <Icon name="arrowRight" className="h-5 w-5" />
          </Link>
        </Card>
      </Screen>
    </>
  );
}
