import { useState } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, Info, Loader2 } from "lucide-react";

export type ToastKind = "success" | "error" | "info";
export type ToastItem = { id: number; kind: ToastKind; text: string };

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  function push(kind: ToastKind, text: string) {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4200);
  }
  return { toasts, push };
}

/* InfoBar: fundal de suprafață, icon colorat după severitate. */
const KIND_ICON: Record<ToastKind, { icon: ReactNode; color: string }> = {
  success: { icon: <CheckCircle2 size={16} strokeWidth={1.5} />, color: "text-success" },
  error: { icon: <AlertTriangle size={16} strokeWidth={1.5} />, color: "text-danger" },
  info: { icon: <Info size={16} strokeWidth={1.5} />, color: "text-info" },
};

export function ToastHost({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2"
    >
      {toasts.map((t) => {
        const s = KIND_ICON[t.kind];
        return (
          <div
            key={t.id}
            className="animate-toast-in pointer-events-auto flex items-start gap-2.5 rounded-control border border-stroke bg-card px-3.5 py-3 text-fg shadow-elev-8"
          >
            <span className={`mt-px shrink-0 ${s.color}`}>{s.icon}</span>
            <span className="text-sm leading-snug">{t.text}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return <Loader2 size={16} strokeWidth={1.5} className={`animate-spin ${className}`} />;
}

type ButtonVariant = "primary" | "secondary" | "danger" | "icon";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 font-medium transition-colors select-none disabled:pointer-events-none disabled:opacity-50";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary:
    "rounded-control border border-transparent bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-pressed",
  secondary:
    "rounded-control border border-stroke-control bg-card text-fg hover:bg-subtle active:bg-pressed",
  danger:
    "rounded-control border border-stroke-control bg-card text-danger hover:bg-danger-bg active:bg-danger-bg",
  icon: "rounded-control text-fg-2 hover:bg-hover hover:text-fg active:bg-pressed",
};

const BUTTON_SIZE: Record<ButtonVariant, Record<ButtonSize, string>> = {
  primary: { sm: "h-7 px-2.5 text-xs", md: "h-8 px-3.5 text-sm", lg: "h-[42px] px-4 text-sm font-semibold" },
  secondary: { sm: "h-7 px-2.5 text-xs", md: "h-8 px-3.5 text-sm", lg: "h-[42px] px-4 text-sm font-semibold" },
  danger: { sm: "h-7 px-2.5 text-xs", md: "h-8 px-3.5 text-sm", lg: "h-[42px] px-4 text-sm font-semibold" },
  icon: { sm: "h-7 w-7", md: "h-8 w-8", lg: "h-8 w-8" },
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      type={type}
      className={`${BUTTON_BASE} ${BUTTON_VARIANT[variant]} ${BUTTON_SIZE[variant][size]} ${className}`}
      {...props}
    />
  );
}

/** Control segmentat (ca în Setările Windows): o singură alegere activă. */
export function SegmentedControl<T extends string>({
  label,
  value,
  onChange,
  options,
  iconOnly = false,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: LucideIcon }[];
  iconOnly?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex gap-0.5 rounded-control border border-stroke-control bg-subtle p-0.5"
    >
      {options.map((o) => {
        const on = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={iconOnly ? o.label : undefined}
            title={iconOnly ? o.label : undefined}
            onClick={() => onChange(o.value)}
            className={`flex h-7 flex-1 items-center justify-center gap-1.5 rounded-control px-2 text-xs font-medium transition-colors ${
              on
                ? "bg-card text-fg shadow-elev-4"
                : "text-fg-2 hover:bg-hover hover:text-fg"
            }`}
          >
            {Icon && <Icon size={14} strokeWidth={1.5} />}
            {!iconOnly && o.label}
          </button>
        );
      })}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="animate-fade-up flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="text-label text-fg-2">{eyebrow}</p>}
        <h2 className="text-[28px] font-semibold leading-tight text-fg">{title}</h2>
        {description && <p className="mt-1 text-sm text-fg-2">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
