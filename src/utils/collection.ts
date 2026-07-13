import { invoke } from '@tauri-apps/api/core';
import Database from '@tauri-apps/plugin-sql';
import type { CollectionFile, CollectionTimetable, DynamicData, SubjectEntry, DayOfWeek, TimetableMeta } from '../types';

const COLLECTION_VERSION = 1 as const;

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function nowIso(): string {
  return new Date().toISOString();
}

export function encodeCollection(data: CollectionFile): string {
  const json = JSON.stringify(data);
  return btoa(unescape(encodeURIComponent(json)));
}

export function decodeCollection(content: string): CollectionFile {
  const json = decodeURIComponent(escape(atob(content)));
  const data = JSON.parse(json) as CollectionFile;
  if (data.version !== COLLECTION_VERSION) {
    throw new Error(`Unsupported collection version: ${data.version}`);
  }
  return data;
}

export function createEmptyCollection(name: string): CollectionFile {
  const now = nowIso();
  const timetableId = generateId();
  return {
    version: COLLECTION_VERSION,
    timetables: [{
      id: timetableId,
      name,
      blueprints: [],
      instances: [],
      hiddenDays: ['Sun'],
      theme: 'blue',
      bandedRows: true,
      createdAt: now,
      updatedAt: now,
      dynamicData: [],
    }],
  };
}

export async function saveCollectionToFile(path: string, data: CollectionFile): Promise<void> {
  const encoded = encodeCollection(data);
  const bytes = Array.from(new TextEncoder().encode(encoded));
  await invoke('save_file_bytes', { path, bytes });
}

export async function loadCollectionFromFile(path: string): Promise<CollectionFile> {
  const content = await invoke<string>('read_text_file', { path });
  return decodeCollection(content);
}

export async function loadCollectionIntoDb(db: Database, path: string): Promise<{ name: string; timetables: TimetableMeta[] }> {
  const collection = await loadCollectionFromFile(path);
  const metas: TimetableMeta[] = [];

  for (const tt of collection.timetables) {
    const entriesJson = JSON.stringify({ blueprints: tt.blueprints, instances: tt.instances });
    const hiddenDaysJson = JSON.stringify(tt.hiddenDays);
    const now = nowIso();

    await db.execute(
      `INSERT OR REPLACE INTO timetables
       (id, name, entries_json, entry_count, created_at, updated_at, hidden_days, file_path, theme, banded_rows)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        tt.id, tt.name, entriesJson,
        tt.blueprints.length + tt.instances.length,
        tt.createdAt, now, hiddenDaysJson,
        path, tt.theme, tt.bandedRows ? 1 : 0,
      ],
    );

    for (const dd of tt.dynamicData) {
      await db.execute(
        'INSERT OR REPLACE INTO dynamic_data (id, data_type, value, display_as, timetable_id) VALUES ($1, $2, $3, $4, $5)',
        [dd.id, dd.dataType, dd.value, dd.displayAs, tt.id],
      );
    }

    metas.push({
      id: tt.id,
      name: tt.name,
      entryCount: tt.blueprints.length + tt.instances.length,
      createdAt: tt.createdAt,
      updatedAt: now,
      hiddenDays: tt.hiddenDays,
    });
  }

  const collectionName = path.split(/[/\\]/).pop()?.replace(/\.ttcl$/i, '') ?? 'Untitled';
  return { name: collectionName, timetables: metas };
}

export async function saveDbToCollectionFile(db: Database, path: string): Promise<void> {
  const rows = await db.select<{
    id: string; name: string; entries_json: string; hidden_days: string;
    theme: string | null; banded_rows: number | null;
    created_at: string; updated_at: string;
  }[]>('SELECT id, name, entries_json, hidden_days, theme, banded_rows, created_at, updated_at FROM timetables');

  const timetables: CollectionTimetable[] = [];

  for (const row of rows) {
    let blueprints: SubjectEntry[] = [];
    let instances: SubjectEntry[] = [];

    try {
      const parsed = JSON.parse(row.entries_json);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        blueprints = parsed.blueprints ?? [];
        instances = parsed.instances ?? [];
      } else if (Array.isArray(parsed)) {
        instances = parsed;
      }
    } catch {
      blueprints = [];
      instances = [];
    }

    let hiddenDays: DayOfWeek[] = [];
    try { hiddenDays = JSON.parse(row.hidden_days); } catch { hiddenDays = []; }

    const dynRows = await db.select<{ id: string; data_type: string; value: string; display_as: string }[]>(
      'SELECT id, data_type, value, display_as FROM dynamic_data WHERE timetable_id = $1',
      [row.id],
    );
    const dynamicData: DynamicData[] = dynRows.map(r => ({
      id: r.id, dataType: r.data_type, value: r.value, displayAs: r.display_as,
    }));

    timetables.push({
      id: row.id,
      name: row.name,
      blueprints,
      instances,
      hiddenDays,
      theme: row.theme ?? 'blue',
      bandedRows: row.banded_rows !== 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      dynamicData,
    });
  }

  const collection: CollectionFile = {
    version: COLLECTION_VERSION,
    timetables,
  };

  await saveCollectionToFile(path, collection);
}

export async function clearDb(db: Database): Promise<void> {
  await db.execute('DELETE FROM dynamic_data');
  await db.execute('DELETE FROM timetables');
}

export async function getDb(): Promise<Database> {
  return Database.load('sqlite:timetable.db');
}
