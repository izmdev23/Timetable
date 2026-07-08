import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Layout, Typography, Spin, message, Button, Modal, List, Select, Checkbox, ConfigProvider, Popover } from 'antd';
import { DeleteOutlined, CloseCircleFilled, BellFilled } from '@ant-design/icons';
import { useTimetableStore } from '../hooks/useTimetableStore';
import { getThemeConfig } from '../theme';
import { SubjectTable } from '../components/SubjectTable';
import { TimetableGrid } from '../components/TimetableGrid';
import { exportToXlsx } from '../utils/exportXlsx';
import { usePreferences } from '../context/PreferencesContext';
import { save, ask } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import type { SubjectEntry, DayOfWeek, ConflictInfo, FormState } from '../types';

import { RibbonToolbar } from '../components/RibbonToolbar';
import { SchedulesPanel } from '../components/SchedulesPanel';
import { useSubjectSearch } from '../hooks/useSubjectSearch';
import { emit, listen } from '@tauri-apps/api/event';

const { Content } = Layout;
const { Text } = Typography;

interface TimetablePageProps {
  /** SQLite id of the timetable being edited */
  timetableId: string;
  /** Display name of the timetable */
  timetableName: string;
  /** Called when the user navigates back to home */
  onBack: () => void;
  /** Incremented by TitleBar when File > Save As (XLSX) is triggered */
  exportTrigger: number;
  /** Incremented when Ctrl+S / File > Save (JSON) is triggered */
  saveTrigger: number;
  /** Incremented when File > Import & Merge is triggered */
  importMergeTrigger: number;
}

