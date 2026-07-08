import { useState, useEffect, useRef } from 'react';
import type { SubjectEntry } from '../types';

export function useSubjectSearch(entries: SubjectEntry[]) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SubjectEntry[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Instantiate web worker
    workerRef.current = new Worker(
      new URL('../utils/searchWorker.ts', import.meta.url),
      { type: 'module' }
    );

    workerRef.current.onmessage = (e: MessageEvent<SubjectEntry[]>) => {
      // We check latest query via ref below, but since this closure only captures the initial render,
      // it's safer to just set results. The UI layer (SubjectTable) ignores searchResults if query is empty.
      setResults(e.data);
      setIsSearching(false);
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const delayDebounce = setTimeout(() => {
      if (workerRef.current) {
        workerRef.current.postMessage({ entries, query });
      }
    }, 150);

    return () => clearTimeout(delayDebounce);
  }, [query, entries]);

  return {
    query,
    setQuery,
    results,
    isSearching,
  };
}
