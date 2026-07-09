import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Database from '@tauri-apps/plugin-sql';
import type { SubjectEntry, ConflictInfo, DayOfWeek, FormState } from '../types';
import { getConnectedKeys } from '../utils/linkUtils';

let dbPromise: Promise<Database> | null = null;

function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load('sqlite:timetable.db');
  }
  return dbPromise;
}

function toMinutes(time: string): number {
  const parts = time.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function timesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const sa = toMinutes(startA);
  const ea = toMinutes(endA);
  const sb = toMinutes(startB);
  const eb = toMinutes(endB);
  return sa < eb && sb < ea;
}

function uniqueValues(entries: SubjectEntry[], accessor: (e: SubjectEntry) => string | undefined | null): string[] {
  const seen = new Set<string>();
  for (const entry of entries) {
    const val = (accessor(entry) || '').trim();
    if (val) seen.add(val);
  }
  return Array.from(seen).sort();
}

export interface DynamicData {
  id: string;
  dataType: string;
  value: string;
  displayAs: string;
}

export const DEFAULT_FORM_STATE: FormState = {
  subjectCode: '',
  offerCode: '',
  subjectDescription: '',
  room: [],
  colorRandom: true,
  color: '#2B4C7E',
  schedules: [],
  program: '',
  year: '1',
  section: '',
  department: '',
};

export interface TimetableStore {
  blueprints: SubjectEntry[];
  instances: SubjectEntry[];
  hiddenDays: DayOfWeek[];
  isLoading: boolean;
  filePath: string | null;
  updateFilePath: (path: string | null) => Promise<void>;
  addBlueprint: (entry: SubjectEntry) => ConflictInfo[];
  addInstance: (entry: SubjectEntry) => ConflictInfo[];
  updateInstance: (entry: SubjectEntry, editedScheduleId?: string) => ConflictInfo[];
  deleteBlueprint: (id: string) => void;
  deleteInstance: (id: string) => void;
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
  updateDynamicData: (id: string, dataType: string, value: string, displayAs: string) => Promise<void>;
}

interface HistorySnapshot {
  blueprints: SubjectEntry[];
  instances: SubjectEntry[];
  editingEntryId: string | null;
  formState: FormState;
  dynamicData: DynamicData[];
}

function migrateEntries(parsed: unknown): { blueprints: SubjectEntry[]; instances: SubjectEntry[] } {
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.blueprints) && Array.isArray(obj.instances)) {
      return { blueprints: obj.blueprints as SubjectEntry[], instances: obj.instances as SubjectEntry[] };
    }
  }
  if (Array.isArray(parsed)) {
    const blueprints: SubjectEntry[] = [];
    const instances: SubjectEntry[] = [];
    for (const entry of parsed as SubjectEntry[]) {
      const cleaned = {
        ...entry,
        schedules: (entry.schedules || []).map((s) => ({
          ...s,
          rooms: s.rooms || (entry.room ? [entry.room] : [])
        }))
      };
      if (cleaned.schedules.length > 0) {
        const blueprint = { ...cleaned, schedules: [], assignedTeacherName: '', room: undefined };
        const existingBp = blueprints.find(
          (b) => b.subjectCode === blueprint.subjectCode && b.offerCode === blueprint.offerCode
        );
        if (!existingBp) {
          blueprints.push(blueprint);
        }
        instances.push(cleaned);
      } else {
        blueprints.push(cleaned);
      }
    }
    return { blueprints, instances };
  }
  return { blueprints: [], instances: [] };
}

