import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronDown, ChevronLeft, ChevronRight, Download, Filter, Search, Trash2, X } from "lucide-react";
import type { SortState } from "../lib/usePaged";
import { Spinner } from "./ui";

// Stivă globală de modale: doar modalul din vârf reacționează la Escape/Enter,
// ca un dialog de confirmare suprapus să nu închidă și modalul de dedesubt.
const modalStack: symbol[] = [];
const modalListeners = new Set<(top: symbol | null) => void>();

function useIsTopModal(active: boolean): boolean {
  const [isTop, setIsTop] = useState(active);
  useEffect(() => {
    if (!active) return;
    const id = Symbol("modal");
    modalStack.push(id);
    const fn = (top: symbol | null) => setIsTop(top === id);
    modalListeners.add(fn);
    fn(modalStack[modalStack.length - 1]);
    return () => {
      modalListeners.delete(fn);
      const idx = modalStack.indexOf(id);
      if (idx >= 0) modalStack.splice(idx, 1);
      const next = modalStack.length > 0 ? modalStack[modalStack.length - 1] : null;
      modalListeners.forEach((f) => f(next));
    };
  }, [active]);
  return isTop;
}

/** Selecția rândurilor dintr-un tabel cu paginare.
 *  `pageKeys` = cheile rândurilor de pe pagina curentă. */
export function useSelection(pageKeys: string[]) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const pageSel = pageKeys.filter((k) => selected.has(k));
  const allPageSelected = pageKeys.length > 0 && pageSel.length === pageKeys.length;

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function togglePage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageKeys.forEach((k) => next.delete(k));
      else pageKeys.forEach((k) => next.add(k));
      return next;
    });
  }

  function clear() {
    setSelected(new Set());
  }

  return {
    selected,
    pageSel,
    allPageSelected,
    toggle,
    togglePage,
    clear,
  };
}

/** Checkbox din celula de selecție a tabelului. */
export function SelectionCheckbox({
  checked,
  onChange,
  title,
}: {
  checked: boolean;
  onChange: () => void;
  title?: string;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      title={title}
      className="accent-forest-700"
    />
  );
}

/** Bara de acțiuni afișată când sunt rânduri selectate. */
export function SelectionToolbar({
  count,
  onDelete,
  onExport,
  busy,
}: {
  count: number;
  onDelete: () => void;
  onExport: () => void;
  busy?: boolean;
}) {
  if (count === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-amber-200 bg-amber-50/70 px-5 py-2.5">
      <span className="text-sm font-semibold text-amber-800">
        {count.toLocaleString("ro-RO")} selectat{count === 1 ? "" : "e"}
      </span>
      <div className="ml-auto flex gap-2">
        <button
          type="button"
          onClick={onExport}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:border-amber-400 hover:bg-amber-100 disabled:opacity-50"
        >
          <Download size={13} />
          Exportă selectate
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
        >
          <Trash2 size={13} />
          Șterge selectate
        </button>
      </div>
    </div>
  );
}

export const inputCls =
  "w-full rounded-lg border border-forest-200 bg-forest-50/50 px-3 py-2 text-sm text-forest-900 outline-none transition placeholder:text-forest-400 focus:border-forest-500 focus:bg-white focus:ring-2 focus:ring-forest-500/15 disabled:cursor-not-allowed disabled:opacity-60";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wider text-forest-500">
        {label}
      </span>
      {children}
      {hint && <span className="text-[11px] text-forest-400">{hint}</span>}
    </label>
  );
}

