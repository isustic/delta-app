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
  ChevronsUpDown,
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
import { Button, PageHeader, ToastHost, useToasts } from "../components/ui";
import { DeltaLoader } from "../components/DeltaLoader";
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
      ? `color-mix(in srgb, var(--color-success) ${Math.round((0.05 + intensity * 0.24) * 100)}%, transparent)`
      : d < 0
        ? `color-mix(in srgb, var(--color-danger) ${Math.round((0.04 + intensity * 0.2) * 100)}%, transparent)`
        : "transparent";
  const tone = d > 0 ? "text-success" : d < 0 ? "text-danger" : "text-fg-3";
  return (
    <td
      className="num border-b border-l border-r-2 border-stroke/70 border-r-stroke px-2 py-1 text-right transition-colors group-hover:bg-subtle/40"
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
        className="no-scrollbar overflow-auto rounded-card border border-stroke bg-card shadow-elev-4"
      >
      <table className="border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            {leadHeaders.map((h, j) => (
              <th
                key={j}
                rowSpan={2}
                style={{ left: lefts[j], width: leadWidths[j], minWidth: leadWidths[j] }}
                className="sticky top-0 z-30 border-b border-r border-stroke bg-layer px-3 py-2 text-left font-semibold text-on-accent"
              >
                {h}
              </th>
            ))}
            {columns.map((c, k) => (
              <th
                key={k}
                colSpan={3}
                className={`sticky top-0 z-20 border-b border-r-2 border-accent bg-layer px-2 py-2 text-center text-xs font-semibold text-fg ${
                  k % 2 === 0 ? "" : "bg-accent"
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
                  className={`num sticky top-[34px] z-10 border-b border-stroke px-2 py-1.5 text-right font-semibold text-fg-2 ${
                    k % 2 === 0 ? "bg-subtle" : "bg-subtle/80"
                  }`}
                >
                  {an1}
                </th>
                <th
                  className={`num sticky top-[34px] z-10 border-b border-l border-stroke/70 px-2 py-1.5 text-right font-semibold text-fg-2 ${
                    k % 2 === 0 ? "bg-subtle" : "bg-subtle/80"
                  }`}
                >
                  {an2}
                </th>
                <th
                  className={`sticky top-[34px] z-10 border-b border-l border-r-2 border-stroke/70 border-r-stroke-control px-2 py-1.5 text-right font-semibold text-warning ${
                    k % 2 === 0 ? "bg-accent-subtle/70" : "bg-accent-subtle/60"
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
                  className={`sticky z-10 border-b border-r border-stroke px-3 py-1.5 transition-colors group-hover:bg-subtle ${
                    j === 0 ? "bg-card font-semibold text-fg" : "bg-card text-fg-2"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="truncate">{val}</span>
                    {j === 0 && row.nou && (
                      <span className="shrink-0 rounded-full bg-accent px-1.5 py-px text-xs font-semibold text-fg">
                        Nou
                      </span>
                    )}
                  </span>
                </td>
              ))}
              {row.vals.map(([v1, v2], k) => (
                <Fragment key={k}>
                  <td
                    className={`num border-b border-stroke px-2 py-1 text-right text-fg-2 transition-colors group-hover:bg-subtle/60 ${
                      k % 2 === 1 ? "bg-subtle/40" : ""
                    }`}
                  >
                    {nf.format(v1)}
                  </td>
                  <td
                    className={`num border-b border-l border-stroke border-l-stroke/60 px-2 py-1 text-right text-fg-2 transition-colors group-hover:bg-subtle/60 ${
                      k % 2 === 1 ? "bg-subtle/40" : ""
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
                  className="sticky z-10 border-t border-r border-stroke-control bg-layer px-3 py-2 font-semibold text-on-accent"
                >
                  {val}
                </td>
              ))}
              {total.vals.map(([v1, v2], k) => {
                const d = v2 - v1;
                return (
                  <Fragment key={k}>
                    <td
                      className={`num border-t border-stroke-control px-2 py-2 text-right font-semibold text-fg ${
                        k % 2 === 0 ? "bg-layer" : "bg-accent"
                      }`}
                    >
                      {nf.format(v1)}
                    </td>
                    <td
                      className={`num border-t border-l border-stroke-control border-l-accent px-2 py-2 text-right font-semibold text-fg ${
                        k % 2 === 0 ? "bg-layer" : "bg-accent"
                      }`}
                    >
                      {nf.format(v2)}
                    </td>
                    <td
                      className={`num border-t border-l border-r-2 border-stroke-control border-r-accent bg-layer px-2 py-2 text-right font-bold ${
                        d < 0 ? "text-danger" : "text-accent-fg"
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
          className="hscroll-proxy sticky bottom-3 z-30 h-2.5 overflow-x-auto overflow-y-hidden rounded-full bg-subtle/70 shadow-elev-8 backdrop-blur-sm transition-colors duration-200 hover:bg-stroke/80"
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
        className={`group flex min-h-[3.5rem] w-full items-center gap-3 rounded-card border-2 border-dashed px-4 py-3 text-left transition-all ${
          path
            ? "border-stroke-control bg-card"
            : "border-stroke bg-card hover:border-accent-fg hover:bg-accent-subtle/50"
        }`}
      >
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-card transition ${
            path ? "bg-accent-hover text-accent-fg" : "bg-subtle text-fg-2 group-hover:bg-accent group-hover:text-fg"
          }`}
        >
          <FileSpreadsheet size={18} />
        </div>
        <div className="min-w-0">
          {path ? (
            <p className="truncate text-sm font-semibold text-fg">{fileName(path)}</p>
          ) : (
            <p className="text-sm text-fg-3">{hint} — alege sau trage fișier</p>
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
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-stroke bg-card text-fg-3 shadow-elev-4 transition hover:border-danger hover:bg-danger-bg hover:text-danger"
        >
          <X size={11} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

const AN_MIN = 2015;
const AN_MAX = 2040;
const ANI_OPTIUNI = Array.from({ length: AN_MAX - AN_MIN + 1 }, (_, i) => String(AN_MIN + i));

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
  // Anul din numele fișierului poate fi în afara intervalului: îl păstrăm în listă ca să rămână vizibil.
  const optiuni = ANI_OPTIUNI.includes(an) || !an ? ANI_OPTIUNI : [an, ...ANI_OPTIUNI];
  return (
    <div className="flex min-w-[15rem] flex-1 flex-col gap-2 rounded-card border border-stroke bg-subtle/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-fg-2">{role}</p>
          <p className="text-xs text-fg-3">{subtext}</p>
        </div>
        <div className="relative w-24 shrink-0">
          <select
            value={an}
            onChange={(e) => onAn(e.target.value)}
            aria-label={role}
            className="num h-11 w-full appearance-none rounded-card border border-stroke bg-card pl-3 pr-8 text-center text-sm font-semibold text-fg outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
          >
            {optiuni.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <ChevronsUpDown
            size={14}
            strokeWidth={1.5}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-3"
          />
        </div>
      </div>
      <FileSlot hint="Standard ian–iun" path={path} onPick={onPick} onClear={onClear} />
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
    <div className="animate-fade-up overflow-hidden rounded-card border border-stroke bg-accent-subtle/60 shadow-elev-4">
      <button
        onClick={() => setDeschis((d) => !d)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-accent-subtle"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-card bg-accent text-fg">
            <AlertTriangle size={16} />
          </span>
          <div>
            <p className="text-sm font-semibold text-fg">
              {items.length} produs{items.length === 1 ? "" : "e"} de verificat
            </p>
            <p className="text-xs text-fg-3">
              {dif > 0 && <>{dif} cu grupă diferită față de fișier</>}
              {dif > 0 && lipsa > 0 && " · "}
              {lipsa > 0 && <span className="font-semibold text-danger">{lipsa} lipsă din baza de date</span>}
            </p>
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-warning transition ${deschis ? "rotate-180" : ""}`}
        />
      </button>

      {deschis && (
        <div className="border-t border-stroke/70">
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-accent-subtle/80 text-xs text-fg-2">
                <tr>
                  <th className="px-4 py-2 font-semibold">Cod</th>
                  <th className="px-3 py-2 font-semibold">Produs</th>
                  <th className="px-3 py-2 font-semibold">În fișier</th>
                  <th className="px-3 py-2 font-semibold">În baza de date</th>
                  <th className="px-4 py-2 text-right font-semibold">An</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-accent">
                {items.map((m, i) => (
                  <tr
                    key={i}
                    className={`transition hover:bg-accent-subtle/60 ${
                      m.lipsa_bd ? "bg-danger-bg/50" : "bg-card"
                    }`}
                  >
                    <td className="num px-4 py-1.5 font-mono text-fg-2">
                      <span className="flex items-center gap-1.5">
                        {m.lipsa_bd && (
                          <span
                            title="Codul nu există în baza de date"
                            className="rounded-full bg-danger px-1.5 py-px text-xs font-semibold text-on-accent"
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
                        className="block w-full truncate text-left text-fg underline-offset-2 transition hover:text-fg-2 hover:underline"
                      >
                        {m.denumire}
                      </button>
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="rounded-full bg-subtle px-2 py-0.5 font-semibold text-fg-2">
                        {m.grupa_fisier}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      {m.lipsa_bd ? (
                        <span className="rounded-full bg-danger-bg px-2 py-0.5 font-semibold text-danger">
                          —
                        </span>
                      ) : (
                        <span className="rounded-full bg-accent-subtle/80 px-2 py-0.5 font-semibold text-fg">
                          {m.grupa_bd}
                        </span>
                      )}
                    </td>
                    <td className="num px-4 py-1.5 text-right font-semibold text-fg-2">
                      {m.an}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-stroke/70 px-4 py-2 text-xs text-fg-3">
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
        className={`flex items-center gap-2 rounded-card border px-3.5 py-2.5 text-sm font-semibold shadow-elev-4 transition ${
          activ
            ? "border-accent bg-subtle text-fg"
            : "border-stroke bg-card text-fg-2 hover:border-stroke-control"
        }`}
      >
        <Layers size={15} className={activ ? "text-warning" : "text-fg-3"} />
        Grupe
        {activ && (
          <span className="num rounded-full bg-accent px-1.5 text-xs font-semibold text-fg">
            {selectate.length}
          </span>
        )}
        <ChevronDown
          size={14}
          className={`text-fg-3 transition ${deschis ? "rotate-180" : ""}`}
        />
      </button>

      {deschis && (
        <div className="animate-fade-in absolute right-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-card border border-stroke bg-card shadow-elev-16">
          <div className="flex items-center justify-between border-b border-stroke px-3.5 py-2.5">
            <span className="text-xs font-semibold text-fg-3">
              Filter grupe
            </span>
            <div className="flex gap-3 text-xs font-semibold">
              <button onClick={onAll} className="text-fg-3 transition hover:text-fg">
                Toate
              </button>
              <button onClick={onClear} className="text-fg-3 transition hover:text-fg">
                Golește
              </button>
            </div>
          </div>
          <div className="border-b border-stroke p-2.5">
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-3"
              />
              <input
                value={cautare}
                onChange={(e) => setCautare(e.target.value)}
                placeholder="Caută grupă…"
                className="w-full rounded-card border border-stroke bg-subtle/50 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-fg-3 focus:border-accent focus:bg-card"
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
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition hover:bg-subtle"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                      on ? "border-stroke bg-accent-hover text-on-accent" : "border-stroke-control bg-card"
                    }`}
                  >
                    {on && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span
                    className={`truncate ${on ? "font-semibold text-fg" : "text-fg-2"}`}
                  >
                    {g}
                  </span>
                </button>
              );
            })}
            {lista.length === 0 && (
              <p className="px-3.5 py-6 text-center text-sm text-fg-3">Nicio grupă găsită.</p>
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
        className={`flex items-center gap-2 rounded-card border px-3.5 py-2.5 text-sm font-semibold shadow-elev-4 transition ${
          value
            ? "border-accent bg-subtle text-fg"
            : "border-stroke bg-card text-fg-2 hover:border-stroke-control"
        }`}
      >
        <Users size={15} className={value ? "text-warning" : "text-fg-3"} />
        <span className="max-w-[10rem] truncate">{value || "Toți agenții"}</span>
        <ChevronDown
          size={14}
          className={`text-fg-3 transition ${deschis ? "rotate-180" : ""}`}
        />
      </button>

      {deschis && (
        <div className="animate-fade-in absolute right-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-card border border-stroke bg-card shadow-elev-16">
          <div className="flex items-center justify-between border-b border-stroke px-3.5 py-2.5">
            <span className="text-xs font-semibold text-fg-3">
              Agent
            </span>
            {value !== "" && (
              <button
                onClick={() => onChange("")}
                className="text-xs font-semibold text-fg-3 transition hover:text-fg"
              >
                Resetează
              </button>
            )}
          </div>
          <div className="border-b border-stroke p-2.5">
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-3"
              />
              <input
                value={cautare}
                onChange={(e) => setCautare(e.target.value)}
                placeholder="Caută agent…"
                className="w-full rounded-card border border-stroke bg-subtle/50 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-fg-3 focus:border-accent focus:bg-card"
              />
            </div>
          </div>
          <div className="max-h-72 overflow-auto py-1">
            <button
              onClick={() => {
                onChange("");
                setDeschis(false);
              }}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition hover:bg-subtle ${
                value === "" ? "bg-subtle/60" : ""
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${
                  value === "" ? "border-stroke bg-accent-hover text-on-accent" : "border-stroke-control bg-card"
                }`}
              >
                {value === "" && <Check size={12} strokeWidth={3} />}
              </span>
              <span
                className={`truncate ${value === "" ? "font-semibold text-fg" : "text-fg-2"}`}
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
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition hover:bg-subtle"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${
                      on ? "border-stroke bg-accent-hover text-on-accent" : "border-stroke-control bg-card"
                    }`}
                  >
                    {on && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className={`truncate ${on ? "font-semibold text-fg" : "text-fg-2"}`}>
                    {a}
                  </span>
                </button>
              );
            })}
            {lista.length === 0 && (
              <p className="px-3.5 py-6 text-center text-sm text-fg-3">Niciun agent găsit.</p>
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
  // Orice operație lungă blochează acțiunile concurente.
  const busy = generez || seIncarca || seExporta;
  const [dragOver, setDragOver] = useState(false);
  const [visible, setVisible] = useState(100);
  const [initialLoading, setInitialLoading] = useState(true);
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
      .catch(() => {})
      .finally(() => setInitialLoading(false));
  }, []);

  const stateRef = useRef({ path1, path2, busy });
  stateRef.current = { path1, path2, busy };

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
    Promise.resolve()
      .then(() => getCurrentWindow().onDragDropEvent((e) => {
        if (stateRef.current.busy) return;
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
      }))
      .then((u) => {
        if (cancelled) u();
        else unlisten = u;
      })
      .catch((e) => push("error", `Eroare la activarea încărcării prin glisare: ${e}`));
    return () => {
      cancelled = true;
      unlisten?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anulValid = /^\d{4}$/.test(an1) && /^\d{4}$/.test(an2) && an1 < an2;

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

  if (initialLoading || busy) {
    return (
      <>
        <DeltaLoader label={
          generez ? "Se generează raportul…"
            : seExporta ? "Se exportă raportul…"
              : "Se încarcă…"
        } />
        <ToastHost toasts={toasts} />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-7">
      <PageHeader
        eyebrow="Analiză comparativă"
        title="Rapoarte"
        description="Încarcă rapoartele pentru doi ani și generează sinteza pe clienți, agenți și grupe."
      />

      <div
        className={`animate-fade-up rounded-card border bg-card p-5 shadow-elev-4 transition-all ${
          dragOver ? "border-accent-fg ring-4 ring-accent/30" : "border-stroke"
        }`}
      >
        <div className="flex flex-wrap items-stretch gap-3">
          <YearCard
            role="An precedent"
            subtext="Baza de comparație"
            an={an1}
            onAn={setAn1}
            path={path1}
            onPick={(p) => setSlot(1, p)}
            onClear={() => setPath1(null)}
          />
          <div className="flex flex-col items-center justify-center gap-1 px-1 text-fg-3">
            <span className="text-xs font-bold">vs</span>
            <ArrowRight size={18} className="text-accent-fg" />
          </div>
          <YearCard
            role="An curent"
            subtext="Perioada comparată"
            an={an2}
            onAn={setAn2}
            path={path2}
            onPick={(p) => setSlot(2, p)}
            onClear={() => setPath2(null)}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {!path1 || !path2 ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
              <AlertCircle size={13} />
              {!path1 && !path2
                ? "Adaugă cele două fișiere pentru a genera."
                : !path1
                  ? `Lipsește fișierul pentru ${an1} (an precedent).`
                  : `Lipsește fișierul pentru ${an2} (an curent).`}
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-fg-3">
              <ArrowDownToLine size={13} />
              Poți trage fișierele direct aici — anul se completează automat.
            </p>
          )}
          <div className="flex items-center gap-2">
            {(path1 || path2) && (
              <Button
                onClick={() => {
                  setPath1(null);
                  setPath2(null);
                }}
                className="text-fg-3 hover:border-danger hover:bg-danger-bg hover:text-danger"
              >
                <Trash2 size={14} />
                Golește
              </Button>
            )}
            <button
              onClick={genereaza}
              disabled={!path1 || !path2 || busy || !anulValid}
              className="flex items-center gap-2 rounded-card bg-accent px-5 py-3 text-sm font-semibold text-fg shadow-elev-8 transition hover:bg-accent hover:shadow-elev-8 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              <Zap size={16} strokeWidth={2.6} />
              Generează
            </button>
          </div>
        </div>
      </div>

      {!busy && !report && istoric.length > 0 && (
        <div className="animate-fade-up flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <History size={15} className="text-fg-3" />
              <h3 className="text-xs font-bold tracking-[0.2em] text-fg-2">
                Istoric rapoarte
              </h3>
              <span className="num rounded-full bg-subtle px-2 text-xs font-semibold text-fg-2">
                {istoricFiltrat.length}
              </span>
            </div>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
              <input
                value={istoricSearch}
                onChange={(e) => {
                  setIstoricSearch(e.target.value);
                  setPagina(1);
                }}
                placeholder="Caută după ani sau fișiere…"
                className="w-64 rounded-card border border-stroke bg-card py-2.5 pl-9 pr-3 text-sm outline-none transition placeholder:text-fg-3 focus:border-accent"
              />
            </div>
          </div>
          <div className="overflow-hidden rounded-card border border-stroke bg-card shadow-elev-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stroke bg-subtle text-left text-xs font-semibold text-fg-3">
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
                    className={`group cursor-pointer border-b border-stroke transition-colors last:border-0 hover:bg-accent-subtle/60 ${
                      activId === r.id ? "bg-subtle" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-semibold text-fg">
                      <span className="flex items-center gap-2">
                        {activId === r.id && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
                        )}
                        {r.an2} vs {r.an1}
                      </span>
                    </td>
                    <td className="max-w-[16rem] px-4 py-3 text-fg-3">
                      <span className="block truncate text-xs">{r.fisier1}</span>
                      <span className="block truncate text-xs">{r.fisier2}</span>
                    </td>
                    <td className="num px-4 py-3 text-right text-fg-2">{r.nr_clienti}</td>
                    <td className="num px-4 py-3 text-right text-fg-2">{r.nr_agenti}</td>
                    <td className="px-4 py-3 text-xs text-fg-3">{formatData(r.creat_la)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeSters(r);
                        }}
                        title="Șterge din istoric"
                        className="rounded-card p-1.5 text-fg-3 opacity-0 transition hover:bg-danger-bg hover:text-danger group-hover:opacity-100"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
                {istoricVizibil.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-fg-3">
                      Niciun raport nu corespunde căutării.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {totalPagini > 1 && (
              <div className="flex items-center justify-between border-t border-stroke bg-subtle/50 px-4 py-2.5">
                <button
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  disabled={paginaCurenta === 1}
                  className="flex items-center gap-1 rounded-card px-3 py-1.5 text-sm font-semibold text-fg-2 transition hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={15} />
                  Înapoi
                </button>
                <span className="num text-xs font-semibold text-fg-3">
                  Pagina {paginaCurenta} / {totalPagini}
                </span>
                <button
                  onClick={() => setPagina((p) => Math.min(totalPagini, p + 1))}
                  disabled={paginaCurenta === totalPagini}
                  className="flex items-center gap-1 rounded-card px-3 py-1.5 text-sm font-semibold text-fg-2 transition hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-40"
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
          <div className="rounded-card border border-stroke bg-card shadow-elev-4">
            <div className="h-[3px] w-full rounded-t-card bg-accent" />

            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3">
                <Button onClick={inchide} className="group text-fg-2 hover:text-fg">
                  <ArrowLeft
                    size={15}
                    className="transition-transform group-hover:-translate-x-0.5"
                  />
                  Istoric
                </Button>
                <span className="hidden items-center gap-2 rounded-full border border-stroke bg-subtle px-3 py-1.5 sm:flex">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                  </span>
                  <span className="num text-xs font-bold tracking-tight text-fg">
                    {report.an2}
                  </span>
                  <span className="text-xs font-semibold text-fg-3">vs</span>
                  <span className="num text-xs font-bold tracking-tight text-fg-2">
                    {report.an1}
                  </span>
                </span>
              </div>

              {report.neconcordante.some((m) => m.lipsa_bd) && (
                <Button variant="primary" onClick={deschideLipsa} disabled={busy}>
                  <PackagePlus size={15} />
                  Adaugă produse lipsă
                </Button>
              )}
              <Button onClick={exporta} disabled={busy} className="group hover:shadow">
                <Download
                  size={15}
                  className="text-fg-2 transition-transform group-hover:translate-y-0.5"
                />
                Export Excel
              </Button>
            </div>

            <div className="h-px w-full bg-gradient-to-r from-transparent via-subtle to-transparent" />

            {report.neconcordante.length > 0 && (
              <div className="px-4 pt-3">
                <NeconcordanteBanner
                  items={report.neconcordante}
                  onEdit={editeazaProdus}
                />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="flex shrink-0 rounded-card border border-stroke bg-subtle/60 p-1 shadow-inner">
                <button
                  onClick={() => setView("clienti")}
                  className={`flex items-center gap-2 rounded-card px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${
                    view === "clienti"
                      ? "bg-layer text-on-accent shadow-elev-8"
                      : "text-fg-2 hover:text-fg"
                  }`}
                >
                  <Users size={15} /> Clienți
                  <span
                    className={`num rounded-full px-1.5 text-xs transition-colors ${
                      view === "clienti"
                        ? "bg-accent text-fg"
                        : "bg-subtle text-fg-2"
                    }`}
                  >
                    {filteredClienti.length}
                  </span>
                </button>
                <button
                  onClick={() => setView("sumar")}
                  className={`flex items-center gap-2 rounded-card px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${
                    view === "sumar"
                      ? "bg-layer text-on-accent shadow-elev-8"
                      : "text-fg-2 hover:text-fg"
                  }`}
                >
                  <Layers size={15} /> Sumar agenți
                  <span
                    className={`num rounded-full px-1.5 text-xs transition-colors ${
                      view === "sumar"
                        ? "bg-accent text-fg"
                        : "bg-subtle text-fg-2"
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
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3 transition-colors group-focus-within:text-fg-2"
                      />
                      <input
                        value={clientSearch}
                        onChange={(e) => {
                          setClientSearch(e.target.value);
                          setVisible(100);
                        }}
                        placeholder="Caută client…"
                        className="w-full rounded-card border border-stroke bg-subtle/50 py-2.5 pl-10 pr-9 text-sm outline-none transition placeholder:text-fg-3 focus:border-accent focus:bg-card focus:ring-2 focus:ring-accent/15"
                      />
                      {clientSearch !== "" && (
                        <button
                          onClick={() => {
                            setClientSearch("");
                            setVisible(100);
                          }}
                          title="Golește căutarea"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-card p-1 text-fg-3 transition hover:bg-subtle hover:text-fg-2"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    {(clientSearch.trim() !== "" || agentFilter !== "") && (
                      <span className="num animate-fade-in shrink-0 rounded-full bg-accent-subtle px-2.5 py-1 text-xs font-semibold text-warning">
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
                <Button onClick={() => setVisible((v) => v + 100)} className="mx-auto">
                  Arată încă 100 ({filteredClienti.length - visible} rămase)
                </Button>
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
        <div className="animate-fade-up flex flex-col items-center justify-center gap-4 rounded-card border-2 border-dashed border-stroke bg-card/60 px-8 py-20 text-center">
          <div className="animate-float flex h-16 w-16 items-center justify-center rounded-card bg-layer text-accent-fg shadow-elev-8">
            <BarChart3 size={30} />
          </div>
          <div>
            <h3 className="font-sans text-xl font-semibold text-fg">
              Încă nu ai generat un raport
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-fg-3">
              Alege rapoartele pentru cei doi ani de mai sus, apoi apasă{" "}
              <span className="font-semibold text-warning">Generează</span> pentru a vedea
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
