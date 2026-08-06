# Design: Gruparea butoanelor din header (Șterge tot + Importă)

**Data:** 2026-08-06
**Status:** Aprobat de utilizator (variantă A — grup unit, ținut roșu)

## Context

Pagini **Clienți** și **Produse** au în header trei butoane aranjate într-un rând simplu:

- **Adaugă** — umplut, verde forest (acțiune primară)
- **Șterge tot** — contur alb + roșu (acțiune distructivă)
- **Importă** — contur alb + verde forest

Utilizatorul consideră cele trei butoane libere o vedere „împrăștiată" și vrea o grupare vizuală. A fost ales abordarea **A**: grupează cele două butoane cu contur (Șterge tot + Importă) într-un singur control cu contur comun și separator, păstrând **Adaugă** separat.

## Design

Header-ul păstrează layout-ul actual (titlu stânga, butoane dreapta, `flex flex-wrap items-end justify-between gap-4`), dar cele două butoane outline devin un **grup unit** cu un contur partajat:

```
[+] Adaugă produs      ┌──────────────────┬────────────────────┐
                      │  ✕ Șterge tot    │  ↑ Importă produse │
                      └──────────────────┴────────────────────┘
  filled forest-800     one shared outline + divider in the middle
  white text            left half: red text/icon (stays destructive)
                        right half: forest text, amber hover on icon
```

### Detalii

- **Grup:** un singur container `inline-flex` cu contur `border-forest-200`, colțuri `rounded-xl`, fundal alb, `shadow-sm`. Cele două butoane din interior **nu au contur propriu**.
- **Divider:** o linie verticală `border-l border-forest-100` între cele două părți.
- **Jumătatea stângă (Șterge tot):** text/iconă roșii (`text-red-600`), hover fundal `red-50`. Păstrează textul „Șterge tot" roșu — confirmat explicit de utilizator.
- **Jumătatea dreaptă (Importă):** text verde forest (`text-forest-800`), iconă `Upload` cu hover amber (comportamentul actual), hover fundal `forest-50`. Păstrează textul existent („Importă produse" / „Importă clienți/agenți").
- **Starea busy:** în timpul importului, icona devine `Spinner` (comportamentul actual), butonul dezactivat, `disabled:opacity-50`.
- **Răspuns la hover:** fiecare jumătate se evidențiază independent (nu întregul grup).
- **Clienți și Produse:** exact același tip de grup, pentru consistență.

## Componentă partajată

Pentru a evita dublarea, se creează o componentă mică reutilizabilă în `src/components/shared.tsx` (alături de `Modal`, `Field` etc.):

```tsx
// Semnătură (orientativă — implementare la alegere)
export function ActionGroup({ children }: { children: ReactNode })
```

- Rol: doar wrapper vizual — contur comun, colțuri, fundal, `shadow-sm`, `inline-flex`.
- Părțile rămân butoane `button` obișnuite cu clasele lor interioare (fără contur propriu), separate printr-o bordură verticală.
- Rădăcină fără alte responsabilități: nu gestionează click-uri, nu știe despre import/ștergere.

## Date flow / erori / testare

- **Date flow:** neschimbat. Butoanele apelează exact aceleași handler-e ca azi (`doImport`, `setConfirmingAll`).
- **Erori:** neschimbat — toast-urile existente acoperă cazurile de import/ștergere.
- **Testare:** verificare vizuală în dev — grupul arată unit, hover-urile independente, spinner-ul apare în jumătatea corectă în timpul importului, layout-ul se rulează ok pe fereastră îngustă (wrap ca un bloc). Verificare `cargo check` + `npx tsc --noEmit` (comenzi existente).
