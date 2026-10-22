import { DeltaMark } from "./DeltaMark";

export function DeltaLoader({ label = "Se încarcă…" }: { label?: string }) {
  return (
    <div role="status" className="flex h-full min-h-80 w-full items-center justify-center p-7">
      <div className="flex flex-col items-center gap-5">
        <div aria-hidden="true" className="relative flex h-24 w-24 items-center justify-center text-accent-fg">
          <span className="absolute inset-0 rounded-full border border-accent-fg/15" />
          <span className="delta-loader-halo absolute inset-0 rounded-full border-2 border-transparent border-t-accent-fg/80" />
          <DeltaMark className="delta-loader-mark h-14 w-14" />
        </div>
        <span className="text-sm font-medium text-fg-2">{label}</span>
      </div>
    </div>
  );
}
