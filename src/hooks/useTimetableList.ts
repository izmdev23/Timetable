import { useState, useCallback, useEffect } from 'react';
import Database from '@tauri-apps/plugin-sql';
import type { TimetableMeta, DayOfWeek } from '../types';

/** Shared DB connection promise — opened once per app session */
let dbPromise: Promise<Database> | null = null;

function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load('sqlite:timetable.db');
  }
  return dbPromise;
}

/** Returns a UTC ISO-8601 timestamp string for the current moment */
function nowIso(): string {
  return new Date().toISOString();
}

/** Generates a random UUID-v4-like string without an external library */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface TimetableListStore {
  timetables: TimetableMeta[];
  isLoading: boolean;
  createTimetable: (name: string) => Promise<TimetableMeta>;
  deleteTimetable: (id: string) => Promise<void>;
  renameTimetable: (id: string, name: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Manages the home-page list of timetables via SQLite (tauri-plugin-sql).
 * All SQL runs on the frontend — the Rust layer only provides the connection pool.
 */
export function useTimetableList(): TimetableListStore {
  const [timetables, setTimetables] = useState<TimetableMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const db = await getDb();
      const rows = await db.select<{
        id: string;
        name: string;
        entry_count: number;
        created_at: string;
        updated_at: string;
        hidden_days: string;
      }[]>('SELECT id, name, entry_count, created_at, updated_at, hidden_days FROM timetables ORDER BY updated_at DESC');

      setTimetables(
        rows.map((r) => {
          let hDays: DayOfWeek[] = [];
          try {
            hDays = JSON.parse(r.hidden_days || '[]');
          } catch {
            hDays = [];
          }
          return {
            id: r.id,
            name: r.name,
            entryCount: r.entry_count,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            hiddenDays: hDays,
          };
        }),
      );
    } catch (e: unknown) {
      console.error('Failed to load timetables:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createTimetable = useCallback(async (name: string): Promise<TimetableMeta> => {
    const db = await getDb();
    const id = generateId();
    const now = nowIso();
    await db.execute(
      'INSERT INTO timetables (id, name, entries_json, entry_count, created_at, updated_at, hidden_days) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, name, '[]', 0, now, now, '["Sun"]'],
    );
    const meta: TimetableMeta = { id, name, entryCount: 0, createdAt: now, updatedAt: now, hiddenDays: ['Sun'] };
    setTimetables((prev) => [meta, ...prev]);
    return meta;
  }, []);

  const deleteTimetable = useCallback(async (id: string): Promise<void> => {
    const db = await getDb();
    await db.execute('DELETE FROM timetables WHERE id = $1', [id]);
    setTimetables((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const renameTimetable = useCallback(async (id: string, name: string): Promise<void> => {
    const db = await getDb();
    const now = nowIso();
    await db.execute('UPDATE timetables SET name = $1, updated_at = $2 WHERE id = $3', [name, now, id]);
    setTimetables((prev) => prev.map((t) => (t.id === id ? { ...t, name, updatedAt: now } : t)));
  }, []);

  return { timetables, isLoading, createTimetable, deleteTimetable, renameTimetable, refresh };
}
