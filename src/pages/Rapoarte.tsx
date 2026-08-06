import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  History,
  Layers,
  PackagePlus,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  exportRaportData,
  filtreazaProduseLipsa,
  genereazaRaport,
  getProdus,
  incarcaRaport,
  listaRapoarte,
  salveazaRaport,
  stergeRaport,
  type Mismatch,
  type Produs,
  type RaportSalvat,
  type Report,
} from "../lib/api";
import { Spinner, ToastHost, useToasts } from "../components/ui";
import { ConfirmDeleteModal } from "../components/shared";
import { EditProdusModal, AddProdusModal, LipsaProduseModal } from "./Produse";

const nf = new Intl.NumberFormat("ro-RO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DIM_PAGINA = 10;

function fileName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

function yearFromName(path: string): string | null {
  const m = fileName(path).match(/(?:19|20)\d{2}/g);
  return m ? m[m.length - 1] : null;
}

function formatData(s: string): string {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return s;
  return `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}`;
}

function bazaGrupa(label: string): string {
  if (label.endsWith(" - Tehnic")) return label.slice(0, -" - Tehnic".length);
  if (label.endsWith(" - Retail")) return label.slice(0, -" - Retail".length);
  return label;
}

function grupeDinColoane(coloane: string[]): string[] {
  const set = new Set<string>();
  for (const c of coloane) set.add(bazaGrupa(c));
  return [...set];
}

type MatrixRow = { lead: string[]; vals: [number, number][]; nou?: boolean };

function DiffCell({ v1, v2, maxAbs }: { v1: number; v2: number; maxAbs: number }) {
  const d = v2 - v1;
  const intensity = maxAbs > 0 ? Math.min(1, Math.abs(d) / maxAbs) : 0;
  const bg =
    d > 0
      ? `rgba(22,101,71,${(0.05 + intensity * 0.24).toFixed(3)})`
      : d < 0
        ? `rgba(185,28,28,${(0.04 + intensity * 0.2).toFixed(3)})`
        : "transparent";
  const tone = d > 0 ? "text-emerald-800" : d < 0 ? "text-red-600" : "text-forest-300";
  return (
    <td
      className="num border-b border-l border-r-2 border-forest-100/70 border-r-forest-200 px-2 py-1 text-right transition-colors group-hover:bg-forest-50/40"
      style={{ backgroundColor: bg }}
    >
      <span className={`inline-flex items-center gap-1 font-semibold ${tone}`}>
        {d > 0 ? (
          <TrendingUp size={11} strokeWidth={2.5} />
        ) : d < 0 ? (
          <TrendingDown size={11} strokeWidth={2.5} />
        ) : null}
        {nf.format(d)}
      </span>
    </td>
  );
}

function MatrixTable({
  leadHeaders,
  leadWidths,
  rows,
  columns,
  an1,
  an2,
  total,
}: {
  leadHeaders: string[];
  leadWidths: number[];
  rows: MatrixRow[];
  columns: string[];
  an1: string;
  an2: string;
  total?: MatrixRow | null;
}) {
  const lefts = useMemo(() => {
    const acc: number[] = [];
    let sum = 0;
    for (const w of leadWidths) {
      acc.push(sum);
      sum += w;
    }
    return acc;
  }, [leadWidths]);

  const maxAbs = useMemo(() => {
    let m = 0;
    for (const r of rows)
      for (const [a, b] of r.vals) m = Math.max(m, Math.abs(b - a));
    return m;
  }, [rows]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const proxyRef = useRef<HTMLDivElement>(null);
  const locking = useRef(false);
  const [dims, setDims] = useState({ sw: 0, cw: 0 });
  const overflow = dims.sw - dims.cw > 1;

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setDims({ sw: el.scrollWidth, cw: el.clientWidth });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const table = el.querySelector("table");
    if (table) ro.observe(table);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  useEffect(() => {
    measure();
  }, [rows, columns, leadWidths, measure]);

  const syncFromTable = () => {
    if (locking.current) return;
    locking.current = true;
    const t = scrollRef.current;
    const p = proxyRef.current;
    if (t && p) p.scrollLeft = t.scrollLeft;
    locking.current = false;
  };

  const syncFromProxy = () => {
    if (locking.current) return;
    locking.current = true;
    const t = scrollRef.current;
    const p = proxyRef.current;
    if (t && p) t.scrollLeft = p.scrollLeft;
    locking.current = false;
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={scrollRef}
        onScroll={syncFromTable}
        className="no-scrollbar overflow-auto rounded-2xl border border-forest-100 bg-white shadow-[0_1px_3px_rgba(10,49,40,0.06)]"
      >
      <table className="border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            {leadHeaders.map((h, j) => (
              <th
                key={j}
                rowSpan={2}
                style={{ left: lefts[j], width: leadWidths[j], minWidth: leadWidths[j] }}
                className="sticky top-0 z-30 border-b border-r border-forest-700 bg-forest-900 px-3 py-2 text-left font-semibold text-white"
              >
                {h}
              </th>
            ))}
            {columns.map((c, k) => (
              <th
                key={k}
                colSpan={3}
                className={`sticky top-0 z-20 border-b border-r-2 border-forest-600 bg-forest-900 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-forest-100 ${
                  k % 2 === 0 ? "" : "bg-forest-800"
                }`}
              >
                {c}
              </th>
            ))}
          </tr>
          <tr>
            {columns.map((_, k) => (
              <Fragment key={k}>
                <th
                  className={`num sticky top-[34px] z-10 border-b border-forest-200 px-2 py-1.5 text-right font-semibold text-forest-600 ${
                    k % 2 === 0 ? "bg-forest-50" : "bg-forest-100/80"
                  }`}
                >
                  {an1}
                </th>
                <th
                  className={`num sticky top-[34px] z-10 border-b border-l border-forest-200/70 px-2 py-1.5 text-right font-semibold text-forest-600 ${
                    k % 2 === 0 ? "bg-forest-50" : "bg-forest-100/80"
                  }`}
                >
                  {an2}
                </th>
                <th
                  className={`sticky top-[34px] z-10 border-b border-l border-r-2 border-forest-200/70 border-r-forest-300 px-2 py-1.5 text-right font-semibold text-amber-800 ${
                    k % 2 === 0 ? "bg-amber-100/70" : "bg-amber-200/60"
                  }`}
                >
                  Dif.
                </th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="group">
              {row.lead.map((val, j) => (
                <td
                  key={j}
                  style={{ left: lefts[j], width: leadWidths[j], minWidth: leadWidths[j] }}
                  className={`sticky z-10 border-b border-r border-forest-100 px-3 py-1.5 transition-colors group-hover:bg-forest-50 ${
                    j === 0 ? "bg-white font-semibold text-forest-900" : "bg-white text-forest-600"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="truncate">{val}</span>
                    {j === 0 && row.nou && (
                      <span className="shrink-0 rounded-full bg-amber-400 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-forest-950">
                        Nou
                      </span>
                    )}
                  </span>
                </td>
              ))}
              {row.vals.map(([v1, v2], k) => (
                <Fragment key={k}>
                  <td
                    className={`num border-b border-forest-50 px-2 py-1 text-right text-forest-700 transition-colors group-hover:bg-forest-50/60 ${
                      k % 2 === 1 ? "bg-forest-50/40" : ""
                    }`}
                  >
                    {nf.format(v1)}
                  </td>
                  <td
                    className={`num border-b border-l border-forest-50 border-l-forest-100/60 px-2 py-1 text-right text-forest-700 transition-colors group-hover:bg-forest-50/60 ${
                      k % 2 === 1 ? "bg-forest-50/40" : ""
                    }`}
                  >
                    {nf.format(v2)}
                  </td>
                  <DiffCell v1={v1} v2={v2} maxAbs={maxAbs} />
                </Fragment>
              ))}
            </tr>
          ))}
        </tbody>
        {total && (
          <tfoot>
            <tr>
              {total.lead.map((val, j) => (
                <td
                  key={j}
                  style={{ left: lefts[j], width: leadWidths[j], minWidth: leadWidths[j] }}
                  className="sticky z-10 border-t border-r border-forest-300 bg-forest-900 px-3 py-2 font-bold text-white"
                >
                  {val}
                </td>
              ))}
              {total.vals.map(([v1, v2], k) => {
                const d = v2 - v1;
                return (
                  <Fragment key={k}>
                    <td
                      className={`num border-t border-forest-300 px-2 py-2 text-right font-bold text-forest-100 ${
                        k % 2 === 0 ? "bg-forest-900" : "bg-forest-800"
                      }`}
                    >
                      {nf.format(v1)}
                    </td>
                    <td
                      className={`num border-t border-l border-forest-300 border-l-forest-700 px-2 py-2 text-right font-bold text-forest-100 ${
                        k % 2 === 0 ? "bg-forest-900" : "bg-forest-800"
                      }`}
                    >
                      {nf.format(v2)}
                    </td>
                    <td
                      className={`num border-t border-l border-r-2 border-forest-300 border-r-forest-600 bg-forest-900 px-2 py-2 text-right font-bold ${
                        d < 0 ? "text-red-300" : "text-amber-300"
                      }`}
                    >
                      {nf.format(d)}
                    </td>
                  </Fragment>
                );
              })}
            </tr>
          </tfoot>
        )}
      </table>
      </div>
      {overflow && (
        <div
          ref={proxyRef}
          onScroll={syncFromProxy}
          className="hscroll-proxy sticky bottom-3 z-30 h-2.5 overflow-x-auto overflow-y-hidden rounded-full bg-forest-100/70 shadow-[0_-8px_18px_-10px_rgba(10,49,40,0.35)] backdrop-blur-sm transition-colors duration-200 hover:bg-forest-200/80"
        >
          <div style={{ width: dims.sw }} className="h-px" />
        </div>
      )}
    </div>
  );
}

function FileSlot({
  hint,
  path,
  onPick,
  onClear,
}: {
  hint: string;
  path: string | null;
  onPick: (p: string) => void;
  onClear?: () => void;
}) {
  async function pick() {
    const file = await open({ multiple: false, filters: [{ name: "Excel", extensions: ["xlsx"] }] });
    if (file) onPick(file as string);
  }
  return (
    <div className="relative flex-1">
      <button
        onClick={pick}
        className={`group flex min-h-[3.5rem] w-full items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 text-left transition-all ${
          path
            ? "border-forest-300 bg-white"
            : "border-forest-200 bg-white hover:border-amber-400 hover:bg-amber-50/50"
        }`}
      >
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${
            path ? "bg-forest-700 text-amber-300" : "bg-forest-100 text-forest-600 group-hover:bg-amber-400 group-hover:text-forest-950"
          }`}
        >
          <FileSpreadsheet size={18} />
        </div>
        <div className="min-w-0">
          {path ? (
            <p className="truncate text-sm font-semibold text-forest-900">{fileName(path)}</p>
          ) : (
            <p className="text-sm text-forest-400">{hint} — alege sau trage fișier</p>
          )}
        </div>
      </button>
      {path && onClear && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          title="Șterge fișierul"
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-forest-200 bg-white text-forest-400 shadow-sm transition hover:border-red-300 hover:bg-red-50 hover:text-red-500"
        >
          <X size={11} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

function YearCard({
  role,
  subtext,
  an,
  onAn,
  path,
  onPick,
  onClear,
}: {
  role: string;
  subtext: string;
  an: string;
  onAn: (v: string) => void;
  path: string | null;
  onPick: (p: string) => void;
  onClear?: () => void;
}) {
  return (
    <div className="flex min-w-[15rem] flex-1 flex-col gap-2 rounded-xl border border-forest-100 bg-forest-50/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-forest-700">{role}</p>
          <p className="text-[10px] text-forest-400">{subtext}</p>
        </div>
        <input
          value={an}
          onChange={(e) => onAn(e.target.value)}
          aria-label={role}
          className="num w-20 shrink-0 rounded-lg border border-forest-200 bg-white px-2 py-1.5 text-center text-sm font-bold text-forest-900 outline-none transition focus:border-forest-500 focus:ring-2 focus:ring-forest-500/15"
        />
      </div>
      <FileSlot hint="Standard ian–iun" path={path} onPick={onPick} onClear={onClear} />
    </div>
  );
}

function GeneratingPanel({ an1, an2 }: { an1: string; an2: string }) {
  const STAGES = [
    { label: "Citire", text: "Citesc și parsez cele două rapoarte Excel…" },
    { label: "Corelare", text: "Corelez codurile cu grupele din baza de date…" },
    { label: "Agregare", text: "Agreg valorile contabile pe clienți, agenți și grupe…" },
    { label: "Matrice", text: "Construiesc matricea comparativă și sumarizarea…" },
  ];
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setStage((s) => (s < STAGES.length - 1 ? s + 1 : s));
    }, 3000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = Math.round(((stage + 1) / STAGES.length) * 100);
  const an1Bars = [0.5, 0.85, 0.35, 0.7];
  const an2Bars = [0.7, 0.4, 0.95, 0.55];

  return (
    <div className="animate-fade-up overflow-visible rounded-2xl border border-forest-100 bg-white shadow-[0_8px_40px_rgba(10,49,40,0.1)]">
      <div className="h-[3px] w-full rounded-t-2xl bg-gradient-to-r from-forest-700 via-forest-500 to-amber-400" />

      <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:p-8">
        <div className="relative flex items-center justify-center overflow-hidden rounded-2xl border border-forest-100 bg-forest-50/50 p-6">
          <div
            className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full opacity-60 blur-2xl"
            style={{ background: "radial-gradient(circle, rgba(39,135,101,0.22), transparent 70%)" }}
          />
          <div
            className="pointer-events-none absolute -bottom-12 -right-8 h-44 w-44 rounded-full opacity-60 blur-2xl"
            style={{ background: "radial-gradient(circle, rgba(251,191,36,0.22), transparent 70%)" }}
          />

          <div className="relative flex w-full items-end justify-center gap-5">
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-24 items-end gap-1.5">
                {an1Bars.map((h, i) => (
                  <span
                    key={i}
                    className="w-3 origin-bottom rounded-t-md bg-gradient-to-t from-forest-600 to-forest-400"
                    style={{ height: `${h * 100}%`, animation: "var(--animate-gen-bar)", animationDelay: `${i * 0.13}s` }}
                  />
                ))}
              </div>
              <span className="num rounded-full bg-forest-100 px-2.5 py-0.5 text-[11px] font-bold text-forest-700">
                {an1}
              </span>
            </div>

            <div className="relative mb-7 flex h-12 w-16 flex-col items-center justify-center">
              <div className="absolute h-10 w-10 rounded-full border-2 border-forest-200 border-t-amber-400" style={{ animation: "var(--animate-gen-ring)" }} />
              <Zap size={15} className="relative text-amber-500" style={{ animation: "var(--animate-gen-pulse)" }} />
              <div className="absolute -bottom-1 flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-amber-400"
                    style={{ animation: "var(--animate-gen-flow)", animationDelay: `${i * 0.35}s` }}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="flex h-24 items-end gap-1.5">
                {an2Bars.map((h, i) => (
                  <span
                    key={i}
                    className="w-3 origin-bottom rounded-t-md bg-gradient-to-t from-amber-500 to-amber-300"
                    style={{ height: `${h * 100}%`, animation: "var(--animate-gen-bar)", animationDelay: `${i * 0.13 + 0.4}s` }}
                  />
                ))}
              </div>
              <span className="num rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                {an2}
              </span>
            </div>
          </div>

          <div className="absolute bottom-4 left-1/2 grid -translate-x-1/2 grid-cols-6 gap-1">
            {Array.from({ length: 18 }).map((_, i) => (
              <span
                key={i}
                className={`h-2 w-3 rounded-[3px] ${i % 3 === 0 ? "bg-amber-300/70" : "bg-forest-300/60"}`}
                style={{ animation: "var(--animate-gen-cell)", animationDelay: `${(i % 6) * 0.1 + Math.floor(i / 6) * 0.2}s` }}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-center gap-5">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-600">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </span>
              Procesare în curs
            </p>
            <h3 className="mt-2 font-display text-3xl font-semibold leading-tight tracking-tight text-forest-950">
              Se generează raportul
            </h3>
            <p key={stage} className="animate-fade-in mt-2 min-h-[1.5rem] text-sm text-forest-600">
              {STAGES[stage].text}
            </p>
          </div>

          <div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-forest-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-forest-600 via-forest-500 to-amber-400 transition-all duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
              <div className="absolute inset-y-0 left-0 w-1/3 overflow-hidden rounded-full">
                <span
                  className="block h-full w-full bg-gradient-to-r from-transparent via-white/60 to-transparent"
                  style={{ animation: "var(--animate-gen-sweep)" }}
                />
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="num text-[11px] font-bold text-forest-500">{pct}%</span>
              <span className="text-[11px] text-forest-400">nu închide aplicația</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {STAGES.map((s, i) => {
              const done = i < stage;
              const active = i === stage;
              return (
                <span
                  key={s.label}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all duration-300 ${
                    active
                      ? "bg-amber-400 text-forest-950 shadow-[0_2px_10px_rgba(251,191,36,0.4)]"
                      : done
                        ? "bg-forest-700 text-white"
                        : "bg-forest-50 text-forest-400"
                  }`}
                >
                  {done ? (
                    <Check size={12} strokeWidth={3} />
                  ) : (
                    <span className={`num ${active ? "" : "opacity-70"}`}>{i + 1}</span>
                  )}
                  {s.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function NeconcordanteBanner({
  items,
  onEdit,
}: {
  items: Mismatch[];
  onEdit: (m: Mismatch) => void;
}) {
  const [deschis, setDeschis] = useState(false);
  const lipsa = items.filter((m) => m.lipsa_bd).length;
  const dif = items.length - lipsa;
  if (items.length === 0) return null;
  return (
    <div className="animate-fade-up overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/60 shadow-[0_2px_10px_rgba(10,49,40,0.06)]">
      <button
        onClick={() => setDeschis((d) => !d)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-amber-50"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400 text-forest-950">
            <AlertTriangle size={16} />
          </span>
          <div>
            <p className="text-sm font-bold text-forest-900">
              {items.length} produs{items.length === 1 ? "" : "e"} de verificat
            </p>
            <p className="text-[11px] text-forest-500">
              {dif > 0 && <>{dif} cu grupă diferită față de fișier</>}
              {dif > 0 && lipsa > 0 && " · "}
              {lipsa > 0 && <span className="font-semibold text-red-600">{lipsa} lipsă din baza de date</span>}
            </p>
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-amber-600 transition ${deschis ? "rotate-180" : ""}`}
        />
      </button>

      {deschis && (
        <div className="border-t border-amber-200/70">
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-amber-100/80 text-[10px] uppercase tracking-wider text-forest-600">
                <tr>
                  <th className="px-4 py-2 font-semibold">Cod</th>
                  <th className="px-3 py-2 font-semibold">Produs</th>
                  <th className="px-3 py-2 font-semibold">În fișier</th>
                  <th className="px-3 py-2 font-semibold">În baza de date</th>
                  <th className="px-4 py-2 text-right font-semibold">An</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {items.map((m, i) => (
                  <tr
                    key={i}
                    className={`transition hover:bg-amber-50/60 ${
                      m.lipsa_bd ? "bg-red-50/50" : "bg-white"
                    }`}
                  >
                    <td className="num px-4 py-1.5 font-mono text-forest-700">
                      <span className="flex items-center gap-1.5">
                        {m.lipsa_bd && (
                          <span
                            title="Codul nu există în baza de date"
                            className="rounded-full bg-red-600 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white"
                          >
                            Lipsă
                          </span>
                        )}
                        {m.cod}
                      </span>
                    </td>
                    <td className="max-w-[16rem] px-3 py-1.5">
                      <button
                        onClick={() => onEdit(m)}
                        title={`Editează ${m.denumire}`}
                        className="block w-full truncate text-left text-forest-900 underline-offset-2 transition hover:text-forest-700 hover:underline"
                      >
                        {m.denumire}
                      </button>
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="rounded-full bg-forest-100 px-2 py-0.5 font-semibold text-forest-700">
                        {m.grupa_fisier}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      {m.lipsa_bd ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700">
                          —
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-200/80 px-2 py-0.5 font-semibold text-forest-800">
                          {m.grupa_bd}
                        </span>
                      )}
                    </td>
                    <td className="num px-4 py-1.5 text-right font-semibold text-forest-600">
                      {m.an}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-amber-200/70 px-4 py-2 text-[11px] text-forest-500">
            Poți corecta grupele din pagina Produse dacă grupa din baza de date nu este cea dorită.
          </p>
        </div>
      )}
    </div>
  );
}

function GrupaFilter({
  grupe,
  selectate,
  onToggle,
  onAll,
  onClear,
}: {
  grupe: string[];
  selectate: string[];
  onToggle: (g: string) => void;
  onAll: () => void;
  onClear: () => void;
}) {
  const [deschis, setDeschis] = useState(false);
  const [cautare, setCautare] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!deschis) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setDeschis(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDeschis(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [deschis]);

  const q = cautare.trim().toLowerCase();
  const lista = grupe.filter((g) => q === "" || g.toLowerCase().includes(q));
  const selSet = new Set(selectate);
  const activ = selectate.length < grupe.length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setDeschis((d) => !d)}
        className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold shadow-sm transition active:scale-[0.98] ${
          activ
            ? "border-forest-500 bg-forest-50 text-forest-900"
            : "border-forest-200 bg-white text-forest-700 hover:border-forest-400"
        }`}
      >
        <Layers size={15} className={activ ? "text-amber-600" : "text-forest-500"} />
        Grupe
        {activ && (
          <span className="num rounded-full bg-amber-400 px-1.5 text-[11px] font-bold text-forest-950">
            {selectate.length}
          </span>
        )}
        <ChevronDown
          size={14}
          className={`text-forest-400 transition ${deschis ? "rotate-180" : ""}`}
        />
      </button>

      {deschis && (
        <div className="animate-fade-in absolute right-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-2xl border border-forest-100 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-forest-100 px-3.5 py-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-forest-500">
              Filter grupe
            </span>
            <div className="flex gap-3 text-[11px] font-semibold">
              <button onClick={onAll} className="text-forest-500 transition hover:text-forest-900">
                Toate
              </button>
              <button onClick={onClear} className="text-forest-500 transition hover:text-forest-900">
                Golește
              </button>
            </div>
          </div>
          <div className="border-b border-forest-100 p-2.5">
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-forest-400"
              />
              <input
                value={cautare}
                onChange={(e) => setCautare(e.target.value)}
                placeholder="Caută grupă…"
                className="w-full rounded-lg border border-forest-200 bg-forest-50/50 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-forest-400 focus:border-forest-500 focus:bg-white"
              />
            </div>
          </div>
          <div className="max-h-72 overflow-auto py-1">
            {lista.map((g) => {
              const on = selSet.has(g);
              return (
                <button
                  key={g}
                  onClick={() => onToggle(g)}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition hover:bg-forest-50"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                      on ? "border-forest-700 bg-forest-700 text-white" : "border-forest-300 bg-white"
                    }`}
                  >
                    {on && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span
                    className={`truncate ${on ? "font-semibold text-forest-900" : "text-forest-700"}`}
                  >
                    {g}
                  </span>
                </button>
              );
            })}
            {lista.length === 0 && (
              <p className="px-3.5 py-6 text-center text-sm text-forest-400">Nicio grupă găsită.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AgentFilter({
  agenti,
  value,
  onChange,
}: {
  agenti: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [deschis, setDeschis] = useState(false);
  const [cautare, setCautare] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!deschis) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setDeschis(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDeschis(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [deschis]);

  const q = cautare.trim().toLowerCase();
  const lista = agenti.filter((a) => q === "" || a.toLowerCase().includes(q));

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setDeschis((d) => !d)}
        className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold shadow-sm transition active:scale-[0.98] ${
          value
            ? "border-forest-500 bg-forest-50 text-forest-900"
            : "border-forest-200 bg-white text-forest-700 hover:border-forest-400"
        }`}
      >
        <Users size={15} className={value ? "text-amber-600" : "text-forest-500"} />
        <span className="max-w-[10rem] truncate">{value || "Toți agenții"}</span>
        <ChevronDown
          size={14}
          className={`text-forest-400 transition ${deschis ? "rotate-180" : ""}`}
        />
      </button>

      {deschis && (
        <div className="animate-fade-in absolute right-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-2xl border border-forest-100 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-forest-100 px-3.5 py-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-forest-500">
              Agent
            </span>
            {value !== "" && (
              <button
                onClick={() => onChange("")}
                className="text-[11px] font-semibold text-forest-500 transition hover:text-forest-900"
              >
                Resetează
              </button>
            )}
          </div>
          <div className="border-b border-forest-100 p-2.5">
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-forest-400"
              />
              <input
                value={cautare}
                onChange={(e) => setCautare(e.target.value)}
                placeholder="Caută agent…"
                className="w-full rounded-lg border border-forest-200 bg-forest-50/50 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-forest-400 focus:border-forest-500 focus:bg-white"
              />
            </div>
          </div>
          <div className="max-h-72 overflow-auto py-1">
            <button
              onClick={() => {
                onChange("");
                setDeschis(false);
              }}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition hover:bg-forest-50 ${
                value === "" ? "bg-forest-50/60" : ""
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${
                  value === "" ? "border-forest-700 bg-forest-700 text-white" : "border-forest-300 bg-white"
                }`}
              >
                {value === "" && <Check size={12} strokeWidth={3} />}
              </span>
              <span
                className={`truncate ${value === "" ? "font-semibold text-forest-900" : "text-forest-700"}`}
              >
                Toți agenții
              </span>
            </button>
            {lista.map((a) => {
              const on = a === value;
              return (
                <button
                  key={a}
                  onClick={() => {
                    onChange(a);
                    setDeschis(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition hover:bg-forest-50"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${
                      on ? "border-forest-700 bg-forest-700 text-white" : "border-forest-300 bg-white"
                    }`}
                  >
                    {on && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className={`truncate ${on ? "font-semibold text-forest-900" : "text-forest-700"}`}>
                    {a}
                  </span>
                </button>
              );
            })}
            {lista.length === 0 && (
              <p className="px-3.5 py-6 text-center text-sm text-forest-400">Niciun agent găsit.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Rapoarte() {
  const [path1, setPath1] = useState<string | null>(null);
  const [path2, setPath2] = useState<string | null>(null);
  const [an1, setAn1] = useState("2025");
  const [an2, setAn2] = useState("2026");
  const [report, setReport] = useState<Report | null>(null);
  const [view, setView] = useState<"clienti" | "sumar">("clienti");
  const [agentFilter, setAgentFilter] = useState<string>("");
  const [clientSearch, setClientSearch] = useState("");
  const [grupeSelectate, setGrupeSelectate] = useState<string[]>([]);
  const [generez, setGenerez] = useState(false);
  const [seIncarca, setSeIncarca] = useState(false);
  const [seExporta, setSeExporta] = useState(false);
  // Orice operație lungă blochează acțiunile concurente; panoul de generare
  // apare doar la generare efectivă, nu la încărcare/export.
  const busy = generez || seIncarca || seExporta;
  const [dragOver, setDragOver] = useState(false);
  const [visible, setVisible] = useState(100);
  const [istoric, setIstoric] = useState<RaportSalvat[]>([]);
  const [activId, setActivId] = useState<number | null>(null);
  const [deSters, setDeSters] = useState<RaportSalvat | null>(null);
  const [istoricSearch, setIstoricSearch] = useState("");
  const [pagina, setPagina] = useState(1);
  const [editProdus, setEditProdus] = useState<Produs | null>(null);
  const [addProdus, setAddProdus] = useState<{
    cod: string;
    denumire: string;
    grupa: string;
  } | null>(null);
  const [lipsa, setLipsa] = useState<Produs[] | null>(null);
  const [lipsaYear, setLipsaYear] = useState("2026");
  const { toasts, push } = useToasts();

  useEffect(() => {
    listaRapoarte()
      .then(setIstoric)
      .catch(() => {});
  }, []);

  const stateRef = useRef({ path1: null as string | null, path2: null as string | null });
  stateRef.current = { path1, path2 };

  function setSlot(slot: 1 | 2, p: string) {
    const y = yearFromName(p);
    if (slot === 1) {
      setPath1(p);
      if (y) setAn1(y);
    } else {
      setPath2(p);
      if (y) setAn2(y);
    }
  }

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    getCurrentWindow()
      .onDragDropEvent((e) => {
        const p = e.payload;
        if (p.type === "enter" || p.type === "over") setDragOver(true);
        if (p.type === "leave") setDragOver(false);
        if (p.type === "drop") {
          setDragOver(false);
          const files = (p.paths ?? []).filter((x) => x.toLowerCase().endsWith(".xlsx"));
          if (files.length === 0) return;
          if (files.length >= 2) {
            const y0 = yearFromName(files[0]);
            const y1 = yearFromName(files[1]);
            if (y0 && y1 && y0 !== y1 && y0 > y1) {
              setSlot(1, files[1]);
              setSlot(2, files[0]);
            } else {
              setSlot(1, files[0]);
              setSlot(2, files[1]);
            }
            push("info", "Ambele fișiere au fost încărcate.");
          } else {
            const st = stateRef.current;
            if (!st.path1) setSlot(1, files[0]);
            else setSlot(2, files[0]);
            push("info", `Fișier încărcat: ${fileName(files[0])}`);
          }
        }
      })
      .then((u) => {
        if (cancelled) u();
        else unlisten = u;
      });
    return () => {
      cancelled = true;
      unlisten?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anulValid = /^\d{4}$/.test(an1) && /^\d{4}$/.test(an2) && an1 !== an2;

  async function genereaza() {
    if (!path1 || !path2 || !anulValid) return;
    if (path1 === path2) {
      push("error", "Alege două fișiere diferite pentru comparație.");
      return;
    }
    setGenerez(true);
    try {
      const r = await genereazaRaport(path1, path2, an1, an2);
      setReport(r);
      setView("clienti");
      setAgentFilter("");
      setClientSearch("");
      setGrupeSelectate(grupeDinColoane(r.coloane));
      setVisible(100);
      push("success", `Raport generat: ${r.clienti.length} clienți, ${r.sumar.length} agenți.`);
      try {
        const id = await salveazaRaport(r, fileName(path1), fileName(path2));
        const lista = await listaRapoarte();
        setActivId(id);
        setIstoric(lista);
      } catch (e) {
        setActivId(null);
        push("error", `Raportul nu a putut fi salvat în istoric: ${e}`);
      }
    } catch (e) {
      push("error", e instanceof Error ? e.message : String(e));
    } finally {
      setGenerez(false);
    }
  }

  async function deschide(id: number) {
    setSeIncarca(true);
    try {
      const r = await incarcaRaport(id);
      setReport(r);
      setActivId(id);
      setView("clienti");
      setAgentFilter("");
      setClientSearch("");
      setGrupeSelectate(grupeDinColoane(r.coloane));
      setVisible(100);
      push("success", `Raport redeschis: ${r.an2} vs ${r.an1}.`);
    } catch (e) {
      push("error", e instanceof Error ? e.message : String(e));
    } finally {
      setSeIncarca(false);
    }
  }

  async function sterge(id: number) {
    try {
      await stergeRaport(id);
      setIstoric((l) => l.filter((x) => x.id !== id));
      if (activId === id) setActivId(null);
      push("info", "Raport șters din istoric.");
    } catch (e) {
      push("error", e instanceof Error ? e.message : String(e));
      throw e;
    }
  }

  async function editeazaProdus(m: Mismatch) {
    if (m.lipsa_bd) {
      // codul nu există în baza de date — deschide modalul de adăugare precompletat
      setAddProdus({ cod: m.cod, denumire: m.denumire, grupa: m.grupa_fisier });
      return;
    }
    try {
      const p = await getProdus(m.cod);
      setEditProdus(p);
    } catch (e) {
      push("error", e instanceof Error ? e.message : String(e));
    }
  }

  async function deschideLipsa() {
    if (!report) return;
    const seen = new Set<string>();
    const candidate = report.neconcordante
      .filter((m) => m.lipsa_bd && !seen.has(m.cod) && seen.add(m.cod))
      .map((m) => ({ cod: m.cod, denumire: m.denumire, grupa: m.grupa_fisier }));
    if (candidate.length === 0) {
      push("info", "Niciun produs lipsă din baza de date.");
      return;
    }
    try {
      const missing = await filtreazaProduseLipsa(candidate);
      if (missing.length === 0) {
        push("info", "Toate produsele lipsă au fost deja adăugate.");
        return;
      }
      setLipsa(missing);
      setLipsaYear(/^\d{4}$/.test(report.an2) ? report.an2 : "2026");
    } catch (e) {
      push("error", e instanceof Error ? e.message : String(e));
    }
  }

  function inchide() {
    setReport(null);
    setActivId(null);
  }

  const istoricFiltrat = useMemo(() => {
    const q = istoricSearch.trim().toLowerCase();
    if (q === "") return istoric;
    return istoric.filter((r) =>
      `${r.an1} ${r.an2} ${r.fisier1} ${r.fisier2}`.toLowerCase().includes(q),
    );
  }, [istoric, istoricSearch]);

  const totalPagini = Math.max(1, Math.ceil(istoricFiltrat.length / DIM_PAGINA));
  const paginaCurenta = Math.min(pagina, totalPagini);
  const istoricVizibil = useMemo(
    () => istoricFiltrat.slice((paginaCurenta - 1) * DIM_PAGINA, paginaCurenta * DIM_PAGINA),
    [istoricFiltrat, paginaCurenta],
  );

  async function exporta() {
    if (!report) return;
    if (coloaneVizibile.length === 0) {
      push("error", "Selectează cel puțin o grupă pentru a exporta.");
      return;
    }
    const dest = await save({
      defaultPath: `Raport ${report.an2} vs ${report.an1}.xlsx`,
      filters: [{ name: "Excel", extensions: ["xlsx"] }],
    });
    if (!dest) return;
    // macOS ignoră filtrele de extensie din dialogul de salvare.
    const destFinal = dest.toLowerCase().endsWith(".xlsx") ? dest : `${dest}.xlsx`;
    const idx = idxVizibile;
    const exportReport: Report = {
      ...report,
      coloane: coloaneVizibile,
      clienti: report.clienti.map((c) => ({
        ...c,
        valori: idx.map((i) => c.valori[i]),
      })),
      sumar: report.sumar.map((s) => ({
        ...s,
        valori: idx.map((i) => s.valori[i]),
      })),
    };
    setSeExporta(true);
    try {
      await exportRaportData(exportReport, destFinal);
      push("success", "Raportul a fost exportat în Excel.");
    } catch (e) {
      push("error", e instanceof Error ? e.message : String(e));
    } finally {
      setSeExporta(false);
    }
  }

  const grupeDisponibile = useMemo(
    () =>
      report
        ? grupeDinColoane(report.coloane).sort((a, b) => a.localeCompare(b, "ro"))
        : [],
    [report],
  );

  const idxVizibile = useMemo(() => {
    if (!report) return [] as number[];
    const sel = new Set(grupeSelectate);
    const idx: number[] = [];
    report.coloane.forEach((c, i) => {
      if (sel.has(bazaGrupa(c))) idx.push(i);
    });
    return idx;
  }, [report, grupeSelectate]);

  const coloaneVizibile = useMemo(
    () => (report ? idxVizibile.map((i) => report.coloane[i]) : []),
    [report, idxVizibile],
  );

  const filteredClienti = useMemo(() => {
    if (!report) return [];
    const q = clientSearch.trim().toLowerCase();
    return report.clienti.filter(
      (c) =>
        (agentFilter === "" || c.agent === agentFilter) &&
        (q === "" || c.client.toLowerCase().includes(q)),
    );
  }, [report, agentFilter, clientSearch]);

  const totalRow = useMemo<MatrixRow | null>(() => {
    if (filteredClienti.length === 0 || !report) return null;
    const vals: [number, number][] = Array.from({ length: idxVizibile.length }, () => [0, 0]);
    for (const c of filteredClienti)
      idxVizibile.forEach((ci, k) => {
        vals[k][0] += c.valori[ci][0];
        vals[k][1] += c.valori[ci][1];
      });
    return { lead: [`TOTAL (${filteredClienti.length})`, ""], vals };
  }, [filteredClienti, report, idxVizibile]);

  const visibleRows = useMemo(
    () =>
      filteredClienti.slice(0, visible).map((c) => ({
        lead: [c.client, c.agent],
        vals: idxVizibile.map((i) => c.valori[i]),
        nou: c.nou,
      })),
    [filteredClienti, visible, idxVizibile],
  );

  const sumarRows = useMemo(
    () =>
      report
        ? report.sumar.map((s) => ({
            lead: [s.agent],
            vals: idxVizibile.map((i) => s.valori[i]),
          }))
        : [],
    [report, idxVizibile],
  );

  return (
    <div className="flex flex-col gap-6 p-7">
      <div className="animate-fade-up">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600">
          Analiză comparativă
        </p>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-forest-950">
          Rapoarte
        </h2>
        <p className="mt-1 text-sm text-forest-600">
          Încarcă rapoartele pentru doi ani și generează sinteza pe clienți, agenți și grupe.
        </p>
      </div>

      <div
        className={`animate-fade-up rounded-2xl border bg-white p-5 shadow-[0_1px_3px_rgba(10,49,40,0.06)] transition-all ${
          dragOver ? "border-amber-400 ring-4 ring-amber-300/30" : "border-forest-100"
        }`}
      >
        <div className="flex flex-wrap items-stretch gap-3">
          <YearCard
            role="An precedent"
            subtext="Baza de comparație"
            an={an1}
            onAn={(v) => setAn1(v.replace(/\D/g, "").slice(0, 4))}
            path={path1}
            onPick={(p) => setSlot(1, p)}
            onClear={() => setPath1(null)}
          />
          <div className="flex flex-col items-center justify-center gap-1 px-1 text-forest-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">vs</span>
            <ArrowRight size={18} className="text-amber-500" />
          </div>
          <YearCard
            role="An curent"
            subtext="Perioada comparată"
            an={an2}
            onAn={(v) => setAn2(v.replace(/\D/g, "").slice(0, 4))}
            path={path2}
            onPick={(p) => setSlot(2, p)}
            onClear={() => setPath2(null)}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {!path1 || !path2 ? (
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700">
              <AlertCircle size={13} />
              {!path1 && !path2
                ? "Adaugă cele două fișiere pentru a genera."
                : !path1
                  ? `Lipsește fișierul pentru ${an1} (an precedent).`
                  : `Lipsește fișierul pentru ${an2} (an curent).`}
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-[11px] text-forest-400">
              <ArrowDownToLine size={13} />
              Poți trage fișierele direct aici — anul se completează automat.
            </p>
          )}
          <div className="flex items-center gap-2">
            {(path1 || path2) && (
              <button
                onClick={() => {
                  setPath1(null);
                  setPath2(null);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-forest-200 bg-white px-3.5 py-3 text-sm font-semibold text-forest-500 shadow-sm transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 active:scale-[0.98]"
              >
                <Trash2 size={14} />
                Golește
              </button>
            )}
            <button
              onClick={genereaza}
              disabled={!path1 || !path2 || busy || !anulValid}
              className="flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-forest-950 shadow-[0_2px_12px_rgba(251,191,36,0.4)] transition hover:bg-amber-300 hover:shadow-[0_4px_18px_rgba(251,191,36,0.55)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {busy ? <Spinner className="text-forest-950" /> : <Zap size={16} strokeWidth={2.6} />}
              {busy ? "Se generează…" : "Generează"}
            </button>
          </div>
        </div>
      </div>

      {busy && <GeneratingPanel an1={an1} an2={an2} />}

      {!busy && !report && istoric.length > 0 && (
        <div className="animate-fade-up flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <History size={15} className="text-forest-500" />
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-forest-600">
                Istoric rapoarte
              </h3>
              <span className="num rounded-full bg-forest-100 px-2 text-[11px] font-semibold text-forest-600">
                {istoricFiltrat.length}
              </span>
            </div>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-forest-400" />
              <input
                value={istoricSearch}
                onChange={(e) => {
                  setIstoricSearch(e.target.value);
                  setPagina(1);
                }}
                placeholder="Caută după ani sau fișiere…"
                className="w-64 rounded-xl border border-forest-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition placeholder:text-forest-400 focus:border-forest-500"
              />
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-forest-100 bg-white shadow-[0_1px_3px_rgba(10,49,40,0.06)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-forest-100 bg-forest-50 text-left text-[11px] font-bold uppercase tracking-wider text-forest-500">
                  <th className="px-4 py-2.5">Perioadă</th>
                  <th className="px-4 py-2.5">Fișiere</th>
                  <th className="num px-4 py-2.5 text-right">Clienți</th>
                  <th className="num px-4 py-2.5 text-right">Agenți</th>
                  <th className="px-4 py-2.5">Generat</th>
                  <th className="px-4 py-2.5 text-right">Acțiuni</th>
                </tr>
              </thead>
              <tbody>
                {istoricVizibil.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => deschide(r.id)}
                    className={`group cursor-pointer border-b border-forest-50 transition-colors last:border-0 hover:bg-amber-50/60 ${
                      activId === r.id ? "bg-forest-50" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-semibold text-forest-900">
                      <span className="flex items-center gap-2">
                        {activId === r.id && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                        )}
                        {r.an2} vs {r.an1}
                      </span>
                    </td>
                    <td className="max-w-[16rem] px-4 py-3 text-forest-500">
                      <span className="block truncate text-xs">{r.fisier1}</span>
                      <span className="block truncate text-xs">{r.fisier2}</span>
                    </td>
                    <td className="num px-4 py-3 text-right text-forest-700">{r.nr_clienti}</td>
                    <td className="num px-4 py-3 text-right text-forest-700">{r.nr_agenti}</td>
                    <td className="px-4 py-3 text-xs text-forest-500">{formatData(r.creat_la)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeSters(r);
                        }}
                        title="Șterge din istoric"
                        className="rounded-lg p-1.5 text-forest-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
                {istoricVizibil.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-forest-400">
                      Niciun raport nu corespunde căutării.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {totalPagini > 1 && (
              <div className="flex items-center justify-between border-t border-forest-100 bg-forest-50/50 px-4 py-2.5">
                <button
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  disabled={paginaCurenta === 1}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-forest-600 transition hover:bg-forest-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={15} />
                  Înapoi
                </button>
                <span className="num text-xs font-semibold text-forest-500">
                  Pagina {paginaCurenta} / {totalPagini}
                </span>
                <button
                  onClick={() => setPagina((p) => Math.min(totalPagini, p + 1))}
                  disabled={paginaCurenta === totalPagini}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-forest-600 transition hover:bg-forest-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Înainte
                  <ChevronRight size={15} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {!busy && report && (
        <div className="animate-fade-up flex flex-col gap-4">
          <div className="rounded-2xl border border-forest-100 bg-white shadow-[0_2px_10px_rgba(10,49,40,0.06)]">
            <div className="h-[3px] w-full rounded-t-2xl bg-gradient-to-r from-forest-700 via-forest-500 to-amber-400" />

            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={inchide}
                  className="group flex items-center gap-2 rounded-xl border border-forest-200 bg-white px-3.5 py-2 text-sm font-semibold text-forest-600 shadow-sm transition hover:border-forest-400 hover:bg-forest-50 hover:text-forest-900 active:scale-[0.98]"
                >
                  <ArrowLeft
                    size={15}
                    className="transition-transform group-hover:-translate-x-0.5"
                  />
                  Istoric
                </button>
                <span className="hidden items-center gap-2 rounded-full border border-forest-100 bg-forest-50 px-3 py-1.5 sm:flex">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
                  </span>
                  <span className="num text-xs font-bold tracking-tight text-forest-800">
                    {report.an2}
                  </span>
                  <span className="text-[11px] font-semibold text-forest-400">vs</span>
                  <span className="num text-xs font-bold tracking-tight text-forest-600">
                    {report.an1}
                  </span>
                </span>
              </div>

              {report.neconcordante.some((m) => m.lipsa_bd) && (
                <button
                  onClick={deschideLipsa}
                  disabled={busy}
                  className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-400 px-4 py-2 text-sm font-semibold text-forest-950 shadow-sm transition hover:bg-amber-300 active:scale-[0.98] disabled:opacity-50"
                >
                  <PackagePlus size={15} />
                  Adaugă produse lipsă
                </button>
              )}
              <button
                onClick={exporta}
                disabled={busy}
                className="group flex items-center gap-2 rounded-xl border border-forest-300 bg-white px-4 py-2 text-sm font-semibold text-forest-800 shadow-sm transition hover:border-forest-500 hover:bg-forest-50 hover:shadow active:scale-[0.98] disabled:opacity-50"
              >
                <Download
                  size={15}
                  className="text-forest-600 transition-transform group-hover:translate-y-0.5"
                />
                Export Excel
              </button>
            </div>

            <div className="h-px w-full bg-gradient-to-r from-transparent via-forest-100 to-transparent" />

            {report.neconcordante.length > 0 && (
              <div className="px-4 pt-3">
                <NeconcordanteBanner
                  items={report.neconcordante}
                  onEdit={editeazaProdus}
                />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="flex shrink-0 rounded-xl border border-forest-200 bg-forest-50/60 p-1 shadow-inner">
                <button
                  onClick={() => setView("clienti")}
                  className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${
                    view === "clienti"
                      ? "bg-forest-900 text-white shadow-[0_2px_8px_rgba(10,49,40,0.25)]"
                      : "text-forest-600 hover:text-forest-900"
                  }`}
                >
                  <Users size={15} /> Clienți
                  <span
                    className={`num rounded-full px-1.5 text-[11px] transition-colors ${
                      view === "clienti"
                        ? "bg-amber-400 text-forest-950"
                        : "bg-forest-100 text-forest-600"
                    }`}
                  >
                    {filteredClienti.length}
                  </span>
                </button>
                <button
                  onClick={() => setView("sumar")}
                  className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${
                    view === "sumar"
                      ? "bg-forest-900 text-white shadow-[0_2px_8px_rgba(10,49,40,0.25)]"
                      : "text-forest-600 hover:text-forest-900"
                  }`}
                >
                  <Layers size={15} /> Sumar agenți
                  <span
                    className={`num rounded-full px-1.5 text-[11px] transition-colors ${
                      view === "sumar"
                        ? "bg-amber-400 text-forest-950"
                        : "bg-forest-100 text-forest-600"
                    }`}
                  >
                    {report.sumar.length}
                  </span>
                </button>
              </div>

              <div className="flex min-w-[12rem] flex-1 justify-center">
                {view === "clienti" && (
                  <div className="flex w-full max-w-md items-center gap-2">
                    <div className="group relative flex-1">
                      <Search
                        size={16}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-forest-400 transition-colors group-focus-within:text-forest-600"
                      />
                      <input
                        value={clientSearch}
                        onChange={(e) => {
                          setClientSearch(e.target.value);
                          setVisible(100);
                        }}
                        placeholder="Caută client…"
                        className="w-full rounded-xl border border-forest-200 bg-forest-50/50 py-2.5 pl-10 pr-9 text-sm outline-none transition placeholder:text-forest-400 focus:border-forest-500 focus:bg-white focus:ring-2 focus:ring-forest-500/15"
                      />
                      {clientSearch !== "" && (
                        <button
                          onClick={() => {
                            setClientSearch("");
                            setVisible(100);
                          }}
                          title="Golește căutarea"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-forest-400 transition hover:bg-forest-100 hover:text-forest-700"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    {(clientSearch.trim() !== "" || agentFilter !== "") && (
                      <span className="num animate-fade-in shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                        {filteredClienti.length}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <GrupaFilter
                  grupe={grupeDisponibile}
                  selectate={grupeSelectate}
                  onToggle={(g) =>
                    setGrupeSelectate((s) =>
                      s.includes(g) ? s.filter((x) => x !== g) : [...s, g],
                    )
                  }
                  onAll={() => setGrupeSelectate(grupeDisponibile)}
                  onClear={() => setGrupeSelectate([])}
                />
                {view === "clienti" && (
                  <AgentFilter
                    agenti={report.agenti}
                    value={agentFilter}
                    onChange={(v) => {
                      setAgentFilter(v);
                      setVisible(100);
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {view === "clienti" ? (
            <>
              <MatrixTable
                leadHeaders={["Client", "Agent"]}
                leadWidths={[240, 150]}
                rows={visibleRows}
                columns={coloaneVizibile}
                an1={report.an1}
                an2={report.an2}
                total={totalRow}
              />
              {filteredClienti.length > visible && (
                <button
                  onClick={() => setVisible((v) => v + 100)}
                  className="mx-auto rounded-xl border border-forest-200 bg-white px-5 py-2.5 text-sm font-semibold text-forest-700 shadow-sm transition hover:border-forest-400"
                >
                  Arată încă 100 ({filteredClienti.length - visible} rămase)
                </button>
              )}
            </>
          ) : (
            <MatrixTable
              leadHeaders={["Agent"]}
              leadWidths={[220]}
              rows={sumarRows}
              columns={coloaneVizibile}
              an1={report.an1}
              an2={report.an2}
            />
          )}
        </div>
      )}

      {!report && !busy && istoric.length === 0 && (
        <div className="animate-fade-up flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-forest-100 bg-white/60 px-8 py-20 text-center">
          <div className="animate-float flex h-16 w-16 items-center justify-center rounded-2xl bg-forest-900 text-amber-300 shadow-lg">
            <BarChart3 size={30} />
          </div>
          <div>
            <h3 className="font-display text-xl font-semibold text-forest-900">
              Încă nu ai generat un raport
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-forest-500">
              Alege rapoartele pentru cei doi ani de mai sus, apoi apasă{" "}
              <span className="font-semibold text-amber-600">Generează</span> pentru a vedea
              matricea comparativă pe clienți și agenți.
            </p>
          </div>
        </div>
      )}

      {deSters && (
        <ConfirmDeleteModal
          title="Ștergi acest raport?"
          description="Raportul va fi eliminat definitiv din istoric. Fișierele Excel sursă nu sunt afectate."
          entity={`${deSters.an2} vs ${deSters.an1}`}
          onConfirm={async () => {
            await sterge(deSters.id);
            setDeSters(null);
          }}
          onClose={() => setDeSters(null)}
        />
      )}

      {editProdus && (
        <EditProdusModal
          row={editProdus}
          push={push}
          onChanged={() => {
            // Elimină produsul din lista de neconcordanțe — a fost corectat sau șters.
            setReport((r) =>
              r
                ? { ...r, neconcordante: r.neconcordante.filter((m) => m.cod !== editProdus.cod) }
                : r,
            );
            push("info", "Produs actualizat. Regenerați raportul pentru a aplica modificarea.");
            setEditProdus(null);
          }}
          onClose={() => setEditProdus(null)}
        />
      )}

      {addProdus && (
        <AddProdusModal
          initial={addProdus}
          push={push}
          onChanged={(codSalvat) => {
            setReport((r) =>
              r ? { ...r, neconcordante: r.neconcordante.filter((m) => m.cod !== codSalvat) } : r,
            );
            push("info", "Produs adăugat. Regenerați raportul pentru a aplica modificarea.");
            setAddProdus(null);
          }}
          onClose={() => setAddProdus(null)}
        />
      )}

      {lipsa && (
        <LipsaProduseModal
          items={lipsa}
          year={lipsaYear}
          onYear={setLipsaYear}
          push={push}
          onAdded={(coduriAdaugate) => {
            const adaugate = new Set(coduriAdaugate);
            setReport((r) =>
              r
                ? {
                    ...r,
                    neconcordante: r.neconcordante.filter(
                      (m) => !(m.lipsa_bd && adaugate.has(m.cod)),
                    ),
                  }
                : r,
            );
            setLipsa(null);
          }}
          onClose={() => setLipsa(null)}
        />
      )}

      <ToastHost toasts={toasts} />
    </div>
  );
}
