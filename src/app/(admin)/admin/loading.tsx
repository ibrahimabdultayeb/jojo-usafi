import LatticeLoader from "@/components/ui/LatticeLoader";

export default function LoadingAdminPage() {
  return (
    <div className="admin-route-loading" role="status">
      <LatticeLoader decorative showTimer={false} cellSize={8} gap={3} shape="square" pattern="orbit" />
      <span className="sr-only">Loading workspace…</span>
    </div>
  );
}
