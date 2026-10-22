import { Tooltip } from "./Tooltip";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronDown, ChevronLeft, ChevronRight, Download, Filter, Plus, Search, Trash2, X } from "lucide-react";
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
    <Tooltip content={title}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="accent-accent"
      />
    </Tooltip>
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
    <div className="flex flex-wrap items-center gap-2 border-t border-stroke bg-subtle px-5 py-2.5">
      <span className="text-sm font-semibold text-accent-fg">
        {count.toLocaleString("ro-RO")} selectat{count === 1 ? "" : "e"}
      </span>
      <div className="ml-auto flex gap-2">
        <button
          type="button"
          onClick={onExport}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-control border border-stroke bg-card px-3 py-1.5 text-xs font-semibold text-accent-fg transition hover:bg-hover disabled:opacity-50"
        >
          <Download size={13} />
          Exportă selectate
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-control border border-danger-bg bg-card px-3 py-1.5 text-xs font-semibold text-danger transition hover:border-danger hover:bg-danger-bg disabled:opacity-50"
        >
          <Trash2 size={13} />
          Șterge selectate
        </button>
      </div>
    </div>
  );
}

export const inputCls =
  "w-full rounded-control border border-stroke-control bg-card px-3 py-1.5 text-sm text-fg outline-none transition placeholder:text-fg-3 focus:border-accent disabled:cursor-not-allowed disabled:opacity-60";

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
      <span className="text-xs font-semibold text-fg-2">
        {label}
      </span>
      {children}
      {hint && <span className="text-xs text-fg-3">{hint}</span>}
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
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4 backdrop-blur-sm"
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
        className={`animate-modal-in w-full ${width} overflow-hidden rounded-card bg-card shadow-elev-28`}
      >
        <div className="flex items-center justify-between border-b border-stroke px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-control bg-subtle text-fg-2">
              {icon}
            </div>
            <h3 className="font-sans text-base font-semibold text-fg">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-control p-1.5 text-fg-3 transition hover:bg-subtle hover:text-fg-2"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-between gap-2 border-t border-stroke bg-subtle/60 px-5 py-3.5">
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
      className="animate-fade-in fixed inset-0 z-[60] flex items-center justify-center bg-scrim p-4 backdrop-blur-sm"
      onClick={() => !busy && onClose()}
    >
      <div
        className="animate-modal-in w-full max-w-sm overflow-hidden rounded-card bg-card shadow-elev-28"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
      >
        <div className="h-1.5 bg-danger" />
        <div className="px-6 pb-5 pt-7 text-center">
          <div className="relative mx-auto flex h-14 w-14 items-center justify-center">
            <span className="animate-gen-pulse absolute inset-0 rounded-full bg-danger/15" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-danger-bg bg-danger-bg text-danger">
              <Trash2 size={22} />
            </div>
          </div>
          <h3 className="mt-4 font-sans text-xl font-semibold tracking-tight text-fg">
            {title}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-fg-2">{description}</p>
          {entity && (
            <div className="mt-3.5 inline-flex max-w-full items-center gap-2 rounded-control border border-danger-bg bg-danger-bg/70 px-3 py-1.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
              <span className="truncate font-mono text-xs font-semibold text-danger">
                {entity}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-stroke bg-subtle/60 px-5 py-3.5">
          <p className="mr-auto flex items-center gap-1.5 text-xs font-semibold text-fg-3">
            <AlertTriangle size={12} className="text-accent-fg" />
            Ireversibil
          </p>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            disabled={busy}
            className="rounded-control border border-stroke bg-card px-4 py-2 text-sm font-semibold text-fg-2 transition hover:border-stroke-control hover:bg-subtle disabled:opacity-50"
          >
            Anulează
          </button>
          <button
            type="button"
            onClick={confirma}
            disabled={busy}
            className="flex items-center gap-2 rounded-card bg-danger px-4 py-2 text-sm font-semibold text-on-danger shadow-elev-4 transition hover:bg-danger disabled:opacity-60"
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
  const ref = useRef<HTMLInputElement>(null);

  // Ctrl/Cmd+K mută focusul pe căutare.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.focus();
        ref.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative w-full max-w-md">
      <Search
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-3"
      />
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.stopPropagation();
            onChange("");
          }
        }}
        placeholder={placeholder}
        className="w-full rounded-control border border-stroke-control bg-card py-1.5 pl-9 pr-16 text-sm outline-none transition placeholder:text-fg-3 focus:border-accent"
      />
      {value ? (
        <Tooltip content="Șterge căutarea">
          <button
            type="button"

            onClick={() => {
              onChange("");
              ref.current?.focus();
            }}
            className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-control text-fg-3 transition hover:bg-hover hover:text-fg"
          >
            <X size={14} />
          </button>
        </Tooltip>
      ) : (
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-stroke bg-subtle px-1.5 py-0.5 font-sans text-[10px] font-medium text-fg-3">
          Ctrl K
        </kbd>
      )}
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
  items: ({ label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean } | { divider: true })[];
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
        className="group flex items-center gap-2 rounded-card border border-stroke bg-card px-4 py-2.5 text-sm font-semibold text-fg shadow-elev-4 transition hover:border-stroke-control hover:shadow disabled:opacity-50"
      >
        {icon && <span className="text-fg-3 transition group-hover:text-accent-fg">{icon}</span>}
        {label}
        <ChevronDown
          size={14}
          className={`text-fg-3 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: pos.top, left: pos.left }}
            className={`animate-fade-in fixed z-[100] min-w-[13rem] translate-y-0 overflow-hidden rounded-card border border-stroke bg-card py-1 shadow-elev-28 ${
              align === "right" ? "-translate-x-full" : ""
            }`}
          >
            {items.map((it, i) =>
              "divider" in it ? (
                <div key={`d${i}`} className="my-1 h-px bg-subtle" />
              ) : (
                <button
                  key={it.label}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    it.onSelect();
                  }}
                  className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium transition ${
                    it.danger
                      ? "text-danger hover:bg-danger-bg"
                      : "text-fg-2 hover:bg-subtle hover:text-fg"
                  }`}
                >
                  {it.icon && <span className={it.danger ? "" : "text-fg-3"}>{it.icon}</span>}
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
  allowCreate,
  onCreate,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  /** Dacă este setat, la căutarea fără rezultate apare „Adaugă „…"" */
  allowCreate?: boolean;
  onCreate?: (v: string) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
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
  const trimmed = query.trim();
  const exactMatch = options.some((o) => o.toLowerCase() === trimmed.toLowerCase());
  const showCreate = !!allowCreate && !!onCreate && trimmed !== "" && !exactMatch;

  async function handleCreate() {
    if (!trimmed || creating || !onCreate) return;
    setCreating(true);
    try {
      await onCreate(trimmed);
      onChange(trimmed);
      setOpen(false);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${inputCls} flex items-center justify-between gap-2 text-left ${
          value ? "text-fg" : "text-fg-3"
        }`}
      >
        <span className="truncate">{value || placeholder || "Alege…"}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-fg-3 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            className="animate-fade-in fixed z-[100] overflow-hidden rounded-card border border-stroke bg-card shadow-elev-28"
          >
            <div className="border-b border-stroke p-2">
              <div className="relative">
                <Search
                  size={13}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-3"
                />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && showCreate && filtered.length === 0) {
                      e.preventDefault();
                      handleCreate();
                    }
                  }}
                  placeholder="Caută…"
                  className="w-full rounded-control border border-stroke bg-card py-1.5 pl-8 pr-2 text-sm outline-none transition placeholder:text-fg-3 focus:border-accent focus:bg-card"
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
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition hover:bg-subtle ${
                      selected ? "bg-subtle/60 font-semibold text-fg" : "text-fg-2"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                        selected
                          ? "border-stroke bg-accent-hover text-on-accent"
                          : "border-stroke-control bg-card"
                      }`}
                    >
                      {selected && <Check size={11} strokeWidth={3} />}
                    </span>
                    <span className="truncate">{o}</span>
                  </button>
                );
              })}
              {filtered.length === 0 && !showCreate && (
                <p className="px-3 py-4 text-center text-xs text-fg-3">
                  Nicio valoare găsită.
                </p>
              )}
              {showCreate && (
                <button
                  type="button"
                  disabled={creating}
                  onClick={handleCreate}
                  className="flex w-full items-center gap-2 border-t border-stroke px-3 py-2 text-left text-sm font-semibold text-fg-2 transition hover:bg-accent-subtle hover:text-accent-fg disabled:opacity-60"
                >
                  {creating ? <Spinner /> : <Plus size={13} className="shrink-0 text-accent-fg" />}
                  Adaugă „{trimmed}"
                </button>
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
      <Tooltip content={filter ? "Sortează / filtrează" : undefined}>
        <button
          ref={btnRef}
          type="button"
          onClick={() => (filter ? setMenuOpen((o) => !o) : toggleSort())}
          className="group flex items-center gap-1 text-xs font-semibold text-fg-2 transition-colors hover:text-fg"

        >
          {label}
          {dir === "asc" ? (
            <ArrowUp size={13} className="text-accent-fg" />
          ) : dir === "desc" ? (
            <ArrowDown size={13} className="text-accent-fg" />
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
                  ? "text-accent-fg"
                  : "opacity-0 transition-opacity group-hover:opacity-60"
              }
            />
          )}
        </button>
      </Tooltip>

      {filter && menuOpen && pos && (
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            className="animate-fade-in fixed z-[100] overflow-hidden rounded-card border border-stroke bg-card shadow-elev-28"
          >
            <div className="border-b border-stroke px-3 py-2 text-xs font-semibold text-fg-3">
              {filter.placeholder}
            </div>
            <div className="flex flex-col gap-1.5 py-2">
              <span className="px-3 text-xs font-semibold text-fg-3">
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
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition hover:bg-subtle ${
                      selected ? "bg-subtle/60 font-semibold text-fg" : "text-fg-2"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                        selected
                          ? "border-stroke bg-accent-hover text-on-accent"
                          : "border-stroke-control bg-card"
                      }`}
                    >
                      {selected && <Check size={11} strokeWidth={3} />}
                    </span>
                    {o.label}
                  </button>
                );
              })}
            </div>
            <div className="my-1 h-px bg-subtle" />
            <div className="flex flex-col gap-1.5 py-2">
              <div className="flex items-center justify-between px-3">
                <span className="text-xs font-semibold text-fg-3">
                  Filtru
                </span>
                {filter.value.length > 0 && (
                  <button
                    type="button"
                    onClick={() => filter.onChange([])}
                    className="text-xs font-semibold text-fg-3 transition hover:text-fg"
                  >
                    Golește
                  </button>
                )}
              </div>
              <div className="px-3">
                <div className="relative">
                  <Search
                    size={13}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-3"
                  />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Caută…"
                    className="w-full rounded-control border border-stroke bg-card py-1.5 pl-8 pr-2 text-sm outline-none transition placeholder:text-fg-3 focus:border-accent focus:bg-card"
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
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition hover:bg-subtle ${
                        selected ? "bg-subtle/60 font-semibold text-fg" : "text-fg-2"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                          selected
                            ? "border-stroke bg-accent-hover text-on-accent"
                            : "border-stroke-control bg-card"
                        }`}
                      >
                        {selected && <Check size={11} strokeWidth={3} />}
                      </span>
                      <span className="truncate">{o}</span>
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <p className="px-3 py-4 text-center text-xs text-fg-3">
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
  search,
  onSearch,
  placeholder,
  summary,
  actions,
  error,
  children,
  footer,
}: {
  search: string;
  onSearch: (v: string) => void;
  placeholder: string;
  /** Text scurt în stânga barei de căutare (ex: numărul de rezultate). */
  summary?: ReactNode;
  actions?: ReactNode;
  error?: string | null;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <section className="animate-fade-up overflow-hidden rounded-card border border-stroke bg-card shadow-elev-4">
      <div className="grid grid-cols-[1fr_minmax(0,28rem)_1fr] items-center gap-4 border-b border-stroke px-5 py-4">
        <div className="num min-w-0 truncate text-sm font-medium text-fg-2">{summary}</div>
        <SearchInput value={search} onChange={onSearch} placeholder={placeholder} />
        <div className="flex items-center justify-end gap-2">{actions}</div>
      </div>
      <div className="max-h-[calc(100vh_-_17rem)] overflow-auto">{children}</div>
      {error && (
        <p className="border-t border-danger-bg bg-danger-bg px-5 py-2 text-xs font-medium text-danger">
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
    <div className="flex items-center justify-between border-t border-stroke px-4 py-2.5 text-xs text-fg-2">
      <span className="num">
        {count === 0 ? "0" : `${offset + 1}–${offset + count}`}
      </span>
      <div className="flex gap-1.5">
        <button
          disabled={offset === 0 || loading}
          onClick={onPrev}
          className="flex items-center gap-1 rounded-control border border-stroke bg-card px-2.5 py-1 font-medium transition hover:border-stroke-control hover:text-fg disabled:opacity-40"
        >
          <ChevronLeft size={13} />
          Înapoi
        </button>
        <button
          disabled={!hasMore || loading}
          onClick={onNext}
          className="flex items-center gap-1 rounded-control border border-stroke bg-card px-2.5 py-1 font-medium transition hover:border-stroke-control hover:text-fg disabled:opacity-40"
        >
          Înainte
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}
