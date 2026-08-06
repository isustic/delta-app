import React from "react";
import { useEffect, useState } from "react";
import {
  BarChart3,
  ChevronRight,
  Database,
  Package,
  PanelLeft,
  Users,
} from "lucide-react";
import anuaraIcon from "./assets/anuara-icon.png";
import Produse from "./pages/Produse";
import Clienti from "./pages/Clienti";
import Rapoarte from "./pages/Rapoarte";

type Page = "produse" | "clienti" | "rapoarte";

const BAZA_CHILDREN: { id: Page; label: string; icon: typeof Package }[] = [
  { id: "produse", label: "Produse", icon: Package },
  { id: "clienti", label: "Clienți", icon: Users },
];

const SIDEBAR_KEY = "anuara.sidebar.expanded";

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || "");
const SHORTCUT = isMac ? "⌘B" : "Ctrl+B";
const TOGGLE_LABEL = "Comută bara laterală";

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
        <div className="flex h-full items-center justify-center bg-forest-50 p-6">
          <div className="max-w-md rounded-2xl border border-forest-100 bg-white p-8 text-center shadow-xl">
            <h1 className="font-display text-xl font-semibold text-forest-950">
              Aplicația a întâmpinat o eroare
            </h1>
            <p className="mt-2 text-sm text-forest-600">
              Datele din baza de date nu sunt afectate. Reîncarcă aplicația pentru a continua.
            </p>
            <p className="mt-3 break-words rounded-lg bg-forest-50 p-3 text-left font-mono text-xs text-forest-500">
              {this.state.error.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-xl bg-forest-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-forest-700"
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
  "overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out";

function ToggleTip({ pos }: { pos: string }) {
  return (
    <span
      className={`pointer-events-none absolute z-50 flex -translate-y-0 items-center gap-2 whitespace-nowrap rounded-lg border border-forest-700 bg-forest-900/95 px-3 py-1.5 text-xs font-medium text-forest-100 opacity-0 shadow-xl shadow-black/40 backdrop-blur-sm transition-all duration-150 scale-95 group-hover/tip:scale-100 group-hover/tip:opacity-100 ${pos}`}
    >
      <span>{TOGGLE_LABEL}</span>
      <kbd className="rounded border border-forest-700 bg-forest-800 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-forest-200">
        {SHORTCUT}
      </kbd>
    </span>
  );
}

function RailTip({ label, pos }: { label: string; pos: string }) {
  return (
    <span
      className={`pointer-events-none absolute z-50 -translate-y-1/2 whitespace-nowrap rounded-lg border border-forest-700 bg-forest-900/95 px-2.5 py-1.5 text-xs font-medium text-forest-100 opacity-0 shadow-xl shadow-black/40 backdrop-blur-sm transition-all duration-150 scale-95 group-hover/tip:scale-100 group-hover/tip:opacity-100 ${pos}`}
    >
      {label}
    </span>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("rapoarte");
  const [bazaOpen, setBazaOpen] = useState(false);
  const [expanded, setExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) !== "false";
    } catch {
      return true;
    }
  });

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
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const bazaActive = BAZA_CHILDREN.some((c) => c.id === page);
  const activeBaza = BAZA_CHILDREN.find((c) => c.id === page)?.id;

  return (
    <div className="flex h-full">
      <div
        className={`group/sidebar relative z-30 shrink-0 transition-[width] duration-300 ease-in-out ${
          expanded ? "w-64" : "w-[76px]"
        }`}
      >
        <aside className="flex h-full w-full flex-col bg-forest-950 text-forest-100">
          <div
            className={`flex items-center pb-6 pt-6 ${
              expanded ? "gap-3 px-5" : "justify-center px-0"
            }`}
          >
            <div className="group/logo relative shrink-0">
              <img
                src={anuaraIcon}
                alt=""
                className="h-10 w-10 rounded-xl shadow-[0_0_24px_rgba(251,191,36,0.2)]"
              />
              {!expanded && (
                <button
                  onClick={() => setExpanded(true)}
                  aria-label="Extinde bara laterală"
                  title="Extinde bara laterală"
                  className="group/tip absolute inset-0 flex items-center justify-center rounded-xl bg-forest-900 text-amber-300 opacity-0 transition-opacity duration-200 hover:bg-forest-800 hover:text-amber-200 focus-visible:opacity-100 group-hover/logo:opacity-100"
                >
                  <PanelLeft size={18} />
                  <ToggleTip pos="left-full top-1/2 ml-3" />
                </button>
              )}
            </div>

            <h1
              className={`${labelClip} font-display text-lg font-semibold leading-tight tracking-tight text-white ${
                expanded ? "max-w-40 opacity-100" : "max-w-0 opacity-0"
              }`}
            >
              Anuara
            </h1>

            {expanded && (
              <button
                onClick={() => setExpanded(false)}
                aria-label="Restrânge bara laterală"
                title="Restrânge bara laterală"
                className="group/tip relative ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-forest-400 transition-all duration-150 hover:bg-forest-800 hover:text-amber-300 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
              >
                <PanelLeft size={18} />
                <ToggleTip pos="right-0 top-full mt-2" />
              </button>
            )}
          </div>

          <nav className="flex flex-col gap-1.5 px-3">
            <button
              onClick={() => setPage("rapoarte")}
              className={`group group/tip relative flex items-center rounded-lg py-2.5 text-left transition-all duration-200 ${
                expanded ? "gap-3 px-3" : "justify-center gap-0 px-0"
              } ${
                page === "rapoarte"
                  ? "bg-forest-800/80 text-white"
                  : "text-forest-200 hover:bg-forest-900 hover:text-white"
              }`}
            >
              <span
                className={`absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-amber-400 transition-all duration-300 ${
                  page === "rapoarte"
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-40"
                }`}
              />
              <BarChart3
                size={18}
                className={`shrink-0 transition-colors ${
                  page === "rapoarte"
                    ? "text-amber-400"
                    : "text-forest-300 group-hover:text-amber-300"
                }`}
              />
              <span
                className={`${labelClip} text-sm font-semibold ${
                  expanded ? "max-w-40 opacity-100" : "max-w-0 opacity-0"
                }`}
              >
                Rapoarte
              </span>
              {!expanded && <RailTip label="Rapoarte" pos="left-full top-1/2 ml-3" />}
            </button>

            <div className="group/baza relative">
              <button
                onClick={() => {
                  if (expanded) setBazaOpen((o) => !o);
                  else setPage(activeBaza ?? "produse");
                }}
                className={`group relative flex w-full items-center rounded-lg py-2.5 text-left transition-all duration-200 ${
                  expanded ? "justify-between gap-3 px-3" : "justify-center gap-0 px-0"
                } ${
                  bazaActive
                    ? "bg-forest-900 text-white"
                    : "text-forest-200 hover:bg-forest-900 hover:text-white"
                }`}
              >
                <span
                  className={`flex min-w-0 items-center ${
                    expanded ? "gap-3" : "gap-0"
                  }`}
                >
                  <Database
                    size={18}
                    className={`shrink-0 transition-colors ${
                      bazaActive
                        ? "text-amber-400"
                        : "text-forest-300 group-hover:text-amber-300"
                    }`}
                  />
                  <span
                    className={`${labelClip} text-sm font-semibold ${
                      expanded ? "max-w-40 opacity-100" : "max-w-0 opacity-0"
                    }`}
                  >
                    Date de bază
                  </span>
                </span>
                <span
                  className={`${labelClip} ${
                    expanded ? "max-w-6 opacity-100" : "max-w-0 opacity-0"
                  }`}
                >
                  <ChevronRight
                    size={15}
                    className={`text-forest-400 transition-transform duration-200 ${
                      bazaOpen ? "rotate-90" : ""
                    }`}
                  />
                </span>
              </button>

              {!expanded && (
                <div className="invisible absolute left-full top-1/2 z-50 ml-3 min-w-[176px] -translate-y-1/2 translate-x-1 rounded-xl border border-forest-800 bg-forest-950 p-1.5 opacity-0 shadow-2xl shadow-black/50 transition-all duration-150 group-hover/baza:visible group-hover/baza:translate-x-0 group-hover/baza:opacity-100 focus-within:visible focus-within:translate-x-0 focus-within:opacity-100">
                  <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-forest-400">
                    Date de bază
                  </div>
                  {BAZA_CHILDREN.map((item) => {
                    const Icon = item.icon;
                    const active = page === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setPage(item.id)}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors ${
                          active
                            ? "bg-forest-800/80 text-white"
                            : "text-forest-200 hover:bg-forest-800 hover:text-white"
                        }`}
                      >
                        <Icon
                          size={15}
                          className={`shrink-0 transition-colors ${
                            active
                              ? "text-amber-400"
                              : "text-forest-400 group-hover:text-amber-300"
                          }`}
                        />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {expanded && bazaOpen && (
              <div className="overflow-hidden">
                <div className="ml-4 flex flex-col gap-1 border-l border-forest-800 pl-3">
                  {BAZA_CHILDREN.map((item) => {
                    const Icon = item.icon;
                    const active = page === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setPage(item.id)}
                        className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all duration-200 ${
                          active
                            ? "bg-forest-800/80 text-white"
                            : "text-forest-300 hover:bg-forest-900 hover:text-white"
                        }`}
                      >
                        <Icon
                          size={15}
                          className={`shrink-0 transition-colors ${
                            active
                              ? "text-amber-400"
                              : "text-forest-400 group-hover:text-amber-300"
                          }`}
                        />
                        <span className="text-sm font-medium">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </nav>

          {expanded && (
            <div className="mt-auto px-5 pb-5">
              <p className="whitespace-nowrap text-center text-[10px] tracking-wide text-forest-400/70">
                v1.0.1
              </p>
            </div>
          )}
        </aside>
      </div>

      <main className="app-bg flex-1 overflow-auto">
        {page === "produse" && <Produse />}
        {page === "clienti" && <Clienti />}
        {page === "rapoarte" && <Rapoarte />}
      </main>
    </div>
  );
}