export function useTimetableStore(timetableId: string): TimetableStore {
  const [blueprints, setBlueprints] = useState<SubjectEntry[]>([]);
  const [instances, setInstances] = useState<SubjectEntry[]>([]);
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

  const lastSavedJsonRef = useRef<string>('');
  const lastSavedHiddenDaysRef = useRef<string>('');

  const historyRef = useRef<HistorySnapshot[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateHistoryState = useCallback((): void => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, []);

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

  useEffect(() => {
    if (!timetableId) return;
    getDb()
      .then((db) => db.select<{ id: string; data_type: string; value: string; display_as: string }[]>(
        'SELECT id, data_type, value, display_as FROM dynamic_data WHERE timetable_id = $1',
        [timetableId]
      ))
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
  }, [timetableId]);

  const addDynamicData = useCallback(async (dataType: string, value: string, displayAs: string) => {
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const db = await getDb();
    await db.execute(
      'INSERT INTO dynamic_data (id, data_type, value, display_as, timetable_id) VALUES ($1, $2, $3, $4, $5)',
      [id, dataType, value, displayAs, timetableId]
    );
    setDynamicData((prev) => [...prev, { id, dataType, value, displayAs }]);
  }, [timetableId]);

  const deleteDynamicData = useCallback(async (id: string) => {
    const db = await getDb();
    await db.execute('DELETE FROM dynamic_data WHERE id = $1', [id]);
    setDynamicData((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateDynamicData = useCallback(async (id: string, dataType: string, value: string, displayAs: string) => {
    const db = await getDb();
    await db.execute(
      'UPDATE dynamic_data SET data_type = $2, value = $3, display_as = $4 WHERE id = $1',
      [id, dataType, value, displayAs]
    );
    setDynamicData((prev) =>
      prev.map((item) => (item.id === id ? { id, dataType, value, displayAs } : item))
    );
  }, []);

  // Load from DB on mount
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
        const savedBanded = rows[0]?.banded_rows !== 0;

        setFilePathState(fPath);
        setThemeState(savedTheme);
        setBandedRowsState(savedBanded);

        try {
          const parsed = JSON.parse(json);
          const { blueprints: initialBlueprints, instances: initialInstances } = migrateEntries(parsed);
          setBlueprints(initialBlueprints);
          setInstances(initialInstances);
          lastSavedJsonRef.current = JSON.stringify({ blueprints: initialBlueprints, instances: initialInstances });
          setEditingEntryIdState(null);
          setFormStateState(DEFAULT_FORM_STATE);
          historyRef.current = [{
            blueprints: initialBlueprints,
            instances: initialInstances,
            editingEntryId: null,
            formState: DEFAULT_FORM_STATE,
            dynamicData,
          }];
          historyIndexRef.current = 0;
          updateHistoryState();
        } catch {
          setBlueprints([]);
          setInstances([]);
          lastSavedJsonRef.current = JSON.stringify({ blueprints: [], instances: [] });
          setEditingEntryIdState(null);
          setFormStateState(DEFAULT_FORM_STATE);
          historyRef.current = [{
            blueprints: [],
            instances: [],
            editingEntryId: null,
            formState: DEFAULT_FORM_STATE,
            dynamicData,
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
        setBlueprints([]);
        setInstances([]);
        setHiddenDaysState([]);
        setFilePathState(null);
        setThemeState('blue');
        setBandedRowsState(true);
      })
      .finally(() => setIsLoading(false));
  }, [timetableId, updateHistoryState]);

  const commitState = useCallback(
    (
      newBlueprints: SubjectEntry[],
      newInstances: SubjectEntry[],
      newEditingEntryId: string | null,
      newFormState: FormState,
      isUndoRedoOperation = false,
      newHiddenDays = hiddenDays
    ): void => {
      setBlueprints(newBlueprints);
      setInstances(newInstances);
      setEditingEntryIdState(newEditingEntryId);
      setFormStateState(newFormState);
      setHiddenDaysState(newHiddenDays);

      if (!isUndoRedoOperation) {
        const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
        newHistory.push({
          blueprints: newBlueprints,
          instances: newInstances,
          editingEntryId: newEditingEntryId,
          formState: newFormState,
          dynamicData,
        });
        historyRef.current = newHistory;
        historyIndexRef.current = newHistory.length - 1;
        updateHistoryState();
      }

      const combinedJson = JSON.stringify({ blueprints: newBlueprints, instances: newInstances });
      const hiddenDaysJson = JSON.stringify(newHiddenDays);

      const entriesChanged = combinedJson !== lastSavedJsonRef.current;
      const hiddenDaysChanged = hiddenDaysJson !== lastSavedHiddenDaysRef.current;

      if (entriesChanged || hiddenDaysChanged) {
        lastSavedJsonRef.current = combinedJson;
        lastSavedHiddenDaysRef.current = hiddenDaysJson;

        const now = new Date().toISOString();
        const totalCount = newBlueprints.length + newInstances.length;
        getDb()
          .then((db) =>
            db.execute(
              'UPDATE timetables SET entries_json = $1, entry_count = $2, updated_at = $3, hidden_days = $4 WHERE id = $5',
              [combinedJson, totalCount, now, hiddenDaysJson, timetableId],
            ),
          )
          .catch((e: unknown) => console.error('Failed to save timetable:', e));
      }
    },
    [timetableId, hiddenDays, updateHistoryState, dynamicData]
  );

  const persistState = useCallback(
    (newBlueprints: SubjectEntry[], newInstances: SubjectEntry[], isUndoRedoOperation = false): void => {
      commitState(newBlueprints, newInstances, editingEntryId, formState, isUndoRedoOperation, hiddenDays);
    },
    [commitState, editingEntryId, formState, hiddenDays],
  );

  const setHiddenDays = useCallback(
    (_days: DayOfWeek[]): void => {
      persistState(blueprints, instances);
    },
    [blueprints, instances, persistState],
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

  const detectConflicts = useCallback(
    (candidate: SubjectEntry, againstEntries?: SubjectEntry[]): ConflictInfo[] => {
      const conflicts: ConflictInfo[] = [];
      const targetList = againstEntries ?? instances;

      for (const existing of targetList) {
        if (existing.id === candidate.id) continue;

        for (const cs of candidate.schedules) {
          for (const cDay of cs.days) {
            for (const es of existing.schedules) {
              for (const eDay of es.days) {
                if (cDay !== eDay) continue;
                if (!timesOverlap(cs.startTime, cs.endTime, es.startTime, es.endTime)) continue;

                const info = { day: cDay, startTime: cs.startTime, endTime: cs.endTime };

                conflicts.push({ type: 'time', conflictingEntry: existing, ...info });

                if (
                  candidate.assignedTeacherName &&
                  existing.assignedTeacherName &&
                  candidate.assignedTeacherName.trim().toLowerCase() === existing.assignedTeacherName.trim().toLowerCase()
                ) {
                  conflicts.push({ type: 'teacher', conflictingEntry: existing, ...info });
                }

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
    [instances],
  );

  const addBlueprint = useCallback(
    (entry: SubjectEntry): ConflictInfo[] => {
      const existing = blueprints.find((e) => e.id === entry.id);
      const nextBlueprints = existing
        ? blueprints.map((e) => (e.id === entry.id ? entry : e))
        : [entry, ...blueprints];
      commitState(nextBlueprints, instances, null, DEFAULT_FORM_STATE);
      return [];
    },
    [blueprints, instances, commitState],
  );

  const addInstance = useCallback(
    (entry: SubjectEntry): ConflictInfo[] => {
      const nextInstances = [entry, ...instances];
      commitState(blueprints, nextInstances, null, DEFAULT_FORM_STATE);
      return detectConflicts(entry, nextInstances);
    },
    [blueprints, instances, commitState, detectConflicts],
  );

  const updateInstance = useCallback(
    (entry: SubjectEntry, editedScheduleId?: string): ConflictInfo[] => {
      let nextInstances = instances.map((e) => (e.id === entry.id ? entry : e));

      const links = new Map<string, string>();
      for (const d of dynamicData) {
        if (d.dataType === 'link') {
          links.set(d.value, d.displayAs);
        }
      }

      const connectedSubjectIds = new Set<string>();
      const allConnectedKeys = new Set<string>();
      const editedSchedule = editedScheduleId
        ? entry.schedules.find(s => s.id === editedScheduleId)
        : null;

      for (const s of entry.schedules) {
        if (editedScheduleId && s.id !== editedScheduleId) continue;
        const key = `${entry.id}:${s.id}`;
        const connected = getConnectedKeys(key, links);
        for (const ck of connected) {
          allConnectedKeys.add(ck);
          const [subjId] = ck.split(':');
          connectedSubjectIds.add(subjId);
        }
      }

      if (allConnectedKeys.size > 1) {
        nextInstances = nextInstances.map((e) => {
          if (!connectedSubjectIds.has(e.id)) return e;
          if (e.id === entry.id) return e;

          let schedulesChanged = false;
          const updatedSchedules = e.schedules.map((s) => {
            const sk = `${e.id}:${s.id}`;
          if (editedSchedule && allConnectedKeys.has(sk)) {
            if (editedSchedule.assignedTeacherName !== s.assignedTeacherName) {
              schedulesChanged = true;
            }
            return {
              ...s,
              assignedTeacherName: editedSchedule.assignedTeacherName,
            };
          }
            return s;
          });

          return {
            ...e,
            subjectCode: entry.subjectCode,
            offerCode: entry.offerCode,
            subjectDescription: entry.subjectDescription,
            assignedTeacherName: entry.assignedTeacherName,
            department: entry.department,
            program: entry.program,
            year: entry.year,
            section: entry.section,
            color: entry.color,
            ...(schedulesChanged ? { schedules: updatedSchedules } : {}),
          };
        });
      }

      commitState(blueprints, nextInstances, null, DEFAULT_FORM_STATE);
      return detectConflicts(entry, nextInstances);
    },
    [blueprints, instances, commitState, detectConflicts, dynamicData],
  );

  const deleteBlueprint = useCallback(
    (id: string): void => {
      const nextBlueprints = blueprints.filter((e) => e.id !== id);
      const nextEditingEntryId = editingEntryId === id ? null : editingEntryId;
      const nextFormState = editingEntryId === id ? DEFAULT_FORM_STATE : formState;
      commitState(nextBlueprints, instances, nextEditingEntryId, nextFormState);
    },
    [blueprints, instances, editingEntryId, formState, commitState],
  );

  const deleteInstance = useCallback(
    (id: string): void => {
      const nextInstances = instances.filter((e) => e.id !== id);
      const nextEditingEntryId = editingEntryId === id ? null : editingEntryId;
      const nextFormState = editingEntryId === id ? DEFAULT_FORM_STATE : formState;

      const linksToRemove = dynamicData.filter(
        (d) => d.dataType === 'link' && (d.value.startsWith(`${id}:`) || d.displayAs.startsWith(`${id}:`))
      );
      for (const link of linksToRemove) {
        deleteDynamicData(link.id);
      }

      commitState(blueprints, nextInstances, nextEditingEntryId, nextFormState);
    },
    [blueprints, instances, editingEntryId, formState, commitState, dynamicData, deleteDynamicData],
  );

  const exportEntries = useCallback((): string => {
    return JSON.stringify(instances, null, 2);
  }, [instances]);

  const importEntries = useCallback(
    (jsonString: string): { success: boolean; error?: string } => {
      try {
        const parsed = JSON.parse(jsonString);
        if (!Array.isArray(parsed)) {
          return { success: false, error: 'JSON root must be an array of timetable entries.' };
        }
        for (const item of parsed) {
          if (
            typeof item !== 'object' || item === null || !item.id || !item.subjectCode || !Array.isArray(item.schedules)
          ) {
            return { success: false, error: 'Invalid structure. Entries must contain id, subjectCode, and schedules.' };
          }
        }
        persistState(blueprints, parsed as SubjectEntry[]);
        return { success: true };
      } catch (e: unknown) {
        return { success: false, error: e instanceof Error ? e.message : 'Invalid JSON format.' };
      }
    },
    [blueprints, persistState],
  );

  const mergeEntries = useCallback(
    (imported: SubjectEntry[]): { successCount: number; skippedCount: number; totalImported: number } => {
      const currentInstances = [...instances];
      let successCount = 0;
      let skippedCount = 0;
      const totalImported = imported.length;

      for (const entry of imported) {
        const existingMatchIndex = currentInstances.findIndex(
          (e) =>
            e.subjectCode.trim().toLowerCase() === entry.subjectCode.trim().toLowerCase() &&
            e.offerCode.trim().toLowerCase() === entry.offerCode.trim().toLowerCase() &&
            e.subjectDescription.trim().toLowerCase() === entry.subjectDescription.trim().toLowerCase()
        );

        if (existingMatchIndex !== -1) {
          const existingMatch = currentInstances[existingMatchIndex];
          const allSchedulesDuplicate = entry.schedules.every((impSched) =>
            existingMatch.schedules.some(
              (s) =>
                s.startTime === impSched.startTime &&
                s.endTime === impSched.endTime &&
                s.days.length === impSched.days.length &&
                s.days.every((d) => impSched.days.includes(d))
            )
          );
          const metaMatch =
            existingMatch.assignedTeacherName === entry.assignedTeacherName &&
            existingMatch.room === entry.room &&
            existingMatch.program === entry.program &&
            existingMatch.year === entry.year &&
            existingMatch.section === entry.section;

          if (allSchedulesDuplicate && metaMatch) {
            skippedCount++;
            continue;
          }

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

          currentInstances[existingMatchIndex] = {
            ...existingMatch,
            assignedTeacherName: entry.assignedTeacherName || existingMatch.assignedTeacherName,
            room: entry.room || existingMatch.room,
            color: entry.color !== undefined ? entry.color : existingMatch.color,
            schedules: mergedSchedules,
          };
          successCount++;
        } else {
          currentInstances.push({
            ...entry,
            id: entry.id || Math.random().toString(36).slice(2) + Date.now().toString(36),
          });
          successCount++;
        }
      }

      persistState(blueprints, currentInstances);
      return { successCount, skippedCount, totalImported };
    },
    [blueprints, instances, persistState]
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
      ...blueprints.map((b) => ({
        ...b,
        schedules: [],
      })),
      ...importedSuggestions.map((s, idx) => ({
        id: `imported-${idx}`,
        subjectCode: s.subjectCode,
        offerCode: s.offerCode,
        subjectDescription: s.subjectDescription,
        assignedTeacherName: s.assignedTeacherName,
        room: s.room,
        schedules: [],
        program: s.program || '',
        year: s.year || 1,
        section: s.section || '',
        department: '',
      }))
    ];
    return {
      assignedTeacherNames: (() => {
        const seen = new Set<string>();
        for (const entry of [...blueprints, ...instances]) {
          const mainVal = (entry.assignedTeacherName || '').trim();
          if (mainVal) seen.add(mainVal);
          for (const s of entry.schedules || []) {
            const schedVal = (s.assignedTeacherName || '').trim();
            if (schedVal) seen.add(schedVal);
          }
        }
        return Array.from(seen).sort();
      })(),
      subjectCodes: uniqueValues(combinedEntries, (e) => e.subjectCode),
      offerCodes: uniqueValues(combinedEntries, (e) => e.offerCode),
      rooms: (() => {
        const seen = new Set<string>();
        for (const entry of [...blueprints, ...instances]) {
          const val = entry.room || '';
          if (val) {
            val.split(',').forEach((r) => {
              const trimmed = r.trim();
              if (trimmed) seen.add(trimmed);
            });
          }
          for (const s of entry.schedules || []) {
            if (s.rooms) {
              s.rooms.forEach((r) => {
                const trimmed = r.trim();
                if (trimmed) seen.add(trimmed);
              });
            }
          }
        }
        return Array.from(seen).sort();
      })(),
      subjectDescriptions: uniqueValues(combinedEntries, (e) => e.subjectDescription),
    };
  }, [blueprints, instances, importedSuggestions]);

  const startEdit = useCallback(
    (id: string): void => {
      const entry = blueprints.find((e) => e.id === id);
      if (!entry) return;

      const newFormState: FormState = {
        subjectCode: entry.subjectCode,
        offerCode: entry.offerCode,
        subjectDescription: entry.subjectDescription,
        room: [],
        colorRandom: !entry.color,
        color: entry.color || '#2B4C7E',
        schedules: [],
        program: entry.program || '',
        year: entry.year ? String(entry.year) : '1',
        section: entry.section || '',
        department: entry.department || '',
      };

      setEditingEntryIdState(id);
      setFormStateState(newFormState);
    },
    [blueprints]
  );

  const cancelEdit = useCallback((): void => {
    setEditingEntryIdState(null);
    setFormStateState(DEFAULT_FORM_STATE);
  }, []);

  const updateFormState = useCallback(
    (newFormState: FormState): void => {
      setFormStateState(newFormState);
    },
    []
  );

  const syncDynamicData = useCallback(async (data: DynamicData[]): Promise<void> => {
    const db = await getDb();
    await db.execute('DELETE FROM dynamic_data WHERE timetable_id = $1', [timetableId]);
    for (const d of data) {
      await db.execute(
        'INSERT INTO dynamic_data (id, data_type, value, display_as, timetable_id) VALUES ($1, $2, $3, $4, $5)',
        [d.id, d.dataType, d.value, d.displayAs, timetableId]
      );
    }
  }, [timetableId]);

  const undo = useCallback((): void => {
    if (historyIndexRef.current > 0) {
      const oldState = historyRef.current[historyIndexRef.current];
      historyIndexRef.current -= 1;
      const newState = historyRef.current[historyIndexRef.current];
      commitState(newState.blueprints, newState.instances, newState.editingEntryId, newState.formState, true);
      setDynamicData(newState.dynamicData);
      void syncDynamicData(newState.dynamicData);
      updateHistoryState();

      window.dispatchEvent(
        new CustomEvent('timetable:history-focus', {
          detail: { oldState, newState },
        })
      );
    }
  }, [commitState, syncDynamicData, updateHistoryState]);

  const redo = useCallback((): void => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      const oldState = historyRef.current[historyIndexRef.current];
      historyIndexRef.current += 1;
      const newState = historyRef.current[historyIndexRef.current];
      commitState(newState.blueprints, newState.instances, newState.editingEntryId, newState.formState, true);
      setDynamicData(newState.dynamicData);
      void syncDynamicData(newState.dynamicData);
      updateHistoryState();

      window.dispatchEvent(
        new CustomEvent('timetable:history-focus', {
          detail: { oldState, newState },
        })
      );
    }
  }, [commitState, syncDynamicData, updateHistoryState]);

  return {
    blueprints,
    instances,
    hiddenDays,
    isLoading,
    filePath,
    updateFilePath,
    addBlueprint,
    addInstance,
    updateInstance,
    deleteBlueprint,
    deleteInstance,
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
    updateDynamicData,
  };
}
