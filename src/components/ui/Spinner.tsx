import LatticeLoader from "./LatticeLoader";

/** The action's localized visible label supplies its accessible status. */
export function Spinner({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`action-spinner ${className}`}>
    <LatticeLoader decorative showTimer={false} cellSize={4} gap={1.5} shape="square" pattern="orbit" />
  </span>;
}
