import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Database from '@tauri-apps/plugin-sql';
import type { SubjectEntry, ConflictInfo, DayOfWeek, FormState, DynamicData, CollabAction, CollabState } from '../types';
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
  addInstances: (entries: SubjectEntry[]) => ConflictInfo[][];
  updateInstance: (entry: SubjectEntry, editedScheduleId?: string) => ConflictInfo[];
  deleteBlueprint: (id: string) => void;
  deleteBlueprints: (ids: string[]) => void;
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
  columnWidths: Record<string, number>;
  rowHeights: Record<number, number>;
  globalColWidth: number;
  globalRowHeight: number;
  verticalAlignment: 'top' | 'middle' | 'bottom';
  horizontalAlignment: 'left' | 'center' | 'right';
  commitCellSizes: (newColumnWidths: Record<string, number>, newRowHeights: Record<number, number>) => void;
  applyGlobalCellSizing: (width: number, height: number) => void;
  commitState: (
    newBlueprints: SubjectEntry[],
    newInstances: SubjectEntry[],
    newEditingEntryId: string | null,
    newFormState: FormState,
    isUndoRedoOperation?: boolean,
    newHiddenDays?: DayOfWeek[],
    newColumnWidths?: Record<string, number>,
    newRowHeights?: Record<number, number>,
    newGlobalColWidth?: number,
    newGlobalRowHeight?: number,
    newVerticalAlignment?: 'top' | 'middle' | 'bottom',
    newHorizontalAlignment?: 'left' | 'center' | 'right',
    source?: 'local' | 'remote'
  ) => void;
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
  addLinksBatched: (links: Array<{ childKey: string; parentKey: string }>) => Promise<void>;
  deleteDynamicData: (id: string) => Promise<void>;
  updateDynamicData: (id: string, dataType: string, value: string, displayAs: string) => Promise<void>;
  isDirty: boolean;
  markSaved: () => void;
  addBlueprints: (entries: SubjectEntry[]) => void;
  addBlueprintsAndInstances: (blueprints: SubjectEntry[], instances: SubjectEntry[]) => void;
  mergeBlueprints: (entries: SubjectEntry[]) => { addedCount: number; updatedCount: number; skippedCount: number };
  mergeDynamicData: (entries: DynamicData[]) => { addedCount: number; skippedCount: number };

  // Collaboration / Queue integration
  applyRemoteAction: (action: CollabAction) => void;
  getFullState: () => CollabState;
  applyFullState: (state: CollabState) => void;
  _persistStateToDb: () => Promise<void>;
  setEnqueueCommit: (fn: (action: CollabAction, description: string) => void) => void;
}

export type { TimetableStore as TimetableStoreType };

