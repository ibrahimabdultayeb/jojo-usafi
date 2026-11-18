/** The action's visible label supplies the accessible status. */
export function Spinner({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`action-spinner ${className}`} />;
}
