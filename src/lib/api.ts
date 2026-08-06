import { invoke } from "@tauri-apps/api/core";
import type { SortState } from "./usePaged";

export type Stats = {
  produse: number;
  agenti_clienti: number;
  agenti_distinct: number;
  seed_version: string | null;
};

export type Produs = {
  cod: string;
  denumire: string;
  grupa: string;
  /** Momentul adăugării prin „Adaugă produse lipsă" (badge „NOU"). */
  adaugat_la?: string;
};

export type AgentClient = {
  client: string;
  agent: string;
};

export function getStats(): Promise<Stats> {
  return invoke<Stats>("get_stats");
}

export function getProduse(
  search?: string,
  limit?: number,
  offset?: number,
  sort?: SortState | null,
  extra?: Record<string, string[]>,
): Promise<Produs[]> {
  const sortBy = sort ? `${sort.dir === "desc" ? "-" : ""}${sort.key}` : null;
  return invoke<Produs[]>("get_produse", {
    search,
    limit,
    offset,
    sortBy,
    cod: extra?.cod ?? [],
    denumire: extra?.denumire ?? [],
    grupa: extra?.grupa ?? [],
  });
}

/** Valorile distincte ale unei coloane de produse (cod/denumire/grupa). */
export function getProduseColoana(coloana: string): Promise<string[]> {
  return invoke<string[]>("get_produse_coloana", { coloana });
}

export function getProdus(cod: string): Promise<Produs> {
  return invoke<Produs>("get_produs", { cod });
}

export function getGrupe(search?: string): Promise<string[]> {
  return invoke<string[]>("get_grupe", { search });
}

export function getAgentiDistinct(search?: string): Promise<string[]> {
  return invoke<string[]>("get_agenti_distinct", { search });
}

export function getAgenti(
  search?: string,
  limit?: number,
  offset?: number,
  sort?: SortState | null,
  extra?: Record<string, string[]>,
): Promise<AgentClient[]> {
  const sortBy = sort ? `${sort.dir === "desc" ? "-" : ""}${sort.key}` : null;
  return invoke<AgentClient[]>("get_agenti", {
    search,
    limit,
    offset,
    sortBy,
    client: extra?.client ?? [],
    agent: extra?.agent ?? [],
  });
}

/** Valorile distincte ale unei coloane de clienți (client/agent). */
export function getAgentiColoana(coloana: string): Promise<string[]> {
  return invoke<string[]>("get_agenti_coloana", { coloana });
}

export function importProduse(path: string): Promise<number> {
  return invoke<number>("import_produse", { path });
}

export function importAgenti(path: string): Promise<number> {
  return invoke<number>("import_agenti", { path });
}

export function exportProduse(
  dest: string,
  format: "csv" | "xlsx",
  rows?: Produs[],
): Promise<void> {
  return invoke<void>("export_produse", { dest, format, rows });
}

export function exportAgenti(
  dest: string,
  format: "csv" | "xlsx",
  rows?: AgentClient[],
): Promise<void> {
  return invoke<void>("export_agenti", { dest, format, rows });
}

export function adaugaProdus(
  cod: string,
  denumire: string,
  grupa: string,
): Promise<void> {
  return invoke<void>("adauga_produs", { cod, denumire, grupa });
}

export function getProduseLipsa(
  path1: string,
  path2: string,
): Promise<Produs[]> {
  return invoke<Produs[]>("get_produse_lipsa", { path1, path2 });
}

export function adaugaProduseLipsa(
  produse: Produs[],
  year: string,
): Promise<number> {
  return invoke<number>("adauga_produse_lipsa", { produse, year });
}

export function filtreazaProduseLipsa(
  produse: Produs[],
): Promise<Produs[]> {
  return invoke<Produs[]>("filtreaza_produse_lipsa", { produse });
}

export function adaugaAgent(client: string, agent: string): Promise<void> {
  return invoke<void>("adauga_agent", { client, agent });
}

export function updateProdus(
  cod: string,
  denumire: string,
  grupa: string,
): Promise<void> {
  return invoke<void>("update_produs", { cod, denumire, grupa });
}

export function deleteProdus(cod: string): Promise<void> {
  return invoke<void>("delete_produs", { cod });
}

export function deleteProduse(coduri: string[]): Promise<number> {
  return invoke<number>("delete_produse", { coduri });
}

export function deleteAllProduse(): Promise<number> {
  return invoke<number>("delete_all_produse");
}

export function updateAgent(client: string, agent: string): Promise<void> {
  return invoke<void>("update_agent", { client, agent });
}

export function deleteAgent(client: string): Promise<void> {
  return invoke<void>("delete_agent", { client });
}

export function deleteAgenti(clienti: string[]): Promise<number> {
  return invoke<number>("delete_agenti", { clienti });
}

export function deleteAllAgenti(): Promise<number> {
  return invoke<number>("delete_all_agenti");
}

export type RandClient = {
  client: string;
  agent: string;
  valori: [number, number][];
  nou: boolean;
};

export type RandSumar = {
  agent: string;
  valori: [number, number][];
};

export type Mismatch = {
  cod: string;
  denumire: string;
  grupa_fisier: string;
  grupa_bd: string;
  an: string;
  lipsa_bd: boolean;
};

export type Report = {
  an1: string;
  an2: string;
  coloane: string[];
  clienti: RandClient[];
  sumar: RandSumar[];
  agenti: string[];
  neconcordante: Mismatch[];
};

export function genereazaRaport(
  path1: string,
  path2: string,
  an1: string,
  an2: string,
): Promise<Report> {
  return invoke<Report>("genereaza_raport", { path1, path2, an1, an2 });
}

export function exportRaportData(report: Report, dest: string): Promise<void> {
  return invoke<void>("export_raport_data", { report, dest });
}

export type RaportSalvat = {
  id: number;
  an1: string;
  an2: string;
  fisier1: string;
  fisier2: string;
  nr_clienti: number;
  nr_agenti: number;
  creat_la: string;
};

export function salveazaRaport(
  report: Report,
  fisier1: string,
  fisier2: string,
): Promise<number> {
  return invoke<number>("salveaza_raport", { report, fisier1, fisier2 });
}

export function listaRapoarte(): Promise<RaportSalvat[]> {
  return invoke<RaportSalvat[]>("lista_rapoarte");
}

export function incarcaRaport(id: number): Promise<Report> {
  return invoke<Report>("incarca_raport", { id });
}

export function stergeRaport(id: number): Promise<void> {
  return invoke<void>("sterge_raport", { id });
}