interface HistorySnapshot {
  blueprints: SubjectEntry[];
  instances: SubjectEntry[];
  editingEntryId: string | null;
  formState: FormState;
  dynamicData: DynamicData[];
  columnWidths: Record<string, number>;
  rowHeights: Record<number, number>;
  globalColWidth: number;
  globalRowHeight: number;
  verticalAlignment: 'top' | 'middle' | 'bottom';
  horizontalAlignment: 'left' | 'center' | 'right';
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
  const [isDirty, setIsDirty] = useState(false);
  const setIsDirtyAndDispatch = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
    window.dispatchEvent(new CustomEvent('store:dirty-change', { detail: { isDirty: dirty } }));
  }, []);

  const [columnWidths, setColumnWidthsState] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('timetable_column_widths');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const columnWidthsRef = useRef(columnWidths);
  columnWidthsRef.current = columnWidths;

  const [rowHeights, setRowHeightsState] = useState<Record<number, number>>(() => {
    try {
      const saved = localStorage.getItem('timetable_row_heights');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const rowHeightsRef = useRef(rowHeights);
  rowHeightsRef.current = rowHeights;

  const [globalColWidth, setGlobalColWidthState] = useState<number>(() => {
    const saved = localStorage.getItem('timetable_global_col_width');
    return saved ? parseInt(saved, 10) : 130;
  });
  const globalColWidthRef = useRef(globalColWidth);
  globalColWidthRef.current = globalColWidth;

  const [globalRowHeight, setGlobalRowHeightState] = useState<number>(() => {
    const saved = localStorage.getItem('timetable_global_row_height');
    return saved ? parseInt(saved, 10) : 36;
  });
  const globalRowHeightRef = useRef(globalRowHeight);
  globalRowHeightRef.current = globalRowHeight;

  const [verticalAlignment, setVerticalAlignmentState] = useState<'top' | 'middle' | 'bottom'>(() => {
    const saved = localStorage.getItem('timetable_vertical_alignment');
    return (saved as 'top' | 'middle' | 'bottom') ?? 'middle';
  });
  const verticalAlignmentRef = useRef(verticalAlignment);
  verticalAlignmentRef.current = verticalAlignment;

  const [horizontalAlignment, setHorizontalAlignmentState] = useState<'left' | 'center' | 'right'>(() => {
    const saved = localStorage.getItem('timetable_horizontal_alignment');
    return (saved as 'left' | 'center' | 'right') ?? 'center';
  });
  const horizontalAlignmentRef = useRef(horizontalAlignment);
  horizontalAlignmentRef.current = horizontalAlignment;

  // Refs for queue/collab persistence (always-current snapshots)
  const blueprintsRef = useRef(blueprints);
  blueprintsRef.current = blueprints;
  const instancesRef = useRef(instances);
  instancesRef.current = instances;
  const hiddenDaysRef = useRef(hiddenDays);
  hiddenDaysRef.current = hiddenDays;
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const bandedRowsRef = useRef(bandedRows);
  bandedRowsRef.current = bandedRows;
  const filePathRef = useRef(filePath);
  filePathRef.current = filePath;
  const dynamicDataRef = useRef(dynamicData);
  dynamicDataRef.current = dynamicData;

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

  const isDuplicateRoom = useCallback((value: string, displayAs: string, excludeId: string | null): boolean => {
    const building = displayAs.split('|')[1] || '';
    return dynamicData.some(
      (d) =>
        d.dataType === 'room' &&
        d.id !== excludeId &&
        d.value?.trim().toLowerCase() === value.trim().toLowerCase() &&
        (d.displayAs.split('|')[1] || '').trim().toLowerCase() === building.trim().toLowerCase()
    );
  }, [dynamicData]);

  const addDynamicData = useCallback(async (dataType: string, value: string, displayAs: string, _source: 'local' | 'remote' = 'local') => {
    if (dataType === 'room' && isDuplicateRoom(value, displayAs, null)) {
      const building = displayAs.split('|')[1] || '';
      throw new Error(`Room "${value}" already exists in building "${building || '(none)'}".`);
    }
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const db = await getDb();
    await db.execute(
      'INSERT INTO dynamic_data (id, data_type, value, display_as, timetable_id) VALUES ($1, $2, $3, $4, $5)',
      [id, dataType, value, displayAs, timetableId]
    );
    setDynamicData((prev) => [...prev, { id, dataType, value, displayAs }]);
    setIsDirtyAndDispatch(true);
  }, [timetableId, isDuplicateRoom, setIsDirtyAndDispatch]);

  const addLinksBatched = useCallback(async (links: Array<{ childKey: string; parentKey: string }>, _source: 'local' | 'remote' = 'local') => {
    if (links.length === 0) return;
    const db = await getDb();
    const values: string[] = [];
    const params: unknown[] = [];
    links.forEach(({ childKey, parentKey }, i) => {
      const id = Math.random().toString(36).slice(2) + Date.now().toString(36) + i;
      const offset = i * 5;
      values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
      params.push(id, 'link', childKey, parentKey, timetableId);
    });
    await db.execute(
      `INSERT INTO dynamic_data (id, data_type, value, display_as, timetable_id) VALUES ${values.join(', ')}`,
      params,
    );
    const newRows = links.map(({ childKey, parentKey }, i) => ({
      id: Math.random().toString(36).slice(2) + Date.now().toString(36) + i,
      dataType: 'link' as const,
      value: childKey,
      displayAs: parentKey,
    }));
    setDynamicData((prev) => [...prev, ...newRows]);
    setIsDirtyAndDispatch(true);
  }, [timetableId, setIsDirtyAndDispatch]);

  const deleteDynamicData = useCallback(async (id: string, _source: 'local' | 'remote' = 'local') => {
    const db = await getDb();
    await db.execute('DELETE FROM dynamic_data WHERE id = $1', [id]);
    setDynamicData((prev) => prev.filter((item) => item.id !== id));
    setIsDirtyAndDispatch(true);
  }, [setIsDirtyAndDispatch]);

  const updateDynamicData = useCallback(async (id: string, dataType: string, value: string, displayAs: string, _source: 'local' | 'remote' = 'local') => {
    if (dataType === 'room' && isDuplicateRoom(value, displayAs, id)) {
      const building = displayAs.split('|')[1] || '';
      throw new Error(`Room "${value}" already exists in building "${building || '(none)'}".`);
    }
    const db = await getDb();
    await db.execute(
      'UPDATE dynamic_data SET data_type = $2, value = $3, display_as = $4 WHERE id = $1',
      [id, dataType, value, displayAs]
    );
    setDynamicData((prev) =>
      prev.map((item) => (item.id === id ? { id, dataType, value, displayAs } : item))
    );
    setIsDirtyAndDispatch(true);
  }, [isDuplicateRoom, setIsDirtyAndDispatch]);

  const markSaved = useCallback(() => {
    setIsDirtyAndDispatch(false);
  }, [setIsDirtyAndDispatch]);

  // ── Queue / Collaboration integration ──

  const enqueueCommitRef = useRef<(action: CollabAction, description: string) => void>(undefined);

  const setEnqueueCommit = useCallback((fn: (action: CollabAction, description: string) => void) => {
    enqueueCommitRef.current = fn;
  }, []);

  const _persistStateToDb = useCallback(async () => {
    const combinedJson = JSON.stringify({ blueprints: blueprintsRef.current, instances: instancesRef.current });
    const hiddenDaysJson = JSON.stringify(hiddenDaysRef.current);
    const now = new Date().toISOString();
    const totalCount = blueprintsRef.current.length + instancesRef.current.length;
    try {
      const db = await getDb();
      await db.execute(
        'UPDATE timetables SET entries_json = $1, entry_count = $2, updated_at = $3, hidden_days = $4 WHERE id = $5',
        [combinedJson, totalCount, now, hiddenDaysJson, timetableId],
      );
    } catch (e: unknown) {
      console.error('Failed to persist state to DB:', e);
    }
  }, [timetableId]);

  const getFullState = useCallback((): CollabState => {
    return {
      blueprints: blueprintsRef.current,
      instances: instancesRef.current,
      dynamicData: dynamicDataRef.current,
      hiddenDays: hiddenDaysRef.current,
      theme: themeRef.current,
      bandedRows: bandedRowsRef.current,
      filePath: filePathRef.current,
    };
  }, []);

  const applyFullState = useCallback((state: CollabState) => {
    setBlueprints(state.blueprints);
    setInstances(state.instances);
    setDynamicData(state.dynamicData);
    setHiddenDaysState(state.hiddenDays);
    setThemeState(state.theme);
    setBandedRowsState(state.bandedRows);
    setFilePathState(state.filePath);

    const combinedJson = JSON.stringify({ blueprints: state.blueprints, instances: state.instances });
    lastSavedJsonRef.current = combinedJson;
    lastSavedHiddenDaysRef.current = JSON.stringify(state.hiddenDays);
  }, []);

  const applyRemoteAction = useCallback((action: CollabAction) => {
    // Route remote actions to the appropriate store method with source='remote'
    switch (action.op) {
      case 'addBlueprint':
        addBlueprint(action.payload.entry as SubjectEntry, 'remote');
        break;
      case 'addInstance':
        addInstance(action.payload.entry as SubjectEntry, 'remote');
        break;
      case 'addInstances':
        addInstances(action.payload.entries as SubjectEntry[], 'remote');
        break;
      case 'updateInstance':
        updateInstance(action.payload.entry as SubjectEntry, action.payload.editedScheduleId as string | undefined, 'remote');
        break;
      case 'deleteBlueprint':
        deleteBlueprint(action.payload.id as string, 'remote');
        break;
      case 'deleteBlueprints':
        deleteBlueprints(action.payload.ids as string[], 'remote');
        break;
      case 'deleteInstance':
        deleteInstance(action.payload.id as string, 'remote');
        break;
      case 'setHiddenDays':
        setHiddenDays(action.payload.days as DayOfWeek[], 'remote');
        break;
      case 'addDynamicData':
        addDynamicData(action.payload.dataType as string, action.payload.value as string, action.payload.displayAs as string, 'remote');
        break;
      case 'deleteDynamicData':
        deleteDynamicData(action.payload.id as string, 'remote');
        break;
      case 'updateDynamicData':
        updateDynamicData(action.payload.id as string, action.payload.dataType as string, action.payload.value as string, action.payload.displayAs as string, 'remote');
        break;
      case 'addBlueprints':
        addBlueprints(action.payload.entries as SubjectEntry[], 'remote');
        break;
      case 'addBlueprintsAndInstances':
        addBlueprintsAndInstances(action.payload.blueprints as SubjectEntry[], action.payload.instances as SubjectEntry[], 'remote');
        break;
    }
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
            columnWidths: columnWidthsRef.current,
            rowHeights: rowHeightsRef.current,
            globalColWidth: globalColWidthRef.current,
            globalRowHeight: globalRowHeightRef.current,
            verticalAlignment: verticalAlignmentRef.current,
            horizontalAlignment: horizontalAlignmentRef.current,
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
            columnWidths: columnWidthsRef.current,
            rowHeights: rowHeightsRef.current,
            globalColWidth: globalColWidthRef.current,
            globalRowHeight: globalRowHeightRef.current,
            verticalAlignment: verticalAlignmentRef.current,
            horizontalAlignment: horizontalAlignmentRef.current,
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
      newHiddenDays = hiddenDays,
      newColumnWidths: Record<string, number> = columnWidthsRef.current,
      newRowHeights: Record<number, number> = rowHeightsRef.current,
      newGlobalColWidth: number = globalColWidthRef.current,
      newGlobalRowHeight: number = globalRowHeightRef.current,
      newVerticalAlignment: 'top' | 'middle' | 'bottom' = verticalAlignmentRef.current,
      newHorizontalAlignment: 'left' | 'center' | 'right' = horizontalAlignmentRef.current,
      source: 'local' | 'remote' = 'local'
    ): void => {
      setBlueprints(newBlueprints);
      setInstances(newInstances);
      setEditingEntryIdState(newEditingEntryId);
      setFormStateState(newFormState);
      setHiddenDaysState(newHiddenDays);
      setColumnWidthsState(newColumnWidths);
      setRowHeightsState(newRowHeights);
      setGlobalColWidthState(newGlobalColWidth);
      setGlobalRowHeightState(newGlobalRowHeight);
      setVerticalAlignmentState(newVerticalAlignment);
      setHorizontalAlignmentState(newHorizontalAlignment);

      localStorage.setItem('timetable_column_widths', JSON.stringify(newColumnWidths));
      localStorage.setItem('timetable_row_heights', JSON.stringify(newRowHeights));
      localStorage.setItem('timetable_global_col_width', String(newGlobalColWidth));
      localStorage.setItem('timetable_global_row_height', String(newGlobalRowHeight));
      localStorage.setItem('timetable_vertical_alignment', newVerticalAlignment);
      localStorage.setItem('timetable_horizontal_alignment', newHorizontalAlignment);

      setIsDirtyAndDispatch(true);

      if (!isUndoRedoOperation && source === 'local') {
        const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
        newHistory.push({
          blueprints: newBlueprints,
          instances: newInstances,
          editingEntryId: newEditingEntryId,
          formState: newFormState,
          dynamicData,
          columnWidths: newColumnWidths,
          rowHeights: newRowHeights,
          globalColWidth: newGlobalColWidth,
          globalRowHeight: newGlobalRowHeight,
          verticalAlignment: newVerticalAlignment,
          horizontalAlignment: newHorizontalAlignment,
        });
        historyRef.current = newHistory;
        historyIndexRef.current = newHistory.length - 1;
        updateHistoryState();
      }

      const combinedJson = JSON.stringify({ blueprints: newBlueprints, instances: newInstances });
      const hiddenDaysJson = JSON.stringify(newHiddenDays);

      if (combinedJson !== lastSavedJsonRef.current || hiddenDaysJson !== lastSavedHiddenDaysRef.current) {
        lastSavedJsonRef.current = combinedJson;
        lastSavedHiddenDaysRef.current = hiddenDaysJson;
      }
    },
    [timetableId, hiddenDays, updateHistoryState, dynamicData, setIsDirtyAndDispatch]
  );

  const addBlueprints = useCallback((entries: SubjectEntry[], source: 'local' | 'remote' = 'local'): void => {
    const nextBlueprints = [...entries, ...blueprints];
    commitState(nextBlueprints, instances, null, DEFAULT_FORM_STATE, false, hiddenDays, undefined, undefined, undefined, undefined, undefined, undefined, source);
    if (source === 'local' && enqueueCommitRef.current) {
      enqueueCommitRef.current({ op: 'addBlueprints', payload: { entries } }, `Added ${entries.length} blueprint(s)`);
    }
  }, [blueprints, instances, commitState, hiddenDays]);

  const addBlueprintsAndInstances = useCallback((newBps: SubjectEntry[], newInsts: SubjectEntry[], source: 'local' | 'remote' = 'local'): void => {
    const nextBlueprints = [...newBps, ...blueprints];
    const nextInstances = [...newInsts, ...instances];
    commitState(nextBlueprints, nextInstances, null, DEFAULT_FORM_STATE, false, hiddenDays, undefined, undefined, undefined, undefined, undefined, undefined, source);
    if (source === 'local' && enqueueCommitRef.current) {
      const count = newBps.length + newInsts.length;
      enqueueCommitRef.current({ op: 'addBlueprintsAndInstances', payload: { blueprints: newBps, instances: newInsts } }, `Added ${count} entry(ies)`);
    }
  }, [blueprints, instances, commitState, hiddenDays]);

  const persistState = useCallback(
    (newBlueprints: SubjectEntry[], newInstances: SubjectEntry[], isUndoRedoOperation = false, source: 'local' | 'remote' = 'local'): void => {
      commitState(newBlueprints, newInstances, editingEntryId, formState, isUndoRedoOperation, hiddenDays, undefined, undefined, undefined, undefined, undefined, undefined, source);
    },
    [commitState, editingEntryId, formState, hiddenDays],
  );

  const setHiddenDays = useCallback(
    (_days: DayOfWeek[], source: 'local' | 'remote' = 'local'): void => {
      commitState(blueprints, instances, editingEntryId, formState, false, _days, undefined, undefined, undefined, undefined, undefined, undefined, source);
      if (source === 'local' && enqueueCommitRef.current) {
        enqueueCommitRef.current({ op: 'setHiddenDays', payload: { days: _days } }, `Updated hidden days`);
      }
    },
    [blueprints, instances, editingEntryId, formState, commitState],
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
    (entry: SubjectEntry, source: 'local' | 'remote' = 'local'): ConflictInfo[] => {
      const existing = blueprints.find((e) => e.id === entry.id);
      const nextBlueprints = existing
        ? blueprints.map((e) => (e.id === entry.id ? entry : e))
        : [entry, ...blueprints];
      commitState(nextBlueprints, instances, null, DEFAULT_FORM_STATE, false, hiddenDays, undefined, undefined, undefined, undefined, undefined, undefined, source);
      if (source === 'local' && enqueueCommitRef.current) {
        enqueueCommitRef.current({ op: 'addBlueprint', payload: { entry } }, `Added blueprint ${entry.subjectCode}`);
      }
      return [];
    },
    [blueprints, instances, commitState, hiddenDays],
  );

  const addInstance = useCallback(
    (entry: SubjectEntry, source: 'local' | 'remote' = 'local'): ConflictInfo[] => {
      const nextInstances = [entry, ...instances];
      commitState(blueprints, nextInstances, null, DEFAULT_FORM_STATE, false, hiddenDays, undefined, undefined, undefined, undefined, undefined, undefined, source);
      if (source === 'local' && enqueueCommitRef.current) {
        enqueueCommitRef.current({ op: 'addInstance', payload: { entry } }, `Added instance ${entry.subjectCode}`);
      }
      return detectConflicts(entry, nextInstances);
    },
    [blueprints, instances, commitState, detectConflicts, hiddenDays],
  );

  const addInstances = useCallback(
    (entries: SubjectEntry[], source: 'local' | 'remote' = 'local'): ConflictInfo[][] => {
      const nextInstances = [...entries, ...instances];
      commitState(blueprints, nextInstances, null, DEFAULT_FORM_STATE, false, hiddenDays, undefined, undefined, undefined, undefined, undefined, undefined, source);
      if (source === 'local' && enqueueCommitRef.current) {
        enqueueCommitRef.current({ op: 'addInstances', payload: { entries } }, `Added ${entries.length} instance(s)`);
      }
      return entries.map((entry) => detectConflicts(entry, nextInstances));
    },
    [blueprints, instances, commitState, detectConflicts, hiddenDays],
  );

  const updateInstance = useCallback(
    (entry: SubjectEntry, editedScheduleId?: string, source: 'local' | 'remote' = 'local'): ConflictInfo[] => {
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

      commitState(blueprints, nextInstances, null, DEFAULT_FORM_STATE, false, hiddenDays, undefined, undefined, undefined, undefined, undefined, undefined, source);
      if (source === 'local' && enqueueCommitRef.current) {
        enqueueCommitRef.current({ op: 'updateInstance', payload: { entry, editedScheduleId } }, `Updated instance ${entry.subjectCode}`);
      }
      return detectConflicts(entry, nextInstances);
    },
    [blueprints, instances, commitState, detectConflicts, dynamicData, hiddenDays],
  );

  const deleteBlueprint = useCallback(
    (id: string, source: 'local' | 'remote' = 'local'): void => {
      const nextBlueprints = blueprints.filter((e) => e.id !== id);
      const nextInstances = instances.filter((e) => e.blueprintId !== id);
      const nextEditingEntryId = editingEntryId === id ? null : editingEntryId;
      const nextFormState = editingEntryId === id ? DEFAULT_FORM_STATE : formState;

      const deletedInstanceIds = new Set(
        instances.filter((e) => e.blueprintId === id).map((e) => e.id)
      );
      const linksToRemove = dynamicData.filter(
        (d) => d.dataType === 'link' && (
          deletedInstanceIds.has(d.value.split(':')[0]) || 
          deletedInstanceIds.has(d.displayAs.split(':')[0])
        )
      );
      for (const link of linksToRemove) {
        void deleteDynamicData(link.id);
      }

      commitState(nextBlueprints, nextInstances, nextEditingEntryId, nextFormState, false, hiddenDays, undefined, undefined, undefined, undefined, undefined, undefined, source);
      if (source === 'local' && enqueueCommitRef.current) {
        const entry = blueprints.find((e) => e.id === id);
        enqueueCommitRef.current({ op: 'deleteBlueprint', payload: { id } }, `Deleted blueprint ${entry?.subjectCode || id}`);
      }
    },
    [blueprints, instances, editingEntryId, formState, commitState, dynamicData, deleteDynamicData, hiddenDays],
  );

  const deleteBlueprints = useCallback(
    (ids: string[], source: 'local' | 'remote' = 'local'): void => {
      const idsSet = new Set(ids);
      const nextBlueprints = blueprints.filter((e) => !idsSet.has(e.id));
      const nextInstances = instances.filter((e) => !e.blueprintId || !idsSet.has(e.blueprintId));
      const nextEditingEntryId = idsSet.has(editingEntryId || '') ? null : editingEntryId;
      const nextFormState = idsSet.has(editingEntryId || '') ? DEFAULT_FORM_STATE : formState;

      const deletedInstanceIds = new Set(
        instances.filter((e) => e.blueprintId && idsSet.has(e.blueprintId)).map((e) => e.id)
      );
      const linksToRemove = dynamicData.filter(
        (d) => d.dataType === 'link' && (
          deletedInstanceIds.has(d.value.split(':')[0]) || 
          deletedInstanceIds.has(d.displayAs.split(':')[0])
        )
      );
      for (const link of linksToRemove) {
        void deleteDynamicData(link.id);
      }

      commitState(nextBlueprints, nextInstances, nextEditingEntryId, nextFormState, false, hiddenDays, undefined, undefined, undefined, undefined, undefined, undefined, source);
      if (source === 'local' && enqueueCommitRef.current) {
        enqueueCommitRef.current({ op: 'deleteBlueprints', payload: { ids } }, `Deleted ${ids.length} blueprint(s)`);
      }
    },
    [blueprints, instances, editingEntryId, formState, commitState, dynamicData, deleteDynamicData, hiddenDays],
  );

  const deleteInstance = useCallback(
    (id: string, source: 'local' | 'remote' = 'local'): void => {
      const nextInstances = instances.filter((e) => e.id !== id);
      const nextEditingEntryId = editingEntryId === id ? null : editingEntryId;
      const nextFormState = editingEntryId === id ? DEFAULT_FORM_STATE : formState;

      const linksToRemove = dynamicData.filter(
        (d) => d.dataType === 'link' && (d.value.startsWith(`${id}:`) || d.displayAs.startsWith(`${id}:`))
      );
      for (const link of linksToRemove) {
        deleteDynamicData(link.id);
      }

      commitState(blueprints, nextInstances, nextEditingEntryId, nextFormState, false, hiddenDays, undefined, undefined, undefined, undefined, undefined, undefined, source);
      if (source === 'local' && enqueueCommitRef.current) {
        const entry = instances.find((e) => e.id === id);
        enqueueCommitRef.current({ op: 'deleteInstance', payload: { id } }, `Deleted instance ${entry?.subjectCode || id}`);
      }
    },
    [blueprints, instances, editingEntryId, formState, commitState, dynamicData, deleteDynamicData, hiddenDays],
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

  const mergeBlueprints = useCallback(
    (imported: SubjectEntry[]): { addedCount: number; updatedCount: number; skippedCount: number } => {
      let addedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      const nextBlueprints = [...blueprints];

      for (const entry of imported) {
        const norm = (s: string) => s.trim().toLowerCase();

        // Check exact match (all properties)
        const exactMatch = nextBlueprints.find(
          (e) =>
            norm(e.subjectCode) === norm(entry.subjectCode) &&
            norm(e.offerCode) === norm(entry.offerCode) &&
            norm(e.subjectDescription) === norm(entry.subjectDescription) &&
            norm(e.program) === norm(entry.program) &&
            e.year === entry.year &&
            norm(e.section) === norm(entry.section)
        );
        if (exactMatch) {
          skippedCount++;
          continue;
        }

        // Check partial match (same subjectCode + offerCode)
        const partialIdx = nextBlueprints.findIndex(
          (e) =>
            norm(e.subjectCode) === norm(entry.subjectCode) &&
            norm(e.offerCode) === norm(entry.offerCode)
        );
        if (partialIdx !== -1) {
          nextBlueprints[partialIdx] = {
            ...entry,
            id: nextBlueprints[partialIdx].id,
          };
          updatedCount++;
          continue;
        }

        // No match — add new
        nextBlueprints.push({
          ...entry,
          id: entry.id || Math.random().toString(36).slice(2) + Date.now().toString(36),
        });
        addedCount++;
      }

      commitState(nextBlueprints, instances, null, DEFAULT_FORM_STATE);
      return { addedCount, updatedCount, skippedCount };
    },
    [blueprints, instances, commitState]
  );

  const mergeDynamicData = useCallback(
    (imported: DynamicData[]): { addedCount: number; skippedCount: number } => {
      let addedCount = 0;
      let skippedCount = 0;
      const newRows: DynamicData[] = [];
      const nextDynamicData = [...dynamicData];

      for (const entry of imported) {
        const norm = (s: string) => s.trim().toLowerCase();
        const exists = nextDynamicData.some(
          (d) => d.dataType === entry.dataType && norm(d.value) === norm(entry.value)
        );
        if (exists) {
          skippedCount++;
          continue;
        }
        const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
        const row: DynamicData = {
          id: entry.id || id,
          dataType: entry.dataType,
          value: entry.value,
          displayAs: entry.displayAs,
        };
        newRows.push(row);
        nextDynamicData.push(row);
        addedCount++;
      }

      if (newRows.length > 0) {
        setDynamicData(nextDynamicData);
        setIsDirtyAndDispatch(true);
      }
      return { addedCount, skippedCount };
    },
    [dynamicData, setIsDirtyAndDispatch]
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
      commitState(
        newState.blueprints,
        newState.instances,
        newState.editingEntryId,
        newState.formState,
        true,
        hiddenDays,
        newState.columnWidths,
        newState.rowHeights,
        newState.globalColWidth,
        newState.globalRowHeight,
        newState.verticalAlignment,
        newState.horizontalAlignment,
        'local'
      );
      setDynamicData(newState.dynamicData);
      void syncDynamicData(newState.dynamicData);
      updateHistoryState();

      window.dispatchEvent(
        new CustomEvent('timetable:history-focus', {
          detail: { oldState, newState },
        })
      );

      // Record undo in commit history
      if (enqueueCommitRef.current) {
        enqueueCommitRef.current(
          { op: 'undo', payload: { oldState, newState } },
          `Undo: reverted to previous state`
        );
      }
    }
  }, [commitState, syncDynamicData, updateHistoryState, hiddenDays]);

  const redo = useCallback((): void => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      const oldState = historyRef.current[historyIndexRef.current];
      historyIndexRef.current += 1;
      const newState = historyRef.current[historyIndexRef.current];
      commitState(
        newState.blueprints,
        newState.instances,
        newState.editingEntryId,
        newState.formState,
        true,
        hiddenDays,
        newState.columnWidths,
        newState.rowHeights,
        newState.globalColWidth,
        newState.globalRowHeight,
        newState.verticalAlignment,
        newState.horizontalAlignment
      );
      setDynamicData(newState.dynamicData);
      void syncDynamicData(newState.dynamicData);
      updateHistoryState();

      window.dispatchEvent(
        new CustomEvent('timetable:history-focus', {
          detail: { oldState, newState },
        })
      );
    }
  }, [commitState, syncDynamicData, updateHistoryState, hiddenDays]);

  const commitCellSizes = useCallback((newColumnWidths: Record<string, number>, newRowHeights: Record<number, number>) => {
    columnWidthsRef.current = newColumnWidths;
    rowHeightsRef.current = newRowHeights;
    commitState(blueprints, instances, editingEntryId, formState, false, hiddenDays, newColumnWidths, newRowHeights);
  }, [blueprints, instances, editingEntryId, formState, hiddenDays, commitState]);

  const applyGlobalCellSizing = useCallback((width: number, height: number) => {
    globalColWidthRef.current = width;
    globalRowHeightRef.current = height;
    columnWidthsRef.current = {};
    rowHeightsRef.current = {};
    commitState(blueprints, instances, editingEntryId, formState, false, hiddenDays, {}, {}, width, height);
  }, [blueprints, instances, editingEntryId, formState, hiddenDays, commitState]);

  return {
    blueprints,
    instances,
    hiddenDays,
    columnWidths,
    rowHeights,
    globalColWidth,
    globalRowHeight,
    verticalAlignment,
    horizontalAlignment,
    commitCellSizes,
    applyGlobalCellSizing,
    isLoading,
    filePath,
    updateFilePath,
    addBlueprint,
    addInstance,
    addInstances,
    updateInstance,
    deleteBlueprint,
    deleteBlueprints,
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
    addLinksBatched,
    deleteDynamicData,
    updateDynamicData,
    isDirty,
    markSaved,
    addBlueprints,
    addBlueprintsAndInstances,
    mergeBlueprints,
    mergeDynamicData,
    commitState,

    // Collaboration / Queue
    applyRemoteAction,
    getFullState,
    applyFullState,
    _persistStateToDb,
    setEnqueueCommit,
  };
}
