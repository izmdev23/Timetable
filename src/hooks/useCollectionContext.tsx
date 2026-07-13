import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { CollectionRecord, TimetableMeta } from '../types';
import { loadCollectionIntoDb, saveDbToCollectionFile, createEmptyCollection, saveCollectionToFile, clearDb, getDb } from '../utils/collection';

const RECENT_KEY = 'recent_collections';

function loadRecentCollections(): CollectionRecord[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (raw) return JSON.parse(raw) as CollectionRecord[];
  } catch { /* ignore */ }
  return [];
}

function saveRecentCollections(recent: CollectionRecord[]): void {
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
}

interface CollectionContextValue {
  /** Path to the currently loaded .ttcl file, or null if none */
  collectionPath: string | null;
  /** Display name of the current collection */
  collectionName: string | null;
  /** Whether a collection is currently loaded */
  isCollectionOpen: boolean;
  /** Recent collections list */
  recentCollections: CollectionRecord[];
  /** Load a collection from a .ttcl file into SQLite */
  openCollection: (path: string) => Promise<TimetableMeta[]>;
  /** Create a new empty collection */
  createCollection: (path: string, name: string) => Promise<TimetableMeta[]>;
  /** Save current collection state to its .ttcl file */
  saveCollection: () => Promise<void>;
  /** Save current collection to a new .ttcl file */
  saveCollectionAs: (path: string) => Promise<void>;
  /** Close the current collection (clear SQLite) */
  closeCollection: () => Promise<void>;
  /** Refresh recent collections from localStorage */
  refreshRecent: () => void;
}

const CollectionContext = createContext<CollectionContextValue | null>(null);

export function CollectionProvider({ children }: { children: ReactNode }) {
  const [collectionPath, setCollectionPath] = useState<string | null>(null);
  const [collectionName, setCollectionName] = useState<string | null>(null);
  const [recentCollections, setRecentCollections] = useState<CollectionRecord[]>(loadRecentCollections);
  const isCollectionOpen = collectionPath !== null;

  const refreshRecent = useCallback(() => {
    setRecentCollections(loadRecentCollections());
  }, []);

  const addToRecent = useCallback((path: string, name: string, timetableCount: number) => {
    setRecentCollections((prev) => {
      const filtered = prev.filter((r) => r.path !== path);
      const updated: CollectionRecord = { name, path, timetableCount, lastOpened: new Date().toISOString() };
      const next = [updated, ...filtered].slice(0, 20);
      saveRecentCollections(next);
      return next;
    });
  }, []);

  const openCollection = useCallback(async (path: string): Promise<TimetableMeta[]> => {
    const db = await getDb();
    await clearDb(db);
    const result = await loadCollectionIntoDb(db, path);
    const displayName = path.split(/[/\\]/).pop()?.replace(/\.ttcl$/i, '') ?? 'Untitled';
    setCollectionPath(path);
    setCollectionName(displayName);
    addToRecent(path, displayName, result.timetables.length);
    return result.timetables;
  }, [addToRecent]);

  const createCollection = useCallback(async (path: string, name: string): Promise<TimetableMeta[]> => {
    const db = await getDb();
    await clearDb(db);

    const collection = createEmptyCollection(name);
    await saveCollectionToFile(path, collection);

    const result = await loadCollectionIntoDb(db, path);
    setCollectionPath(path);
    setCollectionName(name);
    addToRecent(path, name, result.timetables.length);
    return result.timetables;
  }, [addToRecent]);

  const saveCollection = useCallback(async (): Promise<void> => {
    if (!collectionPath) throw new Error('No collection is open');
    const db = await getDb();
    await saveDbToCollectionFile(db, collectionPath);
  }, [collectionPath]);

  const saveCollectionAs = useCallback(async (path: string): Promise<void> => {
    const db = await getDb();
    await saveDbToCollectionFile(db, path);
    setCollectionPath(path);
    const displayName = path.split(/[/\\]/).pop()?.replace(/\.ttcl$/i, '') ?? 'Untitled';
    setCollectionName(displayName);
  }, []);

  const closeCollection = useCallback(async (): Promise<void> => {
    const db = await getDb();
    await clearDb(db);
    setCollectionPath(null);
    setCollectionName(null);
  }, []);

  return (
    <CollectionContext.Provider value={{
      collectionPath,
      collectionName,
      isCollectionOpen,
      recentCollections,
      openCollection,
      createCollection,
      saveCollection,
      saveCollectionAs,
      closeCollection,
      refreshRecent,
    }}>
      {children}
    </CollectionContext.Provider>
  );
}

export function useCollection(): CollectionContextValue {
  const ctx = useContext(CollectionContext);
  if (!ctx) throw new Error('useCollection must be used inside CollectionProvider');
  return ctx;
}
