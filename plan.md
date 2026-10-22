# Plan — Delta (Tauri desktop)

Aplicație desktop (Windows + Mac) pentru generarea de rapoarte comparative 2025 vs 2026, pe agenți/clienți/grupe.

## Stack
- **Tauri 2.x**
- Frontend: **Vite + React + TypeScript + Tailwind CSS**
- Package manager: **npm**
- Rust crates:
  - `rusqlite` (feature `bundled`) — SQLite local
  - `calamine` — citire `.xlsx`
  - `rust_xlsxwriter` — scriere `.xlsx` (faza 2)

## Structură proiect (`reports-app/`)
```
src/                     # frontend React
  main.tsx, App.tsx, pages/, components/
src-tauri/
  Cargo.toml, tauri.conf.json, build.rs
  resources/             # fișiere default bundled
    Grupa corespunzatoare.xlsx
    Raport agent.xlsx
  src/
    main.rs / lib.rs
    db.rs                # init DB, migrări, seed
    xlsx.rs              # parsare/scriere xlsx
    commands.rs          # comenzi Tauri
```

## Baza de date (SQLite, în app-data dir)
- `produse(cod TEXT PRIMARY KEY, denumire TEXT, grupa TEXT, subgrupa TEXT)` ← „Grupa corespunzatoare.xlsx" (A=cod, B=denumire, C=grupa, D=subgrupa; ~2067 produse)
- `agenti_clienti(client TEXT PRIMARY KEY, agent TEXT)` ← „Raport agent.xlsx" (A=Client, B=Agent; ~548 rânduri)
- `meta(cheie TEXT PRIMARY KEY, valoare TEXT)` — versiune seed / status

## Date sursă (înțelese din fișiere)
- **Rapoarte brute 2025/2026** (`Standard 1 ian-30 iun 25/26.xlsx`): 32 coloane, ~47.8k rânduri.
  Coloane cheie: `E=Cod`, `P=Client`, `W=Agent`, `B=Denumire grupa`, `G=Cantitate`, `J=Valoare Contabila`, `K=Valoare`.
- **Corelare**: cod din sursă → `(grupa, subgrupa)` din DB (1046/1074 coduri se potrivesc).

## Decizii confirmate
- Layout raport: **matrice orizontală** (ca în fișierul exemplu) — grupe = coloane (fiecare 2025/2026/Diferență), clienți = rânduri.
- Câmp agregat: **Valoare Contabila (coloana J)**.
- Agentul: din **DB (mapping client→agent)**, nu din raportul sursă.
- Nume sheet per-agent: **nume complet** (ex. „Bogdan Nae").

## Faza 1 — Scaffold + DB + date default
1. Scaffold Tauri 2 + React + TS + Vite + Tailwind.
2. Init DB + migrări la pornire.
3. Seed automat la prima rulare din cele 2 fișiere bundled + re-import din UI.
4. Comenzi Tauri: `import_produse`, `import_agenti`, `get_produse`, `get_agenti`, `get_stats`.
5. UI minimal: pagina **„Date de bază"** (counturi + tabele + butoane import) + placeholder **„Rapoarte"**.
6. Verificare: `cargo check` + build frontend.

## Faza 2 — Rapoarte
1. Upload rapoarte 2025 + 2026 (.xlsx).
2. Parsare cu `calamine`; pentru fiecare rând: `cod → grupa/subgrupa/denumire` (DB), `client → agent` (DB).
3. Agregare per `(client, agent, coloană)`: sumă **Valoare Contabila (J)** pe an1 și an2; diferență = an2 − an1.

### Regula anului de bază
- **Anul de bază = an2** (cel mai recent: 2026 acum, 2027 ulterior — generic).
- **Populația raportului = clienții prezenți în anul de bază (an2).**
  - Clienți **noi** (prezenți în an2, absenți în an1) → incluși, marcați cu badge „Nou" (în UI), cu an1 = 0.
  - Clienți **dispăruți** (prezenți doar în an1, absenți în an2) → **excluși** din raport (baza e an2).
- Sortare clienți: alfabetic (agent → client).
4. **Coloane generate dinamic din DB** (fără mapping hardcoded; tabela `raport_coloane` a fost eliminată).
   Pentru fiecare rând sursă: `cod → (grupa, subgrupa)` din **Produse**.
   Numele coloanei = `grupa` + sufix determinat de **subgrupă**:
   - subgrupa conține „tehnic" → ` - Tehnic`
   - subgrupa conține „retail" → ` - Retail`
   - altfel → fără sufix (ex. subgrupe „Culoare", „Styling", „Materiale", „Decolorare")
   - cod nemapat în DB (sau grupa goală) → fallback pe „Denumire grupa" din raportul sursă (col B), fără sufix.
   Setul de coloane = toate etichetele care apar efectiv în date, sortate alfabetic
   (grupele stau grupate natural: „X - Retail" lângă „X - Tehnic").
5. Afișare matrice în aplicație (Client/Agent + coloane-grupă, fiecare 2025/2026/Diferență).
6. Export Excel cu sheet-uri:
   - `SUMAR` — rânduri = agenți, coloane = grupe (an1/an2/Diferență)
   - `{an2} vs {an1}` — toți clienții (A=Client, B=Agent, grupe ca coloane)
   - Câte un sheet per agent (nume complet) — clienții agentului

## Fișiere de referință
- `/Users/isustic/Desktop/Projects/Ethics/files/egs/Grupa corespunzatoare.xlsx`
- `/Users/isustic/Desktop/Projects/Ethics/files/egs/Raport agent.xlsx`
- `/Users/isustic/Desktop/Projects/Ethics/files/egs/Standard 1 ian-30 iun 25.xlsx`
- `/Users/isustic/Desktop/Projects/Ethics/files/egs/Standard 1 ian-30 iun 26.xlsx`
- `/Users/isustic/Desktop/Projects/Ethics/files/egs/Raport 6 luni - per agent.xlsx` (exemplu output)
