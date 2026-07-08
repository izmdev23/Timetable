import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Database from '@tauri-apps/plugin-sql';
import type { SubjectEntry, ConflictInfo, DayOfWeek, FormState } from '../types';
import { parseTeacherName } from '../utils/teacherName';

/** Shared DB connection promise — opened once per app session */
let dbPromise: Promise<Database> | null = null;

function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load('sqlite:timetable.db');
  }
  return dbPromise;
}

/** Converts "HH:mm" to total minutes for arithmetic comparison */
function toMinutes(time: string): number {
  const parts = time.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

/** Returns true if two time ranges overlap (exclusive boundary check) */
function timesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  const sa = toMinutes(startA);
  const ea = toMinutes(endA);
  const sb = toMinutes(startB);
  const eb = toMinutes(endB);
  return sa < eb && sb < ea;
}

/** Derives sorted unique string values from an array of entries via a field accessor */
function uniqueValues(
  entries: SubjectEntry[],
  accessor: (e: SubjectEntry) => string,
): string[] {
  const seen = new Set<string>();
  for (const entry of entries) {
    const val = accessor(entry).trim();
    if (val) seen.add(val);
  }
  return Array.from(seen).sort();
}

export interface DynamicData {
  id: string;
  dataType: string; // 'department' | 'program' | 'year' | 'section'
  value: string;
  displayAs: string;
}

export const DEFAULT_FORM_STATE: FormState = {
  subjectCode: '',
  offerCode: '',
  subjectDescription: '',
  teacherLastName: '',
  teacherFirstName: '',
  teacherMiddleName: '',
  room: [],
  colorRandom: true,
  color: '#2B4C7E',
  schedules: [{ days: [], timeRange: null, rooms: [] }],
  program: '',
  programShorthand: '',
  year: '1',
  section: '',
  department: '',
};

export interface TimetableStore {
  entries: SubjectEntry[];
  hiddenDays: DayOfWeek[];
  isLoading: boolean;
  filePath: string | null;
  updateFilePath: (path: string | null) => Promise<void>;
  addEntry: (entry: SubjectEntry) => ConflictInfo[];
  updateEntry: (entry: SubjectEntry) => ConflictInfo[];
  deleteEntry: (id: string) => void;
  setHiddenDays: (days: DayOfWeek[]) => void;
  detectConflicts: (candidate: SubjectEntry, againstEntries?: SubjectEntry[]) => ConflictInfo[];
  importEntries: (jsonString: string) => { success: boolean; error?: string };
  mergeEntries: (imported: SubjectEntry[]) => { successCount: number; skippedCount: number; totalImported: number };
  exportEntries: () => string;
  importSuggestions: (templates: Array<{
    subjectCode: string;
    offerCode: string;
    subjectDescription: string;
    assignedTeacherName: string;
    room: string;
    program?: string;
    programShorthand?: string;
    year?: number;
    section?: string;
  }>) => Promise<void>;
  importedSuggestions: Array<{
    subjectCode: string;
    offerCode: string;
    subjectDescription: string;
    assignedTeacherName: string;
    room: string;
    program?: string;
    programShorthand?: string;
    year?: number;
    section?: string;
  }>;
  deleteImportedSuggestion: (index: number) => Promise<void>;
  clearImportedSuggestions: () => Promise<void>;
  theme: string;
  bandedRows: boolean;
  updateTheme: (theme: string) => Promise<void>;
  updateBandedRows: (banded: boolean) => Promise<void>;
  suggestions: {
    assignedTeacherNames: string[];
    subjectCodes: string[];
    offerCodes: string[];
    rooms: string[];
    subjectDescriptions: string[];
  };
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  editingEntryId: string | null;
  formState: FormState;
  startEdit: (id: string) => void;
  cancelEdit: () => void;
  updateFormState: (state: FormState) => void;
  dynamicData: DynamicData[];
  addDynamicData: (dataType: string, value: string, displayAs: string) => Promise<void>;
  deleteDynamicData: (id: string) => Promise<void>;
}

