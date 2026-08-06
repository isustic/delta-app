import { useCallback, useEffect, useRef, useState } from "react";

export const PAGE_SIZE = 100;

export type SortState = { key: string; dir: "asc" | "desc" };

export function usePaged<T>(
  fetcher: (search: string, limit: number, offset: number, sort: SortState | null, extra: Record<string, string[]>) => Promise<T[]>,
  version: number,
) {
  const [rows, setRows] = useState<T[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState | null>(null);
  const [extra, setExtra] = useState<Record<string, string[]>>({});
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const timer = useRef<number | null>(null);
  const firstSearch = useRef(true);
  const reqId = useRef(0);
  // Starea curentă de sortare/filtrare, citită din ref-uri ca reload să nu
  // piardă sortarea/filtrele active indiferent de punctul de apel.
  const sortRef = useRef(sort);
  const extraRef = useRef(extra);
  sortRef.current = sort;
  extraRef.current = extra;

  const reload = useCallback(
    async (s: string, o: number) => {
      const id = ++reqId.current;
      setLoading(true);
      setError(null);
      try {
        // Un rând în plus ca să știm sigur dacă mai există pagini.
        const data = await fetcher(s, PAGE_SIZE + 1, o, sortRef.current, extraRef.current);
        if (id !== reqId.current) return; // un reload mai nou a câștigat cursa
        setRows(data.slice(0, PAGE_SIZE));
        setHasMore(data.length > PAGE_SIZE);
      } catch (e) {
        if (id !== reqId.current) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [fetcher],
  );

  useEffect(() => {
    setOffset(0);
    reload(search, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  useEffect(() => {
    if (firstSearch.current) {
      firstSearch.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setOffset(0);
      reload(search, 0);
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, sort, extra]);

  return {
    rows,
    search,
    sort,
    extra,
    offset,
    loading,
    error,
    hasMore,
    setSearch,
    setSort,
    setExtra,
    setOffset,
    reload,
  };
}
