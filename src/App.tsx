import React from "react";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  ChevronRight,
  Database,
  Download,
  Monitor,
  Moon,
  Package,
  PanelLeft,
  Settings,
  Sun,
  Users,
} from "lucide-react";
import Produse from "./pages/Produse";
import Clienti from "./pages/Clienti";
import Rapoarte from "./pages/Rapoarte";
import { SegmentedControl } from "./components/ui";
import { useTheme } from "./lib/theme";
import type { AccentPref, ThemePref } from "./lib/theme";
import { useUpdater } from "./lib/useUpdater";

type Page = "produse" | "clienti" | "rapoarte";

const BAZA_CHILDREN: { id: Page; label: string; icon: LucideIcon }[] = [
  { id: "produse", label: "Produse", icon: Package },
  { id: "clienti", label: "Clienți", icon: Users },
];

const SIDEBAR_KEY = "delta.sidebar.expanded";

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || "");
const SHORTCUT = isMac ? "⌘B" : "Ctrl+B";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full items-center justify-center bg-subtle p-6">
          <div className="max-w-md rounded-card border border-stroke bg-card p-8 text-center shadow-elev-16">
            <h1 className="text-xl font-semibold text-fg">
              Aplicația a întâmpinat o eroare
            </h1>
            <p className="mt-2 text-sm text-fg-2">
              Datele din baza de date nu sunt afectate. Reîncarcă aplicația pentru a continua.
            </p>
            <p className="mt-3 break-words rounded-control bg-subtle p-3 text-left font-mono text-xs text-fg-3">
              {this.state.error.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-control bg-accent px-5 py-2 text-sm font-semibold text-on-accent transition hover:bg-accent-hover"
            >
              Reîncarcă
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export { ErrorBoundary };

const labelClip =
  "overflow-hidden whitespace-nowrap transition-all duration-200 ease-in-out";

const THEME_OPTIONS: { value: ThemePref; label: string; icon: LucideIcon }[] = [
  { value: "system", label: "Sistem", icon: Monitor },
  { value: "light", label: "Luminos", icon: Sun },
  { value: "dark", label: "Întunecat", icon: Moon },
];

const ACCENT_OPTIONS: { value: AccentPref; label: string }[] = [
  { value: "windows", label: "Windows" },
  { value: "fluent", label: "Albastru" },
];

/** Element de navigare în stil NavigationView: indicator accent pe stânga când e selectat. */
function NavButton({
  active,
  expanded,
  icon: Icon,
  label,
  onClick,
  trailing,
}: {
  active: boolean;
  expanded: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={expanded ? undefined : label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`relative flex h-9 w-full items-center rounded-control text-left text-sm transition-colors focus-visible:outline-offset-[-2px] ${
        expanded ? "justify-between gap-3 px-3" : "justify-center px-0"
      } ${
        active
          ? "bg-card font-semibold text-fg shadow-elev-4"
          : "text-fg-2 hover:bg-hover hover:text-fg active:bg-pressed"
      }`}
    >
      <span
        className={`absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent transition-opacity duration-200 ${
          active ? "opacity-100" : "opacity-0"
        }`}
      />
      <span className={`flex min-w-0 items-center ${expanded ? "gap-3" : ""}`}>
        <Icon
          size={16}
          strokeWidth={1.5}
          className={`shrink-0 ${active ? "text-accent-fg" : ""}`}
        />
        <span
          className={`${labelClip} ${
            expanded ? "max-w-40 opacity-100" : "max-w-0 opacity-0"
          }`}
        >
          {label}
        </span>
      </span>
      {trailing}
    </button>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("rapoarte");
  const [bazaOpen, setBazaOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expanded, setExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) !== "false";
    } catch {
      return true;
    }
  });
  const { pref, choose, accentPref, chooseAccent } = useTheme();
  const updater = useUpdater();

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, String(expanded));
    } catch {}
  }, [expanded]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        setExpanded((v) => !v);
      }
      if (e.key === "Escape") setSettingsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const bazaActive = BAZA_CHILDREN.some((c) => c.id === page);
  const activeBaza = BAZA_CHILDREN.find((c) => c.id === page)?.id;

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1">
        <div
          className={`group/sidebar relative z-30 shrink-0 transition-[width] duration-200 ease-in-out ${
            expanded ? "w-60" : "w-12"
          }`}
        >
          <aside className="flex h-full w-full flex-col px-2 pb-2 pt-1">
            <div
              className={`flex items-center py-2 ${
                expanded ? "justify-between pl-3 pr-1" : "justify-center"
              }`}
            >
              {expanded && (
                <span className="whitespace-nowrap text-xs font-semibold text-fg-2">
                  Navigare
                </span>
              )}
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-label={expanded ? "Restrânge bara laterală" : "Extinde bara laterală"}
                title={`${expanded ? "Restrânge" : "Extinde"} bara laterală (${SHORTCUT})`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-fg-2 transition-colors hover:bg-hover hover:text-fg active:bg-pressed"
              >
                <PanelLeft size={16} strokeWidth={1.5} />
              </button>
            </div>

            <nav className="mt-1 flex flex-col gap-0.5">
              <NavButton
                active={page === "rapoarte"}
                expanded={expanded}
                icon={BarChart3}
                label="Rapoarte"
                onClick={() => setPage("rapoarte")}
              />

              <div className="group/baza relative">
                <NavButton
                  active={bazaActive && !expanded}
                  expanded={expanded}
                  icon={Database}
                  label="Date"
                  onClick={() => {
                    if (expanded) setBazaOpen((o) => !o);
                    else setPage(activeBaza ?? "produse");
                  }}
                  trailing={
                    expanded ? (
                      <ChevronRight
                        size={14}
                        strokeWidth={1.5}
                        className={`shrink-0 text-fg-3 transition-transform duration-200 ${
                          bazaOpen ? "rotate-90" : ""
                        }`}
                      />
                    ) : undefined
                  }
                />
                {!expanded && (
                  <div className="invisible absolute left-full top-0 z-50 ml-2 min-w-44 rounded-overlay border border-stroke bg-card p-1 opacity-0 shadow-elev-16 transition-all duration-150 group-hover/baza:visible group-hover/baza:opacity-100 focus-within:visible focus-within:opacity-100">
                    <div className="px-2 pb-1 pt-1.5 text-xs font-semibold text-fg-2">
                      Date
                    </div>
                    {BAZA_CHILDREN.map((item) => (
                      <NavButton
                        key={item.id}
                        active={page === item.id}
                        expanded
                        icon={item.icon}
                        label={item.label}
                        onClick={() => setPage(item.id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {expanded && bazaOpen && (
                <div className="ml-5 flex flex-col gap-0.5 border-l border-stroke pl-2">
                  {BAZA_CHILDREN.map((item) => (
                    <NavButton
                      key={item.id}
                      active={page === item.id}
                      expanded
                      icon={item.icon}
                      label={item.label}
                      onClick={() => setPage(item.id)}
                    />
                  ))}
                </div>
              )}
            </nav>

            <div className="mt-auto flex flex-col gap-1">
              {expanded && (
                <p className="whitespace-nowrap px-3 pb-1 text-xs text-fg-3">
                  Delta v1.0.4
                </p>
              )}
              <div className="relative">
                <NavButton
                  active={settingsOpen}
                  expanded={expanded}
                  icon={Settings}
                  label="Setări"
                  onClick={() => setSettingsOpen((o) => !o)}
                  trailing={
                    expanded && updater.status === "available" ? (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
                    ) : undefined
                  }
                />
                {settingsOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setSettingsOpen(false)}
                    />
                    <div
                      role="dialog"
                      aria-label="Setări"
                      className={`absolute bottom-full z-50 mb-2 flex flex-col gap-4 rounded-overlay border border-stroke bg-card p-4 shadow-elev-28 ${
                        expanded ? "-left-2 w-60" : "left-0 w-72"
                      }`}
                    >
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-semibold text-fg-2">Temă</span>
                        <SegmentedControl
                          label="Temă"
                          value={pref}
                          onChange={choose}
                          options={THEME_OPTIONS}
                          iconOnly
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-semibold text-fg-2">Accent</span>
                        <SegmentedControl
                          label="Accent"
                          value={accentPref}
                          onChange={chooseAccent}
                          options={ACCENT_OPTIONS}
                        />
                      </div>
                      <div className="flex flex-col gap-2 border-t border-stroke pt-4">
                        <span className="text-xs font-semibold text-fg-2">Actualizări</span>
                        {updater.status === "available" && updater.update ? (
                          <>
                            <p className="text-sm text-fg">
                              Versiunea {updater.update.version} este disponibilă.
                            </p>
                            <button
                              type="button"
                              onClick={updater.installUpdate}
                              className="flex h-8 items-center justify-center gap-2 rounded-control bg-accent px-3 text-sm font-semibold text-on-accent transition hover:bg-accent-hover"
                            >
                              <Download size={14} strokeWidth={1.5} />
                              Instalează și repornește
                            </button>
                          </>
                        ) : updater.status === "installing" ? (
                          <p className="text-sm text-fg-2">Se descarcă și se instalează...</p>
                        ) : (
                          <>
                            <p className="text-sm text-fg-2">
                              {updater.status === "checking"
                                ? "Se verifică..."
                                : updater.status === "upToDate"
                                  ? "Aplicația este la zi."
                                  : updater.status === "error"
                                    ? "Nu s-a putut verifica actualizarea."
                                    : ""}
                            </p>
                            <button
                              type="button"
                              onClick={updater.checkForUpdate}
                              disabled={updater.status === "checking"}
                              className="flex h-8 items-center justify-center rounded-control border border-stroke px-3 text-sm text-fg transition hover:bg-hover disabled:opacity-50"
                            >
                              Verifică actualizări
                            </button>
                          </>
                        )}
                        {updater.status === "error" && updater.error && (
                          <p className="break-words font-mono text-xs text-fg-3">{updater.error}</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>

        <main className="flex min-w-0 flex-1 flex-col pb-2 pr-2">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-stroke bg-layer shadow-elev-4">
            <div className="min-h-0 flex-1 overflow-auto">
              {page === "produse" && <Produse />}
              {page === "clienti" && <Clienti />}
              {page === "rapoarte" && <Rapoarte />}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