/**
 * Central data store for a single timetable identified by `timetableId`.
 * Loads entries and hiddenDays from SQLite via @tauri-apps/plugin-sql on mount and persists on every mutation.
 */
export function useTimetableStore(timetableId: string): TimetableStore {
  const [entries, setEntries] = useState<SubjectEntry[]>([]);
  const [hiddenDays, setHiddenDaysState] = useState<DayOfWeek[]>([]);
  const [filePath, setFilePathState] = useState<string | null>(null);
  const [theme, setThemeState] = useState<string>('blue');
  const [bandedRows, setBandedRowsState] = useState<boolean>(true);
  const [importedSuggestions, setImportedSuggestionsState] = useState<Array<{
    subjectCode: string;
    offerCode: string;
    subjectDescription: string;
    assignedTeacherName: string;
    room: string;
    program?: string;
    programShorthand?: string;
    year?: number;
    section?: string;
  }>>([]);
  const [editingEntryId, setEditingEntryIdState] = useState<string | null>(null);
  const [formState, setFormStateState] = useState<FormState>(DEFAULT_FORM_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [dynamicData, setDynamicData] = useState<DynamicData[]>([]);

  const lastSavedEntriesRef = useRef<string>('');
  const lastSavedHiddenDaysRef = useRef<string>('');

  const historyRef = useRef<Array<{ entries: SubjectEntry[]; editingEntryId: string | null; formState: FormState }>>([]);
  const historyIndexRef = useRef<number>(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateHistoryState = useCallback((): void => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  // Load imported suggestions from localStorage on mount/timetableId change
  useEffect(() => {
    if (!timetableId) return;
    const stored = localStorage.getItem(`suggestions_${timetableId}`);
    if (stored) {
      try {
        setImportedSuggestionsState(JSON.parse(stored));
      } catch {
        setImportedSuggestionsState([]);
      }
    } else {
      setImportedSuggestionsState([]);
    }
  }, [timetableId]);

  // Load dynamic data on mount
  useEffect(() => {
    getDb()
      .then((db) => db.select<{ id: string; data_type: string; value: string; display_as: string }[]>('SELECT id, data_type, value, display_as FROM dynamic_data'))
      .then((rows) => {
        const mapped = rows.map((r) => ({
          id: r.id,
          dataType: r.data_type,
          value: r.value,
          displayAs: r.display_as,
        }));
        setDynamicData(mapped);
      })
      .catch((err) => console.error('Failed to load dynamic data:', err));
  }, []);

  const addDynamicData = useCallback(async (dataType: string, value: string, displayAs: string) => {
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const db = await getDb();
    await db.execute(
      'INSERT INTO dynamic_data (id, data_type, value, display_as) VALUES ($1, $2, $3, $4)',
      [id, dataType, value, displayAs]
    );
    setDynamicData((prev) => [...prev, { id, dataType, value, displayAs }]);
  }, []);

  const deleteDynamicData = useCallback(async (id: string) => {
    const db = await getDb();
    await db.execute('DELETE FROM dynamic_data WHERE id = $1', [id]);
    setDynamicData((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Load entries, hiddenDays, file_path, theme, and banded_rows from the database on mount
  useEffect(() => {
    if (!timetableId) return;
    setIsLoading(true);

    getDb()
      .then((db) =>
        db.select<{ entries_json: string; hidden_days: string; file_path: string | null; theme: string | null; banded_rows: number | null }[]>(
          'SELECT entries_json, hidden_days, file_path, theme, banded_rows FROM timetables WHERE id = $1',
          [timetableId],
        ),
      )
      .then((rows) => {
        const json = rows[0]?.entries_json ?? '[]';
        const hDaysJson = rows[0]?.hidden_days ?? '[]';
        const fPath = rows[0]?.file_path ?? null;
        const savedTheme = rows[0]?.theme ?? 'blue';
        const savedBanded = rows[0]?.banded_rows !== 0; // null or 1 will be true
        setFilePathState(fPath);
        setThemeState(savedTheme);
        setBandedRowsState(savedBanded);
        try {
          const parsed = JSON.parse(json);
          const initialEntries = (Array.isArray(parsed) ? parsed : []).map((e: any) => ({
            ...e,
            schedules: (e.schedules || []).map((s: any) => ({
              ...s,
              rooms: s.rooms || (e.room ? [e.room] : [])
            }))
          }));
          setEntries(initialEntries);
          lastSavedEntriesRef.current = JSON.stringify(initialEntries);
          setEditingEntryIdState(null);
          setFormStateState(DEFAULT_FORM_STATE);
          historyRef.current = [{
            entries: initialEntries,
            editingEntryId: null,
            formState: DEFAULT_FORM_STATE
          }];
          historyIndexRef.current = 0;
          updateHistoryState();
        } catch {
          setEntries([]);
          lastSavedEntriesRef.current = '[]';
          setEditingEntryIdState(null);
          setFormStateState(DEFAULT_FORM_STATE);
          historyRef.current = [{
            entries: [],
            editingEntryId: null,
            formState: DEFAULT_FORM_STATE
          }];
          historyIndexRef.current = 0;
          updateHistoryState();
        }
        try {
          const parsedDays = JSON.parse(hDaysJson);
          const initialHidden = Array.isArray(parsedDays) ? parsedDays : [];
          setHiddenDaysState(initialHidden);
          lastSavedHiddenDaysRef.current = JSON.stringify(initialHidden);
        } catch {
          setHiddenDaysState([]);
          lastSavedHiddenDaysRef.current = '[]';
        }
      })
      .catch(() => {
        setEntries([]);
        setHiddenDaysState([]);
        setFilePathState(null);
        setThemeState('blue');
        setBandedRowsState(true);
      })
      .finally(() => setIsLoading(false));
  }, [timetableId, updateHistoryState]);

  /** Unified function to commit a new state to both history and local React state. */
  const commitState = useCallback(
    (
      newEntries: SubjectEntry[],
      newEditingEntryId: string | null,
      newFormState: FormState,
      isUndoRedoOperation = false,
      newHiddenDays = hiddenDays
    ): void => {
      setEntries(newEntries);
      setEditingEntryIdState(newEditingEntryId);
      setFormStateState(newFormState);
      setHiddenDaysState(newHiddenDays);

      if (!isUndoRedoOperation) {
        const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
        newHistory.push({
          entries: newEntries,
          editingEntryId: newEditingEntryId,
          formState: newFormState,
        });
        historyRef.current = newHistory;
        historyIndexRef.current = newHistory.length - 1;
        updateHistoryState();
      }

      const entriesJson = JSON.stringify(newEntries);
      const hiddenDaysJson = JSON.stringify(newHiddenDays);

      const entriesChanged = entriesJson !== lastSavedEntriesRef.current;
      const hiddenDaysChanged = hiddenDaysJson !== lastSavedHiddenDaysRef.current;

      if (entriesChanged || hiddenDaysChanged) {
        lastSavedEntriesRef.current = entriesJson;
        lastSavedHiddenDaysRef.current = hiddenDaysJson;

        const now = new Date().toISOString();
        getDb()
          .then((db) =>
            db.execute(
              'UPDATE timetables SET entries_json = $1, entry_count = $2, updated_at = $3, hidden_days = $4 WHERE id = $5',
              [entriesJson, newEntries.length, now, hiddenDaysJson, timetableId],
            ),
          )
          .catch((e: unknown) => console.error('Failed to save timetable:', e));
      }
    },
    [timetableId, hiddenDays, updateHistoryState]
  );

  /** Legacy wrapper maintained for compatibility. */
  const persistEntries = useCallback(
    (newEntries: SubjectEntry[], newHiddenDays = hiddenDays, isUndoRedoOperation = false): void => {
      commitState(newEntries, editingEntryId, formState, isUndoRedoOperation, newHiddenDays);
    },
    [commitState, editingEntryId, formState, hiddenDays],
  );

  const setHiddenDays = useCallback(
    (days: DayOfWeek[]): void => {
      persistEntries(entries, days);
    },
    [entries, persistEntries],
  );

  const updateFilePath = useCallback(
    async (path: string | null): Promise<void> => {
      setFilePathState(path);
      const db = await getDb();
      const now = new Date().toISOString();
      await db.execute(
        'UPDATE timetables SET file_path = $1, updated_at = $2 WHERE id = $3',
        [path, now, timetableId]
      );
    },
    [timetableId]
  );

  /**
   * Checks whether a candidate entry creates teacher or room conflicts
   * against existing entries (skips the entry with its own id when editing).
   */
  const detectConflicts = useCallback(
    (candidate: SubjectEntry, againstEntries?: SubjectEntry[]): ConflictInfo[] => {
      const conflicts: ConflictInfo[] = [];
      const targetList = againstEntries ?? entries;

      for (const existing of targetList) {
        if (existing.id === candidate.id) continue;

        for (const cs of candidate.schedules) {
          for (const cDay of cs.days) {
            for (const es of existing.schedules) {
              for (const eDay of es.days) {
                if (cDay !== eDay) continue;
                if (!timesOverlap(cs.startTime, cs.endTime, es.startTime, es.endTime)) continue;

                const info: { day: DayOfWeek; startTime: string; endTime: string } = {
                  day: cDay,
                  startTime: cs.startTime,
                  endTime: cs.endTime,
                };

                // General Time conflict: any overlap in schedule times on the same day
                conflicts.push({ type: 'time', conflictingEntry: existing, ...info });

                // Teacher conflict: same assigned teacher, same time
                if (
                  candidate.assignedTeacherName &&
                  existing.assignedTeacherName &&
                  candidate.assignedTeacherName.trim().toLowerCase() ===
                    existing.assignedTeacherName.trim().toLowerCase()
                ) {
                  conflicts.push({ type: 'teacher', conflictingEntry: existing, ...info });
                }

                 // Room conflict: same room at schedule level, same time
                 const candRooms = cs.rooms || [];
                 const existRooms = es.rooms || [];
                 const hasRoomOverlap = candRooms.some((r) =>
                   existRooms.some((er) => er.trim().toLowerCase() === r.trim().toLowerCase())
                 );
                 if (hasRoomOverlap) {
                   conflicts.push({ type: 'room', conflictingEntry: existing, ...info });
                 }
              }
            }
          }
        }
      }

      return conflicts;
    },
    [entries],
  );

  /**
   * Adds a new entry. Returns any detected conflicts.
   * The entry is NOT added if conflicts exist.
   */
  const addEntry = useCallback(
    (entry: SubjectEntry): ConflictInfo[] => {
      const existingMatch = entries.find(
        (e) =>
          e.subjectCode.trim().toLowerCase() === entry.subjectCode.trim().toLowerCase() &&
          e.offerCode.trim().toLowerCase() === entry.offerCode.trim().toLowerCase() &&
          e.subjectDescription.trim().toLowerCase() === entry.subjectDescription.trim().toLowerCase()
      );

      let nextEntries = entries;
      let targetEntry = entry;

      if (existingMatch) {
        targetEntry = {
          ...existingMatch,
          assignedTeacherName: entry.assignedTeacherName,
          room: entry.room,
          color: entry.color !== undefined ? entry.color : existingMatch.color,
          schedules: [...existingMatch.schedules, ...entry.schedules],
        };
        nextEntries = entries.map((e) => (e.id === existingMatch.id ? targetEntry : e));
      } else {
        nextEntries = [...entries, entry];
      }

      commitState(nextEntries, null, DEFAULT_FORM_STATE);
      return detectConflicts(targetEntry, nextEntries);
    },
    [detectConflicts, entries, commitState],
  );

  /**
   * Replaces an existing entry by id. Returns conflicts.
   */
  const updateEntry = useCallback(
    (entry: SubjectEntry): ConflictInfo[] => {
      const nextEntries = entries.map((e) => (e.id === entry.id ? entry : e));
      commitState(nextEntries, null, DEFAULT_FORM_STATE);
      return detectConflicts(entry, nextEntries);
    },
    [detectConflicts, entries, commitState],
  );

  const deleteEntry = useCallback(
    (id: string): void => {
      const nextEntries = entries.filter((e) => e.id !== id);
      const nextEditingEntryId = editingEntryId === id ? null : editingEntryId;
      const nextFormState = editingEntryId === id ? DEFAULT_FORM_STATE : formState;
      commitState(nextEntries, nextEditingEntryId, nextFormState);
    },
    [entries, editingEntryId, formState, commitState],
  );

  const exportEntries = useCallback((): string => {
    return JSON.stringify(entries, null, 2);
  }, [entries]);

  const importEntries = useCallback(
    (jsonString: string): { success: boolean; error?: string } => {
      try {
        const parsed = JSON.parse(jsonString);
        if (!Array.isArray(parsed)) {
          return { success: false, error: 'JSON root must be an array of timetable entries.' };
        }
        for (const item of parsed) {
          if (
            typeof item !== 'object' ||
            item === null ||
            !item.id ||
            !item.subjectCode ||
            !Array.isArray(item.schedules)
          ) {
            return { success: false, error: 'Invalid structure. Entries must contain id, subjectCode, and schedules.' };
          }
        }
        persistEntries(parsed);
        return { success: true };
      } catch (e: unknown) {
        return { success: false, error: e instanceof Error ? e.message : 'Invalid JSON format.' };
      }
    },
    [persistEntries],
  );

  const mergeEntries = useCallback(
    (imported: SubjectEntry[]): { successCount: number; skippedCount: number; totalImported: number } => {
      const currentList = [...entries];
      let successCount = 0;
      let skippedCount = 0;
      const totalImported = imported.length;

      for (const entry of imported) {
        const existingMatchIndex = currentList.findIndex(
          (e) =>
            e.subjectCode.trim().toLowerCase() === entry.subjectCode.trim().toLowerCase() &&
            e.offerCode.trim().toLowerCase() === entry.offerCode.trim().toLowerCase() &&
            e.subjectDescription.trim().toLowerCase() === entry.subjectDescription.trim().toLowerCase()
        );

        if (existingMatchIndex !== -1) {
          const existingMatch = currentList[existingMatchIndex];

          // Check if every incoming schedule already exists in the existing entry
          const allSchedulesDuplicate = entry.schedules.every((impSched) =>
            existingMatch.schedules.some(
              (s) =>
                s.startTime === impSched.startTime &&
                s.endTime === impSched.endTime &&
                s.days.length === impSched.days.length &&
                s.days.every((d) => impSched.days.includes(d))
            )
          );

          // Check if the core metadata also fully matches
          const metaMatch =
            existingMatch.assignedTeacherName === entry.assignedTeacherName &&
            existingMatch.room === entry.room &&
            existingMatch.program === entry.program &&
            existingMatch.programShorthand === entry.programShorthand &&
            existingMatch.year === entry.year &&
            existingMatch.section === entry.section;

          // If fully duplicate (same meta + all schedules exist), skip entirely
          if (allSchedulesDuplicate && metaMatch) {
            skippedCount++;
            continue;
          }

          // Partial match: merge in only the new schedules
          const mergedSchedules = [...existingMatch.schedules];
          for (const impSched of entry.schedules) {
            const hasDuplicate = mergedSchedules.some(
              (s) =>
                s.startTime === impSched.startTime &&
                s.endTime === impSched.endTime &&
                s.days.length === impSched.days.length &&
                s.days.every((d) => impSched.days.includes(d))
            );
            if (!hasDuplicate) {
              mergedSchedules.push({
                ...impSched,
                id: impSched.id || Math.random().toString(36).slice(2) + Date.now().toString(36),
              });
            }
          }

          const mergedEntry: SubjectEntry = {
            ...existingMatch,
            assignedTeacherName: entry.assignedTeacherName || existingMatch.assignedTeacherName,
            room: entry.room || existingMatch.room,
            color: entry.color !== undefined ? entry.color : existingMatch.color,
            schedules: mergedSchedules,
          };
          currentList[existingMatchIndex] = mergedEntry;
          successCount++;
        } else {
          const newEntry: SubjectEntry = {
            ...entry,
            id: entry.id || Math.random().toString(36).slice(2) + Date.now().toString(36),
          };
          currentList.push(newEntry);
          successCount++;
        }
      }

      persistEntries(currentList);
      return { successCount, skippedCount, totalImported };
    },
    [entries, persistEntries]
  );

  const importSuggestions = useCallback(
    async (templates: Array<{
      subjectCode: string;
      offerCode: string;
      subjectDescription: string;
      assignedTeacherName: string;
      room: string;
      program?: string;
      programShorthand?: string;
      year?: number;
      section?: string;
    }>): Promise<void> => {
      setImportedSuggestionsState(templates);
      localStorage.setItem(`suggestions_${timetableId}`, JSON.stringify(templates));
    },
    [timetableId]
  );

  const deleteImportedSuggestion = useCallback(
    async (index: number): Promise<void> => {
      const updated = [...importedSuggestions];
      updated.splice(index, 1);
      setImportedSuggestionsState(updated);
      localStorage.setItem(`suggestions_${timetableId}`, JSON.stringify(updated));
    },
    [importedSuggestions, timetableId]
  );

  const clearImportedSuggestions = useCallback(
    async (): Promise<void> => {
      setImportedSuggestionsState([]);
      localStorage.removeItem(`suggestions_${timetableId}`);
    },
    [timetableId]
  );

  const updateTheme = useCallback(
    async (newTheme: string): Promise<void> => {
      setThemeState(newTheme);
      const db = await getDb();
      const now = new Date().toISOString();
      await db.execute(
        'UPDATE timetables SET theme = $1, updated_at = $2 WHERE id = $3',
        [newTheme, now, timetableId]
      );
    },
    [timetableId]
  );

  const updateBandedRows = useCallback(
    async (banded: boolean): Promise<void> => {
      setBandedRowsState(banded);
      const db = await getDb();
      const now = new Date().toISOString();
      await db.execute(
        'UPDATE timetables SET banded_rows = $1, updated_at = $2 WHERE id = $3',
        [banded ? 1 : 0, now, timetableId]
      );
    },
    [timetableId]
  );

  const suggestions = useMemo(() => {
    const combinedEntries = [
      ...entries,
      ...importedSuggestions.map((s, idx) => ({
        id: `imported-${idx}`,
        subjectCode: s.subjectCode,
        offerCode: s.offerCode,
        subjectDescription: s.subjectDescription,
        assignedTeacherName: s.assignedTeacherName,
        room: s.room,
        schedules: [],
        program: s.program || '',
        programShorthand: s.programShorthand || '',
        year: s.year || 1,
        section: s.section || '',
        department: '',
      }))
    ];
    return {
      assignedTeacherNames: uniqueValues(combinedEntries, (e) => e.assignedTeacherName),
      subjectCodes: uniqueValues(combinedEntries, (e) => e.subjectCode),
      offerCodes: uniqueValues(combinedEntries, (e) => e.offerCode),
      rooms: (() => {
        const seen = new Set<string>();
        for (const entry of combinedEntries) {
          const val = entry.room || '';
          if (val) {
            val.split(',').forEach((r) => {
              const trimmed = r.trim();
              if (trimmed) seen.add(trimmed);
            });
          }
          if (entry.schedules) {
            for (const s of entry.schedules) {
              if (s.rooms) {
                s.rooms.forEach((r) => {
                  const trimmed = r.trim();
                  if (trimmed) seen.add(trimmed);
                });
              }
            }
          }
        }
        return Array.from(seen).sort();
      })(),
      subjectDescriptions: uniqueValues(combinedEntries, (e) => e.subjectDescription),
    };
  }, [entries, importedSuggestions]);

  const startEdit = useCallback(
    (id: string): void => {
      const entry = entries.find((e) => e.id === id);
      if (!entry) return;

      const { lastName, firstName, middleName } = parseTeacherName(entry.assignedTeacherName);

      const newFormState: FormState = {
        subjectCode: entry.subjectCode,
        offerCode: entry.offerCode,
        subjectDescription: entry.subjectDescription,
        teacherLastName: lastName,
        teacherFirstName: firstName,
        teacherMiddleName: middleName,
        room: entry.room ? entry.room.split(',').map((r) => r.trim()).filter(Boolean) : [],
        colorRandom: !entry.color,
        color: entry.color || '#2B4C7E',
        schedules: entry.schedules.map((s) => ({
          days: s.days,
          timeRange: [s.startTime, s.endTime],
          rooms: s.rooms || (entry.room ? [entry.room] : []),
        })),
        program: entry.program || '',
        programShorthand: entry.programShorthand || '',
        year: entry.year ? String(entry.year) : '1',
        section: entry.section || '',
        department: entry.department || '',
      };

      commitState(entries, id, newFormState);
    },
    [entries, commitState]
  );

  const cancelEdit = useCallback((): void => {
    commitState(entries, null, DEFAULT_FORM_STATE);
  }, [entries, commitState]);

  const updateFormState = useCallback(
    (newFormState: FormState): void => {
      commitState(entries, editingEntryId, newFormState);
    },
    [entries, editingEntryId, commitState]
  );

  const undo = useCallback((): void => {
    if (historyIndexRef.current > 0) {
      const oldState = historyRef.current[historyIndexRef.current];
      historyIndexRef.current -= 1;
      const newState = historyRef.current[historyIndexRef.current];
      commitState(newState.entries, newState.editingEntryId, newState.formState, true);
      updateHistoryState();

      window.dispatchEvent(
        new CustomEvent('timetable:history-focus', {
          detail: { oldState, newState },
        })
      );
    }
  }, [commitState, updateHistoryState]);

  const redo = useCallback((): void => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      const oldState = historyRef.current[historyIndexRef.current];
      historyIndexRef.current += 1;
      const newState = historyRef.current[historyIndexRef.current];
      commitState(newState.entries, newState.editingEntryId, newState.formState, true);
      updateHistoryState();

      window.dispatchEvent(
        new CustomEvent('timetable:history-focus', {
          detail: { oldState, newState },
        })
      );
    }
  }, [commitState, updateHistoryState]);

  return {
    entries,
    hiddenDays,
    isLoading,
    filePath,
    updateFilePath,
    addEntry,
    updateEntry,
    deleteEntry,
    setHiddenDays,
    detectConflicts,
    importEntries,
    mergeEntries,
    exportEntries,
    importSuggestions,
    importedSuggestions,
    deleteImportedSuggestion,
    clearImportedSuggestions,
    theme,
    bandedRows,
    updateTheme,
    updateBandedRows,
    suggestions,
    undo,
    redo,
    canUndo,
    canRedo,
    editingEntryId,
    formState,
    startEdit,
    cancelEdit,
    updateFormState,
    dynamicData,
    addDynamicData,
    deleteDynamicData,
  };
}
