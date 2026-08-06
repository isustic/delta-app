# Design: Butoanele din header (Clienți / Produse)

**Data:** 2026-08-06
**Status:** Aprobat de utilizator (varianta finală — 2 butoane în header, Șterge tot demovat ca iconiță)

## Context

Pagini **Clienți** și **Produse** aveau în header trei butoane într-un rând: **Adaugă** (umplut, verde), **Șterge tot** (contur roșu), **Importă** (contur verde). Utilizatorul a găsit cele trei butoane libere „împrăștiate" și a cerut o reorganizare.

Au fost evaluate trei variante:

1. **Grup unit** (Șterge tot + Importă într-un singur contur, cu separator) — implementat, dar respins de utilizator: tot „trei butoane apropiate".
2. **Meniu overflow (⋯)** — ascunde Importă într-un dropdown; respins (acțiune utilă prea ascunsă, fără pattern de dropdown în aplicație).
3. **Varianta finală (aleasă):** header păstrează doar acțiunile de introducere date (Adaugă + Importă); **Șterge tot** devine o iconiță discretă de coș de gunoi lângă căutare, în cardul tabelului.

## Design

### Header (ambele pagini)

Doar **două butoane**, ambele cu aceeași intenție (introduc date):

```
[+] Adaugă produs      [↑ Importă produse]
  filled forest-800      outline, hover amber pe icon
```

- **Adaugă** — umplut, verde forest, text alb (acțiune primară).
- **Importă** — contur forest, fundal alb; spinner în timpul importului; dezactivat + `opacity-50` când e ocupat.

### Cardul tabelului (ambele pagini)

**Șterge tot** — demovat la o iconiță de coș de gunoi, lângă câmpul de căutare:

```
┌───────────────────────────────────────────────────────┐
│  Produse (cod → grupă)            [🔍 search…]  🗑     │
│                                                        │
│  ... tabel ...                                         │
└───────────────────────────────────────────────────────┘
```

- Buton pătrat mic (`h-9 w-9`), contur `forest-200`, iconiță `Trash2` roșie discret (`text-red-400`).
- Hover: fundal `red-50`, iconiță `text-red-600`.
- Tooltip `title="Șterge tot"`.
- Click → modalul de confirmare existent (`ConfirmDeleteModal`), neschimbat.

### Componente partajate

- `TableCard` primește un slot opțional `actions?: ReactNode`, randat lângă `SearchInput` în antetul cardului. Nicio altă schimbare în componentă.
- Componenta `ActionGroup` (din varianta anterioară) se elimină complet — nu mai e folosită.

## Date flow / erori / testare

- **Date flow:** neschimbat. Butoanele apelează exact aceleași handler-e ca înainte (`doImport`, `setConfirmingAll`).
- **Erori:** neschimbat — toast-urile existente acoperă import/ștergere.
- **Testare:** verificare vizuală în dev — header cu 2 butoane, iconița de coș lângă căutare, hover-urile corecte, spinner la import, confirmarea de ștergere apare la click. Verificare `npx tsc --noEmit` (backend-ul nu e atins).