function toMin(time: string): number {
  const parts = time.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function toTime(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, '0');
  const m = (min % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** Helper to filter out schedules on hidden days and/or outside the visible time window */
function filterEntriesForExport(
  entries: SubjectEntry[],
  hiddenDays: DayOfWeek[],
  excludeHiddenDays: boolean,
  viewStart: number,
  viewEnd: number,
  excludeTimeWindow: boolean,
): SubjectEntry[] {
  return entries
    .map((entry) => {
      const schedules = entry.schedules
        .map((sched) => {
          // Filter out hidden days if requested
          const days = excludeHiddenDays
            ? sched.days.filter((d) => !hiddenDays.includes(d))
            : sched.days;

          if (days.length === 0) return null;

          const s = toMin(sched.startTime);
          const e = toMin(sched.endTime);

          // Filter out if no overlap with time window
          if (excludeTimeWindow && (s >= viewEnd || e <= viewStart)) {
            return null;
          }

          // Clamp times to window if excludeTimeWindow is true
          const clampedStart = excludeTimeWindow ? Math.max(s, viewStart) : s;
          const clampedEnd = excludeTimeWindow ? Math.min(e, viewEnd) : e;

          return {
            ...sched,
            days,
            startTime: toTime(clampedStart),
            endTime: toTime(clampedEnd),
          };
        })
        .filter((s): s is Exclude<typeof s, null> => s !== null);

      return {
        ...entry,
        schedules,
      };
    })
    .filter((entry) => entry.schedules.length > 0);
}

/**
 * Full timetable editor page.
 * Loads entries and hidden days from SQLite via the store hook and persists on every mutation.
 */
export function TimetablePage({ timetableId, timetableName, onBack: _onBack, exportTrigger, saveTrigger, importMergeTrigger }: TimetablePageProps) {
  const store = useTimetableStore(timetableId);
  const prefs = usePreferences();
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    const handleUndo = () => store.undo();
    const handleRedo = () => store.redo();
    window.addEventListener('titlebar:undo', handleUndo);
    window.addEventListener('titlebar:redo', handleRedo);
    return () => {
      window.removeEventListener('titlebar:undo', handleUndo);
      window.removeEventListener('titlebar:redo', handleRedo);
    };
  }, [store]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('store:history-change', {
      detail: { canUndo: store.canUndo, canRedo: store.canRedo }
    }));
  }, [store.canUndo, store.canRedo]);
  const editingEntry = useMemo(
    () => store.entries.find((e) => e.id === store.editingEntryId) || null,
    [store.entries, store.editingEntryId]
  );
  const [suggestionsModalOpen, setSuggestionsModalOpen] = useState(false);

  // Lifted timespan view range state (defaults to 07:00 - 21:00)
  const [viewStart, setViewStart] = useState<number>(7 * 60);
  const [viewEnd, setViewEnd] = useState<number>(21 * 60);

  const lastSaveTriggerRef = useRef(saveTrigger);
  const lastExportTriggerRef = useRef(exportTrigger);
  const lastImportMergeTriggerRef = useRef(importMergeTrigger);

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFilterType, setExportFilterType] = useState<'current' | 'all' | 'room'>('current');
  const [exportSelectedRooms, setExportSelectedRooms] = useState<string[]>([]);
  const [exportExactMatch, setExportExactMatch] = useState(false);

  const [filterType, setFilterType] = useState<'all' | 'student' | 'teacher' | 'room'>('all');
  const [selectedStudentKey, setSelectedStudentKey] = useState<string | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [hiddenEntryIds, setHiddenEntryIds] = useState<string[]>([]);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);

  useEffect(() => {
    if (!activeRoom && store.suggestions.rooms.length > 0) {
      setActiveRoom(store.suggestions.rooms[0]);
    }
  }, [store.suggestions.rooms, activeRoom]);

  const handleSelectedRoomsChange = useCallback((rooms: string[]) => {
    const allAvailableRooms = store.suggestions.rooms;
    const hadAll = selectedRooms.includes('all');
    const hasAll = rooms.includes('all');

    let nextRooms = rooms;
    if (!hadAll && hasAll) {
      nextRooms = ['all'];
    } else if (hadAll && hasAll && rooms.length > 1) {
      nextRooms = rooms.filter((r) => r !== 'all');
    }

    const individualRoomsOnly = nextRooms.filter((r) => r !== 'all');
    const hasAllIndividualRooms = allAvailableRooms.length > 0 &&
      allAvailableRooms.every((r) => individualRoomsOnly.includes(r));

    if (hasAllIndividualRooms) {
      nextRooms = ['all'];
    }

    setSelectedRooms(nextRooms);
  }, [selectedRooms, store.suggestions.rooms]);


  const { query: searchQuery, setQuery: setSearchQuery, results: searchResults } = useSubjectSearch(store.entries);

  const assignedEntryIds = useMemo(() => {
    const set = new Set<string>();
    for (const entry of store.entries) {
      if (entry.schedules.length > 0) {
        set.add(entry.id);
      }
    }
    return set;
  }, [store.entries]);

  const TIME_OPTIONS = useMemo(() => {
    return Array.from({ length: 49 }, (_, i) => {
      const min = i * 30;
      const h = Math.floor(min / 60);
      const m = min % 60;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 === 0 ? 12 : h % 12;
      const displayM = m.toString().padStart(2, '0');
      return { label: `${displayH}:${displayM} ${ampm}`, value: min };
    });
  }, []);

  const handleToggleHideEntry = useCallback((id: string) => {
    setHiddenEntryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const openSubjectFormWindow = useCallback(async () => {
    try {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      let formWin = await WebviewWindow.getByLabel('subject-form');
      if (!formWin) {
        formWin = new WebviewWindow('subject-form', {
          title: store.editingEntryId ? 'Edit Subject Entry' : 'Add Subject Entry',
          url: 'index.html',
          width: 540,
          height: 800,
          minWidth: 500,
          minHeight: 650,
          resizable: true,
          alwaysOnTop: true,
        });

        formWin.listen('tauri://destroyed', () => {
          emit('subject-form:closed');
        });
      } else {
        await formWin.show();
        await formWin.setFocus();
      }
    } catch (e) {
      console.error('Failed to open subject form window', e);
    }
  }, [store.editingEntryId]);

  useEffect(() => {
    if (store.editingEntryId) {
      openSubjectFormWindow();
    }
  }, [store.editingEntryId, openSubjectFormWindow]);



  const studentSchedules = useMemo(() => {
    const keys = new Set<string>();
    const options: { label: string; value: string }[] = [];
    for (const entry of store.entries) {
      if (entry.programShorthand && entry.year && entry.section) {
        const key = `${entry.programShorthand}|${entry.year}|${entry.section}`;
        if (!keys.has(key)) {
          keys.add(key);
          options.push({
            label: `${entry.programShorthand} - Year ${entry.year} - ${entry.section}`,
            value: key,
          });
        }
      }
    }
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [store.entries]);

  const teacherOptions = useMemo(() => {
    const names = new Set<string>();
    const options: { label: string; value: string }[] = [];
    for (const entry of store.entries) {
      if (entry.assignedTeacherName) {
        const name = entry.assignedTeacherName;
        if (!names.has(name)) {
          names.add(name);
          options.push({
            label: name,
            value: name,
          });
        }
      }
    }
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [store.entries]);
  const lastLoadedFilePathRef = useRef<string | null>(null);

  // Load remembered filter settings per JSON file
  useEffect(() => {
    if (!store.filePath || store.isLoading) return;
    if (lastLoadedFilePathRef.current === store.filePath) return;

    lastLoadedFilePathRef.current = store.filePath;
    const key = `filter_config_${store.filePath}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.filterType) setFilterType(parsed.filterType);
        if (parsed.selectedStudentKey) setSelectedStudentKey(parsed.selectedStudentKey);
        if (parsed.selectedTeacher) setSelectedTeacher(parsed.selectedTeacher);
        if (parsed.selectedRooms) setSelectedRooms(parsed.selectedRooms);
      } catch (e) {
        console.error('Failed to parse saved filter config', e);
      }
    }
  }, [store.filePath, store.isLoading]);

  // Save filter settings to localStorage whenever they change
  useEffect(() => {
    if (!store.filePath || store.isLoading) return;
    if (lastLoadedFilePathRef.current !== store.filePath) return;

    const key = `filter_config_${store.filePath}`;
    const config = {
      filterType,
      selectedStudentKey,
      selectedTeacher,
      selectedRooms,
    };
    localStorage.setItem(key, JSON.stringify(config));
  }, [store.filePath, store.isLoading, filterType, selectedStudentKey, selectedTeacher, selectedRooms]);

  // Reset selected keys if they are no longer in the options list
  useEffect(() => {
    if (store.isLoading) return;
    if (selectedStudentKey && !studentSchedules.some((s: { value: string }) => s.value === selectedStudentKey)) {
      setSelectedStudentKey(studentSchedules[0]?.value ?? null);
    }
  }, [studentSchedules, selectedStudentKey, store.isLoading]);

  useEffect(() => {
    if (store.isLoading) return;
    if (selectedTeacher && !teacherOptions.some((t: { value: string }) => t.value === selectedTeacher)) {
      setSelectedTeacher(teacherOptions[0]?.value ?? null);
    }
  }, [teacherOptions, selectedTeacher, store.isLoading]);

  // Set initial selections when filter type changes
  useEffect(() => {
    if (store.isLoading) return;
    if (filterType === 'student' && !selectedStudentKey) {
      setSelectedStudentKey(studentSchedules[0]?.value ?? null);
    } else if (filterType === 'teacher' && !selectedTeacher) {
      setSelectedTeacher(teacherOptions[0]?.value ?? null);
    } else if (filterType === 'room' && selectedRooms.length === 0) {
      setSelectedRooms(['all']);
    }
  }, [filterType, studentSchedules, teacherOptions, selectedStudentKey, selectedTeacher, selectedRooms, store.suggestions.rooms, store.isLoading]);

  const filteredEntries = useMemo(() => {
    if (filterType === 'student' && selectedStudentKey) {
      const [prog, yr, sec] = selectedStudentKey.split('|');
      return store.entries.filter(
        (e) =>
          e.programShorthand === prog &&
          String(e.year) === yr &&
          e.section === sec
      );
    }
    if (filterType === 'teacher' && selectedTeacher) {
      return store.entries.filter((e) => e.assignedTeacherName === selectedTeacher);
    }
    if (filterType === 'room') {
      if (selectedRooms.length === 0 || selectedRooms.includes('all')) {
        return store.entries.filter((e) => e.room);
      }
      return store.entries.filter((e) => {
        if (!e.room) return false;
        const entryRooms = e.room.split(',').map((r) => r.trim().toLowerCase());
        return entryRooms.some((r) => selectedRooms.map((sr) => sr.toLowerCase()).includes(r));
      });
    }
    return store.entries;
  }, [store.entries, filterType, selectedStudentKey, selectedTeacher, selectedRooms]);

  const gridEntries = useMemo(() => {
    if (!activeRoom) return [];
    return filteredEntries
      .map((e) => {
        const roomSchedules = e.schedules.filter((s) =>
          s.rooms && s.rooms.some((r) => r.trim().toLowerCase() === activeRoom.trim().toLowerCase())
        );
        return {
          ...e,
          schedules: roomSchedules,
        };
      })
      .filter((e) => e.schedules.length > 0 && !hiddenEntryIds.includes(e.id));
  }, [filteredEntries, hiddenEntryIds, activeRoom]);

  const currentEntryIds = useMemo(() => {
    return new Set(gridEntries.map((e) => e.id));
  }, [gridEntries]);

  const allConflictsList = useMemo(() => {
    const list: { entry: SubjectEntry; conflict: ConflictInfo }[] = [];
    const seen = new Set<string>();
    for (const entry of gridEntries) {
      const conflicts = store.detectConflicts(entry, gridEntries);
      for (const c of conflicts) {
        const key = [entry.id, c.conflictingEntry.id].sort().join('-');
        if (!seen.has(key)) {
          seen.add(key);
          list.push({ entry, conflict: c });
        }
      }
    }
    return list;
  }, [gridEntries, store.detectConflicts]);

  // Save (Ctrl+S): save or prompt to save
  useEffect(() => {
    if (saveTrigger === 0 || saveTrigger <= lastSaveTriggerRef.current) {
      lastSaveTriggerRef.current = saveTrigger;
      return;
    }
    lastSaveTriggerRef.current = saveTrigger;

    async function handleSave() {
      const entriesToSave = filterEntriesForExport(
        store.entries,
        store.hiddenDays,
        prefs.excludeHiddenDays,
        viewStart,
        viewEnd,
        prefs.excludeTimeWindow,
      );
      const json = JSON.stringify(entriesToSave, null, 2);
      const bytes = Array.from(new TextEncoder().encode(json));

      let path = store.filePath;
      let shouldPrompt = true;

      if (path) {
        try {
          const exists = await invoke<boolean>('file_exists', { path });
          if (exists) {
            shouldPrompt = false;
          }
        } catch {
          shouldPrompt = true;
        }
      }
      if (shouldPrompt) {
        const resolvedPath = await invoke<string>('resolve_default_path', { filename: `${timetableName}.json` });
        const selectedPath = await save({
          title: 'Save Timetable',
          defaultPath: resolvedPath,
          filters: [{ name: 'JSON File', extensions: ['json'] }]
        });

        if (!selectedPath) return; // User cancelled
        path = selectedPath;
      }

      if (path) {
        try {
          await invoke('save_file_bytes', { path, bytes });
          await store.updateFilePath(path);
          messageApi.success(`Saved to ${path.split(/[\\\/]/).pop()}`);
        } catch (e: unknown) {
          messageApi.error(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }

    void handleSave();
  }, [saveTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveAs() {
    if (allConflictsList.length > 0) {
      const confirmExport = await ask(
        'This timetable currently contains scheduling conflicts. Are you sure you want to proceed with the export?',
        {
          title: 'Export Warning',
          kind: 'warning',
          okLabel: 'Export Anyway',
          cancelLabel: 'Cancel',
        }
      );
      if (confirmExport) {
        proceedWithSaveAs();
      }
    } else {
      proceedWithSaveAs();
    }
  }

  async function proceedWithSaveAs() {
    setExportModalOpen(false);
    const resolvedPath = await invoke<string>('resolve_default_path', { filename: `${timetableName}` });
    const selectedPath = await save({
      title: 'Save Timetable As',
      defaultPath: resolvedPath,
      filters: [
        { name: 'Excel Workbook', extensions: ['xlsx'] },
        { name: 'JSON File', extensions: ['json'] }
      ]
    });

    if (!selectedPath) return; // User cancelled

    // Apply the room filter if selected
    let entriesToProcess = store.entries;
    if (exportFilterType === 'current') {
      entriesToProcess = filteredEntries;
    } else if (exportFilterType === 'room' && exportSelectedRooms.length > 0) {
      entriesToProcess = store.entries.filter((e) => {
        if (!e.room) return false;
        const entryRooms = e.room.split(',').map((r) => r.trim().toLowerCase());
        const selectedRoomsLower = exportSelectedRooms.map((sr) => sr.trim().toLowerCase());
        if (exportExactMatch) {
          if (entryRooms.length !== selectedRoomsLower.length) return false;
          return entryRooms.every((r) => selectedRoomsLower.includes(r));
        } else {
          return entryRooms.some((r) => selectedRoomsLower.includes(r));
        }
      });
    }

    if (selectedPath.toLowerCase().endsWith('.xlsx')) {
      try {
        await exportToXlsx(
          entriesToProcess,
          `${timetableName}.xlsx`,
          store.hiddenDays,
          prefs.excludeHiddenDays,
          viewStart,
          viewEnd,
          prefs.excludeTimeWindow,
          selectedPath
        );
        messageApi.success(`Exported Excel to ${selectedPath.split(/[\\\/]/).pop()}`);
      } catch (e: unknown) {
        messageApi.error(`Excel export failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else if (selectedPath.toLowerCase().endsWith('.json')) {
      const entriesToSave = filterEntriesForExport(
        entriesToProcess,
        store.hiddenDays,
        prefs.excludeHiddenDays,
        viewStart,
        viewEnd,
        prefs.excludeTimeWindow,
      );
      const json = JSON.stringify(entriesToSave, null, 2);
      const bytes = Array.from(new TextEncoder().encode(json));

      try {
        await invoke('save_file_bytes', { path: selectedPath, bytes });
        messageApi.success(`Saved JSON to ${selectedPath.split(/[\\\/]/).pop()}`);
      } catch (e: unknown) {
        messageApi.error(`JSON save failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  // Save As (Ctrl+Shift+S): always prompt and save in selected format (XLSX or JSON)
  useEffect(() => {
    if (exportTrigger === 0 || exportTrigger <= lastExportTriggerRef.current) {
      lastExportTriggerRef.current = exportTrigger;
      return;
    }
    lastExportTriggerRef.current = exportTrigger;

    // Reset settings for a clean export prompt
    setExportFilterType('current');
    setExportSelectedRooms([]);
    setExportExactMatch(false);
    setExportModalOpen(true);
  }, [exportTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for Import & Merge action from TitleBar
  useEffect(() => {
    if (importMergeTrigger === 0 || importMergeTrigger <= lastImportMergeTriggerRef.current) {
      lastImportMergeTriggerRef.current = importMergeTrigger;
      return;
    }
    lastImportMergeTriggerRef.current = importMergeTrigger;
    void handleMergeImport();
  }, [importMergeTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFormSubmit = useCallback((entry: SubjectEntry) => {
    if (store.editingEntryId) {
      return store.updateEntry(entry);
    }
    return store.addEntry(entry);
  }, [store]);

  const handleEdit = useCallback((entry: SubjectEntry): void => {
    store.startEdit(entry.id);
  }, [store]);

  const handleCancelEdit = useCallback((): void => {
    store.cancelEdit();
  }, [store]);

  const handleDropEntry = useCallback((entryId: string, day: DayOfWeek, startMin: number, room: string) => {
    const entry = store.entries.find((e) => e.id === entryId);
    if (!entry) return;
    const startStr = toTime(startMin);
    const endStr = toTime(startMin + 60); // default 60 mins duration
    const newSched = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      days: [day],
      startTime: startStr,
      endTime: endStr,
      rooms: [room],
    };

    const newSchedules = [...entry.schedules, newSched];
    const newRooms = Array.from(new Set([
      ...(entry.room ? entry.room.split(',').map((r) => r.trim()).filter(Boolean) : []),
      room
    ])).join(', ');

    store.updateEntry({
      ...entry,
      schedules: newSchedules,
      room: newRooms,
    });
  }, [store]);

  const handleDeleteSchedule = useCallback((entryId: string, scheduleId: string) => {
    const entry = store.entries.find((e) => e.id === entryId);
    if (!entry) return;
    const updatedSchedules = entry.schedules.filter((s) => s.id !== scheduleId);
    const updatedRooms = Array.from(new Set(updatedSchedules.flatMap((s) => s.rooms))).join(', ');
    const updated = {
      ...entry,
      schedules: updatedSchedules,
      room: updatedRooms,
    };
    store.updateEntry(updated);
  }, [store]);

  const handleHighlightSchedule = useCallback((entryId: string, scheduleId: string) => {
    const blockId = `grid-block-${entryId}-${scheduleId}`;
    const el = document.getElementById(blockId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      el.classList.add('highlight-pulse');
      setTimeout(() => el.classList.remove('highlight-pulse'), 1500);
    }
  }, []);

  useEffect(() => {
    const unlistenReady = listen('subject-form:ready', () => {
      emit('subject-form:init', {
        suggestions: store.suggestions,
        entries: store.entries,
        templates: [
          ...store.entries.map((e) => ({
            subjectCode: e.subjectCode,
            offerCode: e.offerCode,
            subjectDescription: e.subjectDescription,
            assignedTeacherName: e.assignedTeacherName,
            room: e.room,
            program: e.program,
            programShorthand: e.programShorthand,
            year: e.year,
            section: e.section,
          })),
          ...store.importedSuggestions.map((s) => ({
            subjectCode: s.subjectCode,
            offerCode: s.offerCode,
            subjectDescription: s.subjectDescription,
            assignedTeacherName: s.assignedTeacherName,
            room: s.room,
            program: s.program,
            programShorthand: s.programShorthand,
            year: s.year,
            section: s.section,
          })),
        ],
        editingEntry: editingEntry,
        formState: store.formState,
        theme: store.theme,
        dynamicData: store.dynamicData,
      });
    });

    const unlistenSubmit = listen<SubjectEntry>('subject-form:submit', (event) => {
      const entry = event.payload;
      const conflicts = handleFormSubmit(entry);
      if (conflicts.length > 0) {
        emit('subject-form:conflict', conflicts);
      } else {
        emit('subject-form:success');
      }
    });

    const unlistenStateChange = listen<FormState>('subject-form:state-change', (event) => {
      store.updateFormState(event.payload);
    });

    const unlistenClosed = listen('subject-form:closed', () => {
      store.cancelEdit();
    });

    return () => {
      unlistenReady.then((fn) => fn());
      unlistenSubmit.then((fn) => fn());
      unlistenStateChange.then((fn) => fn());
      unlistenClosed.then((fn) => fn());
    };
  }, [store.suggestions, store.entries, store.importedSuggestions, editingEntry, store.formState, store.theme, store.dynamicData, handleFormSubmit]);

  // Export suggestions to JSON
  async function handleExportSuggestions() {
    const exportData = store.entries.map((e) => ({
      subjectCode: e.subjectCode,
      offerCode: e.offerCode,
      subjectDescription: e.subjectDescription,
      assignedTeacherName: e.assignedTeacherName,
      room: e.room,
      program: e.program,
      programShorthand: e.programShorthand,
      year: e.year,
      section: e.section,
    }));

    if (exportData.length === 0) {
      messageApi.warning('No subject entries to export for suggestions.');
      return;
    }

    try {
      const resolvedPath = await invoke<string>('resolve_default_path', { filename: `${timetableName}-autocomplete.json` });
      const selectedPath = await save({
        title: 'Export Autocomplete Suggestions',
        defaultPath: resolvedPath,
        filters: [{ name: 'JSON File', extensions: ['json'] }],
      });

      if (!selectedPath) return; // User cancelled

      const json = JSON.stringify(exportData, null, 2);
      const bytes = Array.from(new TextEncoder().encode(json));
      await invoke('save_file_bytes', { path: selectedPath, bytes });
      messageApi.success('Suggestions exported successfully!');
    } catch (e: unknown) {
      messageApi.error(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Import suggestions from JSON
  async function handleImportSuggestions() {
    try {
      const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
      const filePath = await openDialog({
        title: 'Import Autocomplete Suggestions',
        filters: [{ name: 'JSON File', extensions: ['json'] }],
        multiple: false,
        directory: false,
      });

      if (!filePath || typeof filePath !== 'string') return;

      const content = await invoke<string>('read_text_file', { path: filePath });
      const parsed = JSON.parse(content);

      if (!Array.isArray(parsed)) {
        throw new Error('Suggestions file must be a JSON array of template entries.');
      }

      // Validate structure
      const validTemplates = (parsed as Record<string, unknown>[]).filter(
        (item) =>
          item &&
          typeof item === 'object' &&
          typeof item.subjectCode === 'string' &&
          typeof item.offerCode === 'string' &&
          typeof item.subjectDescription === 'string' &&
          typeof item.assignedTeacherName === 'string' &&
          typeof item.room === 'string'
      ).map((item) => ({
        subjectCode: item.subjectCode as string,
        offerCode: item.offerCode as string,
        subjectDescription: item.subjectDescription as string,
        assignedTeacherName: item.assignedTeacherName as string,
        room: item.room as string,
        program: typeof item.program === 'string' ? item.program : undefined,
        programShorthand: typeof item.programShorthand === 'string' ? item.programShorthand : undefined,
        year: typeof item.year === 'number' ? item.year : (typeof item.year === 'string' && !isNaN(Number(item.year)) ? Number(item.year) : undefined),
        section: typeof item.section === 'string' ? item.section : undefined,
      }));

      if (validTemplates.length === 0) {
        throw new Error('No valid subject entries found in the file.');
      }

      await store.importSuggestions(validTemplates);
      messageApi.success(`Imported ${validTemplates.length} suggestions successfully!`);
    } catch (e: unknown) {
      messageApi.error(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Import and Merge schedules from JSON file
  async function handleMergeImport() {
    try {
      const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
      const filePath = await openDialog({
        title: 'Import and Merge Schedules JSON',
        filters: [{ name: 'JSON File', extensions: ['json'] }],
        multiple: false,
        directory: false,
      });

      if (!filePath || typeof filePath !== 'string') return;

      const content = await invoke<string>('read_text_file', { path: filePath });
      const parsed = JSON.parse(content);

      if (!Array.isArray(parsed)) {
        throw new Error('Schedules file must be a JSON array of timetable entries.');
      }

      // Validate structure without using the forbidden `any` type
      const validEntries: SubjectEntry[] = (parsed as Record<string, unknown>[]).filter(
        (item) =>
          item &&
          typeof item === 'object' &&
          typeof item.subjectCode === 'string' &&
          typeof item.offerCode === 'string' &&
          typeof item.subjectDescription === 'string' &&
          Array.isArray(item.schedules)
      ).map((item) => {
        const rawSchedules = item.schedules as Record<string, unknown>[];
        return {
          id: typeof item.id === 'string' ? item.id : '',
          subjectCode: item.subjectCode as string,
          offerCode: item.offerCode as string,
          subjectDescription: item.subjectDescription as string,
          assignedTeacherName: typeof item.assignedTeacherName === 'string' ? item.assignedTeacherName : '',
          room: typeof item.room === 'string' ? item.room : '',
          schedules: rawSchedules.map((s) => ({
            id: typeof s.id === 'string' ? s.id : '',
            days: Array.isArray(s.days) ? (s.days as DayOfWeek[]) : [],
            startTime: typeof s.startTime === 'string' ? s.startTime : '',
            endTime: typeof s.endTime === 'string' ? s.endTime : '',
          })),
          program: typeof item.program === 'string' ? item.program : '',
          programShorthand: typeof item.programShorthand === 'string' ? item.programShorthand : '',
          year: typeof item.year === 'number' ? item.year : 1,
          section: typeof item.section === 'string' ? item.section : '',
        };
      });

      if (validEntries.length === 0) {
        throw new Error('No valid schedules found in the file.');
      }

      const result = store.mergeEntries(validEntries);

      const { message: nativeMessage } = await import('@tauri-apps/plugin-dialog');
      const lines = [
        `Import complete.`,
        ``,
        `Total entries in file:   ${result.totalImported}`,
        `Merged (new/updated):    ${result.successCount}`,
        `Skipped (duplicates):    ${result.skippedCount}`,
      ];
      await nativeMessage(lines.join('\n'), { title: 'Import & Merge Summary', kind: 'info' });
    } catch (e: unknown) {
      messageApi.error(`Merge failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (store.isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Spin size="large" tip="Loading timetable..." />
      </div>
    );
  }

  return (
    <ConfigProvider theme={getThemeConfig(store.theme)}>
      <Layout style={{ height: '100%', background: '#F5F7FA', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {contextHolder}

        {/* ── Ribbon Toolbar ────────────────────────────────────────── */}
        <RibbonToolbar
          onSave={() => window.dispatchEvent(new CustomEvent('titlebar:save'))}
          onSaveAs={handleSaveAs}
          onImportMerge={handleMergeImport}
          onExportSuggestions={handleExportSuggestions}
          onImportSuggestions={handleImportSuggestions}
          onViewSuggestions={() => setSuggestionsModalOpen(true)}
          canUndo={store.canUndo}
          canRedo={store.canRedo}
          onUndo={store.undo}
          onRedo={store.redo}
          filterType={filterType}
          onFilterTypeChange={setFilterType}
          selectedStudentKey={selectedStudentKey}
          onSelectedStudentKeyChange={setSelectedStudentKey}
          studentSchedules={studentSchedules}
          selectedTeacher={selectedTeacher}
          onSelectedTeacherChange={setSelectedTeacher}
          teacherOptions={teacherOptions}
          selectedRooms={selectedRooms}
          onSelectedRoomsChange={handleSelectedRoomsChange}
          roomOptions={store.suggestions.rooms}
          theme={store.theme}
          onThemeChange={store.updateTheme}
          bandedRows={store.bandedRows}
          onBandedRowsChange={store.updateBandedRows}
          hiddenDays={store.hiddenDays}
          onToggleDay={store.setHiddenDays}
          viewStart={viewStart}
          onViewStartChange={setViewStart}
          viewEnd={viewEnd}
          onViewEndChange={setViewEnd}
          timeOptions={TIME_OPTIONS}
          onAddSubjectEntry={() => {
            store.cancelEdit();
            openSubjectFormWindow();
          }}
          dynamicData={store.dynamicData}
          addDynamicData={store.addDynamicData}
          deleteDynamicData={store.deleteDynamicData}
        />

        {/* ── Main Workspace Body ───────────────────────────────────── */}
        <Content style={{ display: 'flex', alignItems: 'stretch', overflow: 'hidden', flex: 1, minHeight: 0, position: 'relative' }}>
          {/* Left Panel: Subject Entries List (Fill full height) */}
          <div
            style={{
              width: 350,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              borderRight: '1px solid #D0D7E3',
              background: '#FFFFFF',
            }}
          >
            <SubjectTable
              entries={store.entries}
              onEdit={handleEdit}
              onDelete={store.deleteEntry}
              hiddenEntryIds={hiddenEntryIds}
              onToggleHide={handleToggleHideEntry}
              editingEntryId={editingEntry?.id}
              assignedEntryIds={assignedEntryIds}
              currentEntryIds={currentEntryIds}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchResults={searchResults}
            />
          </div>

          {/* Right Panel: Timetable Grid (Fill remaining space) */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              background: '#FFFFFF',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              padding: 12,
            }}
          >
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              <TimetableGrid
                entries={gridEntries}
                hiddenDays={store.hiddenDays}
                onToggleDay={store.setHiddenDays}
                viewStart={viewStart}
                viewEnd={viewEnd}
                onViewStartChange={setViewStart}
                onViewEndChange={setViewEnd}
                bandedRows={store.bandedRows}
                onEditEntry={handleEdit}
                editingEntryId={editingEntry?.id}
                onCancelEdit={handleCancelEdit}
                onUpdateEntry={store.updateEntry}
                onDeleteEntry={store.deleteEntry}
                onDropEntry={handleDropEntry}
                onDeleteSchedule={handleDeleteSchedule}
                activeRoom={activeRoom}
                onActiveRoomChange={setActiveRoom}
                roomOptions={store.suggestions.rooms}
              />
            </div>
          </div>

          {/* Right Slide-in Schedules Panel */}
          <SchedulesPanel
            entries={gridEntries}
            onHighlightSchedule={handleHighlightSchedule}
            onEditSchedule={handleEdit}
            onDeleteSchedule={handleDeleteSchedule}
          />
        </Content>

        {/* ── Conflict Banner bottom bar ───────────────────────────── */}
        {allConflictsList.length > 0 && (
          <div
            style={{
              background: '#ff4d4f',
              color: '#ffffff',
              padding: '3px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
              zIndex: 10,
              fontSize: '11px',
              fontWeight: 500,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CloseCircleFilled style={{ fontSize: '11px' }} />
              <span>{allConflictsList.length} conflicts detected</span>
            </div>
            <Popover
              content={
                <div style={{ maxHeight: '272px', overflowY: 'auto', width: '420px' }}>
                  {allConflictsList.map(({ entry, conflict }, idx) => (
                    <div
                      key={idx}
                      onMouseEnter={() => {
                        const s1 = entry.schedules.find(
                          (s) => s.days.includes(conflict.day) && s.startTime === conflict.startTime
                        );
                        if (s1) {
                          handleHighlightSchedule(entry.id, s1.id);
                        }
                        const s2 = conflict.conflictingEntry.schedules.find(
                          (s) => s.days.includes(conflict.day) && s.startTime === conflict.startTime
                        );
                        if (s2) {
                          handleHighlightSchedule(conflict.conflictingEntry.id, s2.id);
                        }
                      }}
                      style={{
                        padding: '6px 8px',
                        borderBottom: idx < allConflictsList.length - 1 ? '1px solid #f0f0f0' : 'none',
                        fontSize: '12px',
                        color: '#434343',
                        display: 'flex',
                        alignItems: 'center',
                        minHeight: '34px',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                      className="conflict-hover-item"
                    >
                      <span>
                        Offer Code <strong style={{ color: '#D32F2F' }}>{entry.offerCode}</strong> conflicts with <strong style={{ color: '#D32F2F' }}>{conflict.conflictingEntry.offerCode}</strong> ({conflict.type} conflict on {conflict.day})
                      </span>
                    </div>
                  ))}
                </div>
              }
              title={<span style={{ fontWeight: 600, color: '#ff4d4f' }}>Conflict Details</span>}
              trigger="click"
              placement="topRight"
            >
              <Button
                size="small"
                type="text"
                className="conflict-bell-btn"
                icon={<BellFilled style={{ fontSize: '14px' }} />}
                style={{
                  border: 'none',
                  padding: '0 6px',
                  height: '22px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            </Popover>
          </div>
        )}

        {/* ── Suggestions Modal ────────────────────────────────────── */}
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '92%' }}>
              <span style={{ fontSize: 14 }}>Imported Autocomplete Suggestions</span>
              {store.importedSuggestions.length > 0 && (
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={async () => {
                    await store.clearImportedSuggestions();
                    messageApi.success('All imported suggestions cleared.');
                  }}
                >
                  Clear All
                </Button>
              )}
            </div>
          }
          open={suggestionsModalOpen}
          onCancel={() => setSuggestionsModalOpen(false)}
          footer={[
            <Button key="close" type="primary" size="small" onClick={() => setSuggestionsModalOpen(false)}>
              Close
            </Button>
          ]}
          width={580}
          destroyOnClose
        >
          <div style={{ maxHeight: 400, overflowY: 'auto', paddingTop: 8 }}>
            {store.importedSuggestions.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: '#7A8BA8' }}>
                No imported suggestions yet. Upload a JSON file to add some!
              </div>
            ) : (
              <List
                size="small"
                dataSource={store.importedSuggestions}
                renderItem={(item, index) => (
                  <List.Item
                    actions={[
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined style={{ fontSize: 12 }} />}
                        onClick={async () => {
                          await store.deleteImportedSuggestion(index);
                          messageApi.success('Suggestion deleted.');
                        }}
                      />
                    ]}
                    style={{ padding: '6px 8px' }}
                  >
                    <List.Item.Meta
                      title={
                        <div style={{ fontSize: 12, fontWeight: 600 }}>
                          {item.subjectCode} <span style={{ color: '#7A8BA8', fontWeight: 400, marginLeft: 4 }}>({item.offerCode})</span>
                        </div>
                      }
                      description={
                        <div style={{ fontSize: 11, color: '#4A5B78', lineHeight: '1.4' }}>
                          <div>{item.subjectDescription}</div>
                          <div style={{ marginTop: 2, display: 'flex', gap: 12 }}>
                            <span><strong>Teacher:</strong> {item.assignedTeacherName}</span>
                            <span><strong>Room:</strong> {item.room}</span>
                          </div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </div>
        </Modal>

        {/* ── Export Options Modal ─────────────────────────────────── */}
        <Modal
          title="Export Timetable Options"
          open={exportModalOpen}
          onOk={handleSaveAs}
          onCancel={() => setExportModalOpen(false)}
          okText="Export"
          destroyOnClose
        >
          <div style={{ paddingBlock: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Text style={{ display: 'block', margin: 0, color: '#333' }}>
              Choose settings for exporting <strong>{timetableName}</strong>.
            </Text>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, width: 100 }}>Filter Option:</span>
                <Select
                  size="small"
                  value={exportFilterType}
                  onChange={(val) => setExportFilterType(val)}
                  style={{ width: 180 }}
                  options={[
                    { label: 'Use Current', value: 'current' },
                    { label: 'All Schedules', value: 'all' },
                    { label: 'Filter by Room', value: 'room' },
                  ]}
                />
              </div>

              {exportFilterType === 'room' && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, width: 100 }}>Rooms:</span>
                    <Select
                      mode="tags"
                      size="small"
                      tokenSeparators={[',']}
                      value={exportSelectedRooms}
                      onChange={(val) => setExportSelectedRooms(val)}
                      style={{ width: 180 }}
                      placeholder="Select or type rooms"
                      options={store.suggestions.rooms.map((r) => ({ label: r, value: r }))}
                      maxTagCount="responsive"
                    />
                  </div>

                  <div style={{ paddingLeft: 108 }}>
                    <Checkbox
                      checked={exportExactMatch}
                      onChange={(e) => setExportExactMatch(e.target.checked)}
                    >
                      Exact Match
                    </Checkbox>
                    <div style={{ fontSize: 11, color: '#7A8BA8', marginTop: 4 }}>
                      When enabled, only schedules with this exact room will be exported.
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </Modal>
      </Layout>
    </ConfigProvider>
  );
}
