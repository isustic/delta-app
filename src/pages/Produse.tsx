import { useEffect, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { Check, FileSpreadsheet, FileText, Package, PackagePlus, Pencil, Plus, Trash2, Upload } from "lucide-react";
import {
  adaugaGrupa,
  adaugaProdus,
  adaugaProduseLipsa,
  deleteAllProduse,
  deleteProdus,
  deleteProduse,
  exportProduse,
  getGrupe,
  getProduse,
  getProduseColoana,
  getProdus,
  importProduse,
  updateProdus,
  type Produs,
  getStats,
} from "../lib/api";
import { PAGE_SIZE, usePaged } from "../lib/usePaged";
import { DeltaLoader } from "../components/DeltaLoader";
import {
  ConfirmDeleteModal,
  DropdownButton,
  Field,
  Modal,
  Pagination,
  SearchableSelect,
  SelectionCheckbox,
  SelectionToolbar,
  SortableTh,
  TableCard,
  inputCls,
  useSelection,
} from "../components/shared";
import { Button, PageHeader, Spinner, ToastHost, useToasts, type ToastKind } from "../components/ui";

export function EditProdusModal({
  row,
  push,
  onChanged,
  onClose,
}: {
  row: Produs;
  push: (kind: ToastKind, text: string) => void;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [denumire, setDenumire] = useState(row.denumire);
  const [grupa, setGrupa] = useState(row.grupa);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [grupe, setGrupe] = useState<string[]>([]);

  useEffect(() => {
    getGrupe().then(setGrupe).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      await updateProdus(row.cod, denumire.trim(), grupa.trim());
      push("success", `Produsul ${row.cod} a fost actualizat.`);
      onChanged();
      onClose();
    } catch (e) {
      push("error", `Eroare la salvare: ${e}`);
      setSaving(false);
    }
  }

  async function del() {
    try {
      await deleteProdus(row.cod);
      push("success", `Produsul ${row.cod} a fost șters.`);
      onChanged();
      onClose();
    } catch (e) {
      push("error", `Eroare la ștergere: ${e}`);
      throw e;
    }
  }

  return (
    <>
    <Modal
      title="Editează produs"
      icon={<Package size={17} />}
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="danger" onClick={() => setConfirming(true)}>
            <Trash2 size={15} />
            Șterge
          </Button>
          <div className="flex gap-2">
            <Button onClick={onClose}>Anulează</Button>
            <Button variant="primary" type="submit" form="edit-produs-form" disabled={saving}>
              {saving ? <Spinner /> : <Check size={15} />}
              Salvează
            </Button>
          </div>
        </>
      }
    >
      <form
        id="edit-produs-form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="flex flex-col gap-3.5"
      >
        <Field label="Cod" hint="Identificatorul nu poate fi modificat.">
          <input value={row.cod} disabled className={`${inputCls} font-mono`} />
        </Field>
        <Field label="Denumire">
          <input
            value={denumire}
            onChange={(e) => setDenumire(e.target.value)}
            className={inputCls}
            autoFocus
          />
        </Field>
        <Field label="Grupă">
          <SearchableSelect
            value={grupa}
            onChange={setGrupa}
            options={grupe}
            placeholder="Alege grupă…"
            allowCreate
            onCreate={async (v) => {
              await adaugaGrupa(v);
              setGrupe((prev) => [...prev, v].sort((a, b) => a.localeCompare(b, "ro")));
            }}
          />
        </Field>
      </form>
    </Modal>
    {confirming && (
      <ConfirmDeleteModal
        title="Ștergi acest produs?"
        description="Produsul va fi eliminat definitiv din fondul de date."
        entity={`${row.cod} · ${row.denumire}`}
        onConfirm={del}
        onClose={() => setConfirming(false)}
      />
    )}
    </>
  );
}

export function AddProdusModal({
  push,
  onChanged,
  onClose,
  initial,
}: {
  push: (kind: ToastKind, text: string) => void;
  onChanged: (codSalvat: string) => void;
  onClose: () => void;
  initial?: { cod: string; denumire: string; grupa: string };
}) {
  const [cod, setCod] = useState(initial?.cod ?? "");
  const [denumire, setDenumire] = useState(initial?.denumire ?? "");
  const [grupa, setGrupa] = useState(initial?.grupa ?? "");
  const [saving, setSaving] = useState(false);
  const [grupe, setGrupe] = useState<string[]>([]);

  useEffect(() => {
    getGrupe().then(setGrupe).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      const exista = await getProdus(cod.trim())
        .then(() => true)
        .catch(() => false);
      if (exista) {
        push("error", `Codul ${cod.trim()} există deja — deschide-l pentru editare.`);
        setSaving(false);
        return;
      }
      await adaugaProdus(cod.trim(), denumire.trim(), grupa.trim());
      push("success", `Produsul ${cod.trim()} a fost adăugat.`);
      onChanged(cod.trim());
      onClose();
    } catch (e) {
      push("error", `Eroare la salvare: ${e}`);
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Adaugă produs"
      icon={<Package size={17} />}
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <div className="ml-auto flex gap-2">
          <Button onClick={onClose}>Anulează</Button>
          <Button
            variant="primary"
            type="submit"
            form="add-produs-form"
            disabled={saving || !cod.trim() || !denumire.trim()}
          >
            {saving ? <Spinner /> : <Check size={15} />}
            Adaugă
          </Button>
        </div>
      }
    >
      <form
        id="add-produs-form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="flex flex-col gap-3.5"
      >
        <Field label="Cod">
          <input
            value={cod}
            onChange={(e) => setCod(e.target.value)}
            className={`${inputCls} font-mono`}
            autoFocus
          />
        </Field>
        <Field label="Denumire">
          <input
            value={denumire}
            onChange={(e) => setDenumire(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Grupă">
          <SearchableSelect
            value={grupa}
            onChange={setGrupa}
            options={grupe}
            placeholder="Alege grupă…"
            allowCreate
            onCreate={async (v) => {
              await adaugaGrupa(v);
              setGrupe((prev) => [...prev, v].sort((a, b) => a.localeCompare(b, "ro")));
            }}
          />
        </Field>
      </form>
    </Modal>
  );
}

export function LipsaProduseModal({
  items,
  year,
  onYear,
  push,
  onAdded,
  onClose,
}: {
  items: Produs[];
  year: string;
  onYear: (y: string) => void;
  push: (kind: ToastKind, text: string) => void;
  onAdded: (coduriAdaugate: string[]) => void;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(items.map((p) => p.cod)),
  );

  const allSelected = selected.size === items.length && items.length > 0;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(items.map((p) => p.cod)));
  }

  function toggle(cod: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cod)) next.delete(cod);
      else next.add(cod);
      return next;
    });
  }

  async function addSelected() {
    setSaving(true);
    try {
      const chosen = items.filter((p) => selected.has(p.cod) && p.cod.trim() && p.denumire.trim());
      if (chosen.length !== selected.size) {
        push("error", "Produsele selectate trebuie să aibă cod și denumire. Completează-le individual.");
        setSaving(false);
        return;
      }
      const n = await adaugaProduseLipsa(chosen, year);
      push("success", `${n.toLocaleString("ro-RO")} produse adăugate.`);
      onAdded(chosen.map((p) => p.cod));
      onClose();
    } catch (e) {
      push("error", `Eroare la adăugare: ${e}`);
      setSaving(false);
    }
  }

  const anOk = /^\d{4}$/.test(year);

  return (
    <Modal
      title="Adaugă produse lipsă"
      icon={<PackagePlus size={17} />}
      onClose={onClose}
      width="max-w-3xl"
      footer={
        <div className="flex items-center gap-3">
          <span className="text-label text-fg-3">
            Produsele vor fi marcate ca „NOU" în fondul de date.
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button onClick={onClose}>Anulează</Button>
            <Button
              variant="primary"
              onClick={addSelected}
              disabled={saving || selected.size === 0 || !anOk}
            >
              {saving ? <Spinner /> : <PackagePlus size={15} />}
              Adaugă selectate ({selected.size.toLocaleString("ro-RO")})
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-fg-2">
            Marchează cu anul
            <input
              value={year}
              onChange={(e) => onYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className={`${inputCls} w-24 font-mono ${anOk ? "" : "border-danger focus:border-danger focus:ring-danger/15"}`}
            />
          </label>
          <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs font-semibold text-fg-2 transition hover:text-fg">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="accent-accent"
            />
            {allSelected ? "Deselectează toate" : "Selectează toate"}
          </label>
        </div>
        <div className="max-h-80 overflow-auto rounded-card border border-stroke">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-subtle text-xs text-fg-3">
              <tr>
                <th className="w-10 px-4 py-2" />
                <th className="px-4 py-2 font-semibold">Cod</th>
                <th className="px-4 py-2 font-semibold">Denumire</th>
                <th className="px-4 py-2 font-semibold">Grupă</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {items.map((p) => (
                <tr
                  key={p.cod}
                  onClick={() => toggle(p.cod)}
                  className={`cursor-pointer transition-colors ${
                    selected.has(p.cod) ? "bg-accent-subtle/60" : "hover:bg-subtle/60"
                  }`}
                >
                  <td className="px-4 py-1.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(p.cod)}
                      onChange={() => toggle(p.cod)}
                      className="accent-accent"
                    />
                  </td>
                  <td className="num px-4 py-1.5 font-mono text-xs text-fg-2">{p.cod}</td>
                  <td className="px-4 py-1.5 text-fg">{p.denumire}</td>
                  <td className="px-4 py-1.5">
                    <span className="inline-block rounded-full bg-subtle px-2.5 py-0.5 text-xs font-semibold text-fg-2">
                      {p.grupa}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

export default function Produse() {
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Produs | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [confirmingSel, setConfirmingSel] = useState(false);
  const [coduri, setCoduri] = useState<string[]>([]);
  const [denumiri, setDenumiri] = useState<string[]>([]);
  const [grupe, setGrupe] = useState<string[]>([]);
  const { toasts, push } = useToasts();
  const p = usePaged<Produs>(getProduse, version);
  const [total, setTotal] = useState<number | null>(null);
  const sel = useSelection(p.rows.map((r) => r.cod));

  useEffect(() => {
    getStats().then((st) => setTotal(st.produse)).catch(() => {});
    getProduseColoana("cod").then(setCoduri).catch(() => {});
    getProduseColoana("denumire").then(setDenumiri).catch(() => {});
    getProduseColoana("grupa").then(setGrupe).catch(() => {});
  }, [version]);

  async function doImport() {
    const file = await open({
      multiple: false,
      filters: [{ name: "Excel", extensions: ["xlsx"] }],
    });
    if (!file) return;
    setBusy(true);
    try {
      const n = await importProduse(file as string);
      push("success", `${n.toLocaleString("ro-RO")} produse importate.`);
      sel.clear();
      setVersion((v) => v + 1);
    } catch (e) {
      push("error", `Eroare la import: ${e}`);
    } finally {
      setBusy(false);
    }
  }

  async function doExport(format: "csv" | "xlsx") {
    const dest = await save({
      defaultPath: `produse.${format}`,
      filters: [
        format === "xlsx"
          ? { name: "Excel", extensions: ["xlsx"] }
          : { name: "CSV", extensions: ["csv"] },
      ],
    });
    if (!dest) return;
    setBusy(true);
    try {
      await exportProduse(dest as string, format);
      push("success", "Produsele au fost exportate.");
    } catch (e) {
      push("error", `Eroare la export: ${e}`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteAll() {
    try {
      const n = await deleteAllProduse();
      push("success", `${n.toLocaleString("ro-RO")} produse șterse.`);
      sel.clear();
      setVersion((v) => v + 1);
      setConfirmingAll(false);
    } catch (e) {
      push("error", `Eroare la ștergere: ${e}`);
      throw e;
    }
  }

  async function deleteSelected() {
    try {
      const n = await deleteProduse([...sel.selected]);
      push("success", `${n.toLocaleString("ro-RO")} produse șterse.`);
      sel.clear();
      setConfirmingSel(false);
      setVersion((v) => v + 1);
    } catch (e) {
      push("error", `Eroare la ștergere: ${e}`);
      throw e;
    }
  }

  async function exportSelected(format: "csv" | "xlsx") {
    const dest = await save({
      defaultPath: `produse-selectate.${format}`,
      filters: [
        format === "xlsx"
          ? { name: "Excel", extensions: ["xlsx"] }
          : { name: "CSV", extensions: ["csv"] },
      ],
    });
    if (!dest) return;
    setBusy(true);
    try {
      // Selecția poate acoperi mai multe pagini — cerem toate rândurile.
      const selectate = [...sel.selected];
      const rows: Produs[] = [];
      for (let i = 0; i < selectate.length; i += 5000) {
        const chunk = selectate.slice(i, i + 5000);
        rows.push(...(await getProduse("", chunk.length, 0, null, { cod: chunk })));
      }
      await exportProduse(dest as string, format, rows);
      push("success", "Produsele selectate au fost exportate.");
    } catch (e) {
      push("error", `Eroare la export: ${e}`);
    } finally {
      setBusy(false);
    }
  }

  if (p.initialLoading) return <DeltaLoader />;

  return (
    <div className="flex flex-col gap-6 p-7">
      <PageHeader
        eyebrow="Fondul de date"
        title="Produse"
        description="Cod → grupă. Datele folosite la generarea rapoartelor."
        actions={
          <>
            <Button variant="primary" size="lg" className="rounded-card shadow-elev-4" onClick={() => setAdding(true)}>
              <Plus size={16} />
              Adaugă produs
            </Button>
            <DropdownButton
              label="Importă / Exportă"
              disabled={busy}
              icon={busy ? <Spinner /> : <Upload size={16} />}
              items={[
                { label: "Importă produse", icon: <Upload size={14} />, onSelect: doImport },
                { divider: true },
                { label: "Exportă Excel (.xlsx)", icon: <FileSpreadsheet size={14} />, onSelect: () => doExport("xlsx") },
                { label: "Exportă CSV (.csv)", icon: <FileText size={14} />, onSelect: () => doExport("csv") },
                { divider: true },
                { label: "Șterge tot", icon: <Trash2 size={14} />, danger: true, onSelect: () => setConfirmingAll(true) },
              ]}
            />
          </>
        }
      />

      <TableCard
        search={p.search}
        onSearch={p.setSearch}
        summary={
          total === null
            ? null
            : p.search.trim() && p.offset === 0 && !p.hasMore
              ? `${p.rows.length.toLocaleString("ro-RO")} din ${total.toLocaleString("ro-RO")} produse`
              : `${total.toLocaleString("ro-RO")} produse`
        }
        placeholder="cod, denumire sau grupă"
        error={p.error}
        footer={
          <Pagination
            offset={p.offset}
            count={p.rows.length}
            hasMore={p.hasMore}
            loading={p.loading}
            onPrev={() => {
              const o = Math.max(0, p.offset - PAGE_SIZE);
              p.setOffset(o);
              p.reload(p.search, o);
            }}
            onNext={() => {
              const o = p.offset + PAGE_SIZE;
              p.setOffset(o);
              p.reload(p.search, o);
            }}
          />
        }
      >
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-subtle text-label text-fg-3">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <SelectionCheckbox
                  checked={sel.allPageSelected}
                  onChange={sel.togglePage}
                  title="Selectează pagina"
                />
              </th>
              <SortableTh
                label="Cod"
                sortKey="cod"
                sort={p.sort}
                onSort={p.setSort}
                className="px-5 py-2.5"
                filter={{
                  value: p.extra.cod ?? [],
                  onChange: (c) => p.setExtra((prev) => ({ ...prev, cod: c })),
                  options: coduri,
                  placeholder: "Filtrează după cod",
                }}
              />
              <SortableTh
                label="Denumire"
                sortKey="denumire"
                sort={p.sort}
                onSort={p.setSort}
                className="px-4 py-2.5"
                filter={{
                  value: p.extra.denumire ?? [],
                  onChange: (d) => p.setExtra((prev) => ({ ...prev, denumire: d })),
                  options: denumiri,
                  placeholder: "Filtrează după denumire",
                }}
              />
              <SortableTh
                label="Grupă"
                sortKey="grupa"
                sort={p.sort}
                onSort={p.setSort}
                className="px-4 py-2.5"
                filter={{
                  value: p.extra.grupa ?? [],
                  onChange: (g) => p.setExtra((prev) => ({ ...prev, grupa: g })),
                  options: grupe,
                  placeholder: "Filtrează după grupă",
                }}
              />
              <th className="w-12 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {p.rows.map((r) => (
              <tr
                key={r.cod}
                onClick={() => setEditing(r)}
                className="group cursor-pointer transition-colors hover:bg-subtle/60"
              >
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <SelectionCheckbox
                    checked={sel.selected.has(r.cod)}
                    onChange={() => sel.toggle(r.cod)}
                  />
                </td>
                <td className="num px-5 py-2 font-mono text-xs text-fg-2">{r.cod}</td>
                <td className="px-4 py-2">
                  <span className="flex items-center gap-1.5">
                    <span className="text-fg">{r.denumire}</span>
                    {r.adaugat_la && (
                      <span
                        title={`Adăugat: ${r.adaugat_la}`}
                        className="rounded-full bg-accent px-1.5 py-px text-label font-semibold text-on-accent"
                      >
                        Nou
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span className="inline-block rounded-full bg-subtle px-2.5 py-0.5 text-xs font-semibold text-fg-2">
                    {r.grupa}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <Pencil
                    size={14}
                    className="ml-auto text-fg-3 opacity-0 transition group-hover:opacity-100 group-hover:text-fg-3"
                  />
                </td>
              </tr>
            ))}
            {p.rows.length === 0 && !p.loading && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-fg-3">
                  Nicio înregistrare găsită.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableCard>

      <SelectionToolbar
        count={sel.selected.size}
        busy={busy}
        onDelete={() => setConfirmingSel(true)}
        onExport={() => exportSelected("xlsx")}
      />

      {editing && (
        <EditProdusModal
          row={editing}
          push={push}
          onChanged={() => setVersion((v) => v + 1)}
          onClose={() => setEditing(null)}
        />
      )}

      {adding && (
        <AddProdusModal
          push={push}
          onChanged={() => setVersion((v) => v + 1)}
          onClose={() => setAdding(false)}
        />
      )}

      {confirmingAll && (
        <ConfirmDeleteModal
          title="Ștergi toate produsele?"
          description="Întregul tabel de produse va fi golit. Poți reimporta oricând fișierul Excel pentru a-l reconstitui."
          confirmLabel="Șterge tot"
          busyLabel="Se golește…"
          onConfirm={deleteAll}
          onClose={() => setConfirmingAll(false)}
        />
      )}

      {confirmingSel && (
        <ConfirmDeleteModal
          title={`Ștergi ${sel.selected.size.toLocaleString("ro-RO")} produse?`}
          description="Produsele selectate vor fi eliminate definitiv din fondul de date."
          confirmLabel="Șterge selectate"
          busyLabel="Se șterg…"
          onConfirm={deleteSelected}
          onClose={() => setConfirmingSel(false)}
        />
      )}

      <ToastHost toasts={toasts} />
    </div>
  );
}