export function Modal({
  title,
  icon,
  onClose,
  children,
  footer,
  width = "max-w-md",
}: {
  title: string;
  icon: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Clasa Tailwind pentru lățimea modalului (ex: "max-w-md", "max-w-2xl"). */
  width?: string;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const pressedOnBackdrop = useRef(false);

  const isTop = useIsTopModal(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isTop) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, isTop]);

  return (
    <div
      ref={backdropRef}
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-forest-950/50 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        pressedOnBackdrop.current = e.target === backdropRef.current;
        if (pressedOnBackdrop.current) {
          e.preventDefault();
        }
      }}
      onMouseUp={(e) => {
        if (pressedOnBackdrop.current && e.target === backdropRef.current) onClose();
      }}
    >
      <div
        className={`animate-modal-in w-full ${width} overflow-hidden rounded-2xl bg-white shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-forest-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest-50 text-forest-600">
              {icon}
            </div>
            <h3 className="font-display text-base font-semibold text-forest-900">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-forest-400 transition hover:bg-forest-50 hover:text-forest-700"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-between gap-2 border-t border-forest-100 bg-forest-50/60 px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConfirmDeleteModal({
  title,
  description,
  entity,
  confirmLabel = "Șterge",
  busyLabel = "Se șterge…",
  onConfirm,
  onClose,
}: {
  title: string;
  description: ReactNode;
  entity?: string;
  confirmLabel?: string;
  busyLabel?: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function confirma() {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } catch {
      // eroarea e semnalată de apelant; modalul rămâne deschis
    } finally {
      setBusy(false);
    }
  }

  const isTop = useIsTopModal(true);

  useEffect(() => {
    if (!isTop) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
      if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) confirma();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isTop, busy, onClose, onConfirm]);

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[60] flex items-center justify-center bg-forest-950/50 p-4 backdrop-blur-sm"
      onClick={() => !busy && onClose()}
    >
      <div
        className="animate-modal-in w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
      >
        <div className="h-1.5 bg-gradient-to-r from-red-600 via-red-400 to-amber-400" />
        <div className="px-6 pb-5 pt-7 text-center">
          <div className="relative mx-auto flex h-14 w-14 items-center justify-center">
            <span className="animate-gen-pulse absolute inset-0 rounded-full bg-red-500/15" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-red-100 bg-red-50 text-red-600">
              <Trash2 size={22} />
            </div>
          </div>
          <h3 className="mt-4 font-display text-xl font-semibold tracking-tight text-forest-950">
            {title}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-forest-600">{description}</p>
          {entity && (
            <div className="mt-3.5 inline-flex max-w-full items-center gap-2 rounded-lg border border-red-100 bg-red-50/70 px-3 py-1.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
              <span className="truncate font-mono text-xs font-semibold text-red-700">
                {entity}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-forest-100 bg-forest-50/60 px-5 py-3.5">
          <p className="mr-auto flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-forest-400">
            <AlertTriangle size={12} className="text-amber-500" />
            Ireversibil
          </p>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-forest-200 bg-white px-4 py-2 text-sm font-semibold text-forest-700 transition hover:border-forest-400 hover:bg-forest-50 disabled:opacity-50"
          >
            Anulează
          </button>
          <button
            type="button"
            onClick={confirma}
            disabled={busy}
            className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-500 active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? <Spinner /> : <Trash2 size={15} />}
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-forest-400"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-80 rounded-lg border border-forest-200 bg-forest-50/50 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-forest-400 focus:border-forest-500 focus:bg-white focus:ring-2 focus:ring-forest-500/15"
      />
    </div>
  );
}

export function DropdownButton({
  label,
  icon,
  items,
  disabled,
  align = "right",
}: {
  label: string;
  icon?: ReactNode;
  items: ({ label: string; icon?: ReactNode; onSelect: () => void } | { divider: true })[];
  disabled?: boolean;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      const inside =
        (btnRef.current && btnRef.current.contains(t)) ||
        (menuRef.current && menuRef.current.contains(t));
      if (!inside) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({
        top: r.bottom + 6,
        left: align === "right" ? r.right : r.left,
      });
    }
    setOpen((o) => !o);
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className="group flex items-center gap-2 rounded-xl border border-forest-200 bg-white px-4 py-2.5 text-sm font-semibold text-forest-800 shadow-sm transition hover:border-forest-400 hover:shadow active:scale-[0.98] disabled:opacity-50"
      >
        {icon && <span className="text-forest-500 transition group-hover:text-amber-600">{icon}</span>}
        {label}
        <ChevronDown
          size={14}
          className={`text-forest-400 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: pos.top, left: pos.left }}
            className={`animate-fade-in fixed z-[100] min-w-[13rem] translate-y-0 overflow-hidden rounded-xl border border-forest-100 bg-white py-1 shadow-2xl ${
              align === "right" ? "-translate-x-full" : ""
            }`}
          >
            {items.map((it, i) =>
              "divider" in it ? (
                <div key={`d${i}`} className="my-1 h-px bg-forest-100" />
              ) : (
                <button
                  key={it.label}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    it.onSelect();
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium text-forest-700 transition hover:bg-forest-50 hover:text-forest-900"
                >
                  {it.icon && <span className="text-forest-400">{it.icon}</span>}
                  {it.label}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      // ignoră click-urile din interiorul dropdown-ului (portal)
      if (panelRef.current && panelRef.current.contains(t)) return;
      if (btnRef.current && !btnRef.current.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScroll = (e: Event) => {
      // scroll-ul din interiorul listei nu trebuie să închidă dropdown-ul
      if (panelRef.current && panelRef.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.left, width: r.width });
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = q === "" ? options : options.filter((o) => o.toLowerCase().includes(q));

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${inputCls} flex items-center justify-between gap-2 text-left ${
          value ? "text-forest-900" : "text-forest-400"
        }`}
      >
        <span className="truncate">{value || placeholder || "Alege…"}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-forest-400 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            className="animate-fade-in fixed z-[100] overflow-hidden rounded-xl border border-forest-100 bg-white shadow-2xl"
          >
            <div className="border-b border-forest-100 p-2">
              <div className="relative">
                <Search
                  size={13}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-forest-400"
                />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Caută…"
                  className="w-full rounded-lg border border-forest-200 bg-forest-50/50 py-1.5 pl-8 pr-2 text-sm outline-none transition placeholder:text-forest-400 focus:border-forest-500 focus:bg-white"
                />
              </div>
            </div>
            {/* 5 rânduri vizibile, restul cu scroll */}
            <div className="max-h-[11.25rem] overflow-y-auto py-1">
              {filtered.map((o) => {
                const selected = o === value;
                return (
                  <button
                    key={o}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onChange(o);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition hover:bg-forest-50 ${
                      selected ? "bg-forest-50/60 font-semibold text-forest-900" : "text-forest-700"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                        selected
                          ? "border-forest-700 bg-forest-700 text-white"
                          : "border-forest-300 bg-white"
                      }`}
                    >
                      {selected && <Check size={11} strokeWidth={3} />}
                    </span>
                    <span className="truncate">{o}</span>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-forest-400">
                  Nicio valoare găsită.
                </p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

/** Header de tabel: click simplu sortează; dacă are `filter`, se deschide
 *  un meniu cu sortare + filtrare pe valoare (ex: grupa / agent). */
export function SortableTh({
  label,
  sortKey,
  sort,
  onSort,
  filter,
  className = "",
}: {
  label: string;
  sortKey: string;
  sort: SortState | null;
  onSort: (s: SortState | null) => void;
  /** Dacă este setat, headerul deschide un meniu cu filtrare pe mai multe valori. */
  filter?: {
    /** Valorile selectate (lista goală = fără filtru). */
    value: string[];
    onChange: (v: string[]) => void;
    options: string[];
    placeholder: string;
  };
  className?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const active = sort?.key === sortKey;
  const dir = active ? sort.dir : null;
  const filterActive = filter ? filter.value.length > 0 : false;

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current && panelRef.current.contains(t)) return;
      if (btnRef.current && !btnRef.current.contains(t)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const onScroll = (e: Event) => {
      if (panelRef.current && panelRef.current.contains(e.target as Node)) return;
      setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (menuOpen && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.left, width: Math.max(r.width, 200) });
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [menuOpen]);

  const q = query.trim().toLowerCase();
  const filtered =
    !filter || q === "" ? filter?.options ?? [] : filter.options.filter((o) => o.toLowerCase().includes(q));

  function toggleSort() {
    if (!active) onSort({ key: sortKey, dir: "asc" });
    else if (dir === "asc") onSort({ key: sortKey, dir: "desc" });
    else onSort(null);
  }

  return (
    <th className={`${className} select-none`}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (filter ? setMenuOpen((o) => !o) : toggleSort())}
        className="group flex items-center gap-1 font-semibold uppercase tracking-wide transition-colors hover:text-forest-800"
        title={filter ? "Sortează / filtrează" : undefined}
      >
        {label}
        {dir === "asc" ? (
          <ArrowUp size={13} className="text-amber-600" />
        ) : dir === "desc" ? (
          <ArrowDown size={13} className="text-amber-600" />
        ) : (
          <ArrowUpDown
            size={12}
            className="opacity-0 transition-opacity group-hover:opacity-60"
          />
        )}
        {filter && (
          <Filter
            size={12}
            className={
              filterActive
                ? "text-amber-600"
                : "opacity-0 transition-opacity group-hover:opacity-60"
            }
          />
        )}
      </button>

      {filter && menuOpen && pos && (
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            className="animate-fade-in fixed z-[100] overflow-hidden rounded-xl border border-forest-100 bg-white shadow-2xl"
          >
            <div className="border-b border-forest-100 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-forest-400">
              {filter.placeholder}
            </div>
            <div className="flex flex-col gap-1.5 py-2">
              <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-forest-400">
                Sortare
              </span>
              {(
                [
                  { label: "Crescător (A–Z)", dir: "asc" as const },
                  { label: "Descrescător (Z–A)", dir: "desc" as const },
                ] as const
              ).map((o) => {
                const selected = active && dir === o.dir;
                return (
                  <button
                    key={o.dir}
                    type="button"
                    onClick={() => {
                      onSort({ key: sortKey, dir: o.dir });
                      setMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition hover:bg-forest-50 ${
                      selected ? "bg-forest-50/60 font-semibold text-forest-900" : "text-forest-700"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                        selected
                          ? "border-forest-700 bg-forest-700 text-white"
                          : "border-forest-300 bg-white"
                      }`}
                    >
                      {selected && <Check size={11} strokeWidth={3} />}
                    </span>
                    {o.label}
                  </button>
                );
              })}
            </div>
            <div className="my-1 h-px bg-forest-100" />
            <div className="flex flex-col gap-1.5 py-2">
              <div className="flex items-center justify-between px-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-forest-400">
                  Filtru
                </span>
                {filter.value.length > 0 && (
                  <button
                    type="button"
                    onClick={() => filter.onChange([])}
                    className="text-[11px] font-semibold text-forest-500 transition hover:text-forest-900"
                  >
                    Golește
                  </button>
                )}
              </div>
              <div className="px-3">
                <div className="relative">
                  <Search
                    size={13}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-forest-400"
                  />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Caută…"
                    className="w-full rounded-lg border border-forest-200 bg-forest-50/50 py-1.5 pl-8 pr-2 text-sm outline-none transition placeholder:text-forest-400 focus:border-forest-500 focus:bg-white"
                  />
                </div>
              </div>
              <div className="max-h-[11.25rem] overflow-y-auto py-1">
                {filtered.map((o) => {
                  const selected = filter.value.includes(o);
                  return (
                    <button
                      key={o}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        filter.onChange(
                          selected
                            ? filter.value.filter((x) => x !== o)
                            : [...filter.value, o],
                        );
                        // dropdown-ul rămâne deschis — poți alege mai multe valori
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition hover:bg-forest-50 ${
                        selected ? "bg-forest-50/60 font-semibold text-forest-900" : "text-forest-700"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                          selected
                            ? "border-forest-700 bg-forest-700 text-white"
                            : "border-forest-300 bg-white"
                        }`}
                      >
                        {selected && <Check size={11} strokeWidth={3} />}
                      </span>
                      <span className="truncate">{o}</span>
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <p className="px-3 py-4 text-center text-xs text-forest-400">
                    Nicio valoare găsită.
                  </p>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )
      )}
    </th>
  );
}

export function TableCard({
  icon,
  title,
  subtitle,
  search,
  onSearch,
  placeholder,
  actions,
  error,
  children,
  footer,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  search: string;
  onSearch: (v: string) => void;
  placeholder: string;
  actions?: ReactNode;
  error?: string | null;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <section className="animate-fade-up overflow-hidden rounded-2xl border border-forest-100 bg-white shadow-[0_1px_3px_rgba(10,49,40,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-forest-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest-50 text-forest-600">
            {icon}
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-forest-900">{title}</h3>
            <p className="text-xs text-forest-500">{subtitle}</p>
          </div>
        </div>
        <div className="flex flex-1 justify-center px-4">
          <SearchInput value={search} onChange={onSearch} placeholder={placeholder} />
        </div>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
      <div className="max-h-[calc(100vh_-_17rem)] overflow-auto">{children}</div>
      {error && (
        <p className="border-t border-red-100 bg-red-50 px-5 py-2 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
      {footer}
    </section>
  );
}

export function Pagination({
  offset,
  count,
  hasMore,
  loading,
  onPrev,
  onNext,
}: {
  offset: number;
  /** Câte înregistrări sunt afișate pe pagina curentă (ex: 1, 10, 100). */
  count: number;
  hasMore: boolean;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-t border-forest-100 px-4 py-2.5 text-xs text-forest-600">
      <span className="num">
        {count === 0 ? "0" : `${offset + 1}–${offset + count}`}
      </span>
      <div className="flex gap-1.5">
        <button
          disabled={offset === 0 || loading}
          onClick={onPrev}
          className="flex items-center gap-1 rounded-md border border-forest-200 bg-white px-2.5 py-1 font-medium transition hover:border-forest-400 hover:text-forest-800 disabled:opacity-40"
        >
          <ChevronLeft size={13} />
          Înapoi
        </button>
        <button
          disabled={!hasMore || loading}
          onClick={onNext}
          className="flex items-center gap-1 rounded-md border border-forest-200 bg-white px-2.5 py-1 font-medium transition hover:border-forest-400 hover:text-forest-800 disabled:opacity-40"
        >
          Înainte
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}
