import { useEffect, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { Check, FileSpreadsheet, FileText, Pencil, Plus, Trash2, Upload, UserCheck } from "lucide-react";
import {
  adaugaAgent,
  deleteAgent,
  deleteAgenti,
  deleteAllAgenti,
  exportAgenti,
  getAgenti,
  getAgentiColoana,
  getAgentiDistinct,
  importAgenti,
  updateAgent,
  type AgentClient,
} from "../lib/api";
import { PAGE_SIZE, usePaged } from "../lib/usePaged";
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
import { Spinner, ToastHost, useToasts, type ToastKind } from "../components/ui";

function EditAgentModal({
  row,
  push,
  onChanged,
  onClose,
}: {
  row: AgentClient;
  push: (kind: ToastKind, text: string) => void;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [agent, setAgent] = useState(row.agent);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [agenti, setAgenti] = useState<string[]>([]);

  useEffect(() => {
    getAgentiDistinct().then(setAgenti).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      await updateAgent(row.client, agent.trim());
      push("success", `Clientul ${row.client} a fost actualizat.`);
      onChanged();
      onClose();
    } catch (e) {
      push("error", `Eroare la salvare: ${e}`);
      setSaving(false);
    }
  }

  async function del() {
    try {
      await deleteAgent(row.client);
      push("success", `Clientul ${row.client} a fost șters.`);
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
      title="Editează client"
      icon={<UserCheck size={17} />}
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3.5 py-2 text-sm font-semibold text-red-600 shadow-sm transition hover:border-red-400 hover:bg-red-50 active:scale-[0.98]"
          >
            <Trash2 size={15} />
            Șterge
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-forest-200 bg-white px-4 py-2 text-sm font-semibold text-forest-700 transition hover:border-forest-400 hover:bg-forest-50"
            >
              Anulează
            </button>
            <button
              type="submit"
              form="edit-agent-form"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-forest-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-forest-700 active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? <Spinner /> : <Check size={15} />}
              Salvează
            </button>
          </div>
        </>
      }
    >
      <form
        id="edit-agent-form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="flex flex-col gap-3.5"
      >
        <Field label="Client" hint="Identificatorul nu poate fi modificat.">
          <input value={row.client} disabled className={inputCls} />
        </Field>
        <Field label="Agent">
          <SearchableSelect
            value={agent}
            onChange={setAgent}
            options={agenti}
            placeholder="Alege agent…"
          />
        </Field>
      </form>
    </Modal>
    {confirming && (
      <ConfirmDeleteModal
        title="Ștergi acest client?"
        description="Clientul și asocierea lui cu agentul vor fi eliminate definitiv din fondul de date."
        entity={row.client}
        onConfirm={del}
        onClose={() => setConfirming(false)}
      />
    )}
    </>
  );
}

function AddAgentModal({
  push,
  onChanged,
  onClose,
}: {
  push: (kind: ToastKind, text: string) => void;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [client, setClient] = useState("");
  const [agent, setAgent] = useState("");
  const [saving, setSaving] = useState(false);
  const [agenti, setAgenti] = useState<string[]>([]);

  useEffect(() => {
    getAgentiDistinct().then(setAgenti).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      const exista = await getAgenti("", 1, 0, null, { client: [client.trim()] });
      if (exista.length > 0) {
        push("error", `Clientul ${client.trim()} există deja — deschide-l pentru editare.`);
        setSaving(false);
        return;
      }
      await adaugaAgent(client.trim(), agent.trim());
      push("success", `Clientul ${client.trim()} a fost adăugat.`);
      onChanged();
      onClose();
    } catch (e) {
      push("error", `Eroare la salvare: ${e}`);
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Adaugă client"
      icon={<UserCheck size={17} />}
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-forest-200 bg-white px-4 py-2 text-sm font-semibold text-forest-700 transition hover:border-forest-400 hover:bg-forest-50"
          >
            Anulează
          </button>
          <button
            type="submit"
            form="add-agent-form"
            disabled={saving || !client.trim() || !agent.trim()}
            className="flex items-center gap-2 rounded-xl bg-forest-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-forest-700 active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? <Spinner /> : <Check size={15} />}
            Adaugă
          </button>
        </div>
      }
    >
      <form
        id="add-agent-form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="flex flex-col gap-3.5"
      >
        <Field label="Client">
          <input
            value={client}
            onChange={(e) => setClient(e.target.value)}
            className={inputCls}
            autoFocus
          />
        </Field>
        <Field label="Agent">
          <SearchableSelect
            value={agent}
            onChange={setAgent}
            options={agenti}
            placeholder="Alege agent…"
          />
        </Field>
      </form>
    </Modal>
  );
}

export default function Clienti() {
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<AgentClient | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [confirmingSel, setConfirmingSel] = useState(false);
  const [clienti, setClienti] = useState<string[]>([]);
  const [agenti, setAgenti] = useState<string[]>([]);
  const { toasts, push } = useToasts();
  const p = usePaged<AgentClient>(getAgenti, version);
  const sel = useSelection(p.rows.map((r) => r.client));

  useEffect(() => {
    getAgentiColoana("client").then(setClienti).catch(() => {});
    getAgentiColoana("agent").then(setAgenti).catch(() => {});
  }, [version]);

  async function doImport() {
    const file = await open({
      multiple: false,
      filters: [{ name: "Excel", extensions: ["xlsx"] }],
    });
    if (!file) return;
    setBusy(true);
    try {
      const n = await importAgenti(file as string);
      push("success", `${n.toLocaleString("ro-RO")} clienți/agenți importate.`);
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
      defaultPath: `clienti.${format}`,
      filters: [
        format === "xlsx"
          ? { name: "Excel", extensions: ["xlsx"] }
          : { name: "CSV", extensions: ["csv"] },
      ],
    });
    if (!dest) return;
    setBusy(true);
    try {
      await exportAgenti(dest as string, format);
      push("success", "Clienții au fost exportați.");
    } catch (e) {
      push("error", `Eroare la export: ${e}`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteAll() {
    try {
      const n = await deleteAllAgenti();
      push("success", `${n.toLocaleString("ro-RO")} clienți/agenți șterse.`);
      sel.clear();
      p.setOffset(0);
      setConfirmingAll(false);
    } catch (e) {
      push("error", `Eroare la ștergere: ${e}`);
      throw e;
    }
  }

  async function deleteSelected() {
    try {
      const n = await deleteAgenti([...sel.selected]);
      push("success", `${n.toLocaleString("ro-RO")} clienți șterși.`);
      sel.clear();
      setConfirmingSel(false);
      p.reload(p.search, p.offset);
    } catch (e) {
      push("error", `Eroare la ștergere: ${e}`);
      throw e;
    }
  }

  async function exportSelected(format: "csv" | "xlsx") {
    const dest = await save({
      defaultPath: `clienti-selectati.${format}`,
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
      const selectati = [...sel.selected];
      const rows: AgentClient[] = [];
      for (let i = 0; i < selectati.length; i += 5000) {
        const chunk = selectati.slice(i, i + 5000);
        rows.push(...(await getAgenti("", chunk.length, 0, null, { client: chunk })));
      }
      await exportAgenti(dest as string, format, rows);
      push("success", "Clienții selectați au fost exportați.");
    } catch (e) {
      push("error", `Eroare la export: ${e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-7">
      <div className="animate-fade-up flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600">
            Fondul de date
          </p>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-forest-950">
            Clienți
          </h2>
          <p className="mt-1 text-sm text-forest-600">
            Clienți → Agent — cine gestionează fiecare client.
          </p>
        </div>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 rounded-xl bg-forest-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-700 active:scale-[0.98]"
          >
            <Plus size={16} />
            Adaugă client
          </button>
          <DropdownButton
            label="Importă / Exportă"
            disabled={busy}
            icon={busy ? <Spinner /> : <Upload size={16} />}
            items={[
              { label: "Importă clienți", icon: <Upload size={14} />, onSelect: doImport },
              { divider: true },
              { label: "Exportă Excel (.xlsx)", icon: <FileSpreadsheet size={14} />, onSelect: () => doExport("xlsx") },
              { label: "Exportă CSV (.csv)", icon: <FileText size={14} />, onSelect: () => doExport("csv") },
            ]}
          />
        </div>
      </div>

      <TableCard
        icon={<UserCheck size={17} />}
        title="Clienți → Agent"
        subtitle="apasă pe un rând pentru a-l edita"
        search={p.search}
        onSearch={p.setSearch}
        placeholder="client sau agent"
        error={p.error}
        actions={
          <button
            type="button"
            title="Șterge tot"
            onClick={() => setConfirmingAll(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-forest-200 bg-white text-red-400 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 active:scale-[0.98]"
          >
            <Trash2 size={15} />
          </button>
        }
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
          <thead className="sticky top-0 z-10 bg-forest-50 text-[11px] uppercase tracking-wide text-forest-500">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <SelectionCheckbox
                  checked={sel.allPageSelected}
                  onChange={sel.togglePage}
                  title="Selectează pagina"
                />
              </th>
              <SortableTh
                label="Client"
                sortKey="client"
                sort={p.sort}
                onSort={p.setSort}
                className="px-5 py-2.5"
                filter={{
                  value: p.extra.client ?? [],
                  onChange: (c) => p.setExtra((prev) => ({ ...prev, client: c })),
                  options: clienti,
                  placeholder: "Filtrează după client",
                }}
              />
              <SortableTh
                label="Agent"
                sortKey="agent"
                sort={p.sort}
                onSort={p.setSort}
                className="px-4 py-2.5"
                filter={{
                  value: p.extra.agent ?? [],
                  onChange: (a) => p.setExtra((prev) => ({ ...prev, agent: a })),
                  options: agenti,
                  placeholder: "Filtrează după agent",
                }}
              />
              <th className="w-12 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-forest-50">
            {p.rows.map((r) => (
              <tr
                key={r.client}
                onClick={() => setEditing(r)}
                className="group cursor-pointer transition-colors hover:bg-forest-50/60"
              >
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <SelectionCheckbox
                    checked={sel.selected.has(r.client)}
                    onChange={() => sel.toggle(r.client)}
                  />
                </td>
                <td className="px-5 py-2 font-medium text-forest-900">{r.client}</td>
                <td className="px-4 py-2 text-forest-600">{r.agent}</td>
                <td className="px-3 py-2 text-right">
                  <Pencil
                    size={14}
                    className="ml-auto text-forest-300 opacity-0 transition group-hover:opacity-100 group-hover:text-forest-500"
                  />
                </td>
              </tr>
            ))}
            {p.rows.length === 0 && !p.loading && (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-sm text-forest-400">
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
        <EditAgentModal
          row={editing}
          push={push}
          onChanged={() => p.reload(p.search, p.offset)}
          onClose={() => setEditing(null)}
        />
      )}

      {adding && (
        <AddAgentModal
          push={push}
          onChanged={() => p.reload(p.search, 0)}
          onClose={() => setAdding(false)}
        />
      )}

      {confirmingAll && (
        <ConfirmDeleteModal
          title="Ștergi toți clienții?"
          description="Întregul tabel de clienți și agenți va fi golit. Poți reimporta oricând fișierul Excel pentru a-l reconstitui."
          confirmLabel="Șterge tot"
          busyLabel="Se golește…"
          onConfirm={deleteAll}
          onClose={() => setConfirmingAll(false)}
        />
      )}

      {confirmingSel && (
        <ConfirmDeleteModal
          title={`Ștergi ${sel.selected.size.toLocaleString("ro-RO")} clienți?`}
          description="Clienții selectați și asocierile lor cu agenții vor fi eliminate definitiv."
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
