import deltaMark from "../assets/delta-mark.svg";

/** The app mark as a silhouette, inheriting the surrounding theme color. */
export function DeltaMark({ className = "" }: { className?: string }) {
  const mask = `url("${deltaMark}") center / contain no-repeat`;
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{ mask, WebkitMask: mask }}
    />
  );
}
