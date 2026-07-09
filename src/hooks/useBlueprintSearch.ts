import { useState, useEffect, useRef } from 'react';
import type { SubjectEntry } from '../types';

export function useBlueprintSearch(entries: SubjectEntry[]) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SubjectEntry[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../utils/searchWorker.ts', import.meta.url),
      { type: 'module' }
    );

    workerRef.current.onmessage = (e: MessageEvent<SubjectEntry[]>) => {
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
