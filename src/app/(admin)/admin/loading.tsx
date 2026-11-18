import { Spinner } from "@/components/ui/Spinner";
export default function LoadingAdminPage() {
 return <div className="admin-card flex min-h-48 items-center justify-center gap-3 p-6 text-sm text-slate-500" role="status"><Spinner/>Loading workspace…</div>;
}
