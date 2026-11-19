import Link from "@/components/ui/LoadingLink";
import { Icon } from "@/components/ui/Icon";
export default function NotFound() {
  return <section className="flex min-h-[70dvh] flex-col items-center justify-center gap-5 px-5 text-center">
    <Icon name="search" className="h-10 w-10 text-slate-400"/>
    <h1 className="font-display text-3xl font-bold">We couldn’t find that page</h1>
    <p className="max-w-md text-base text-slate-400">The link may be outdated, or this item may no longer be available.</p>
    <Link href="/admin" className="admin-link-button admin-link-secondary">Back to overview</Link>
  </section>;
}
