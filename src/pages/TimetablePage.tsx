import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Layout, Typography, Spin, message, Button, Modal, List, Select, Checkbox, ConfigProvider, Drawer, Tag } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useTimetableStore } from '../hooks/useTimetableStore';
import { getLinks, getConnectedKeys } from '../utils/linkUtils';
import { getThemeConfig } from '../theme';
import { BlueprintList } from '../components/BlueprintList';
import { TimetableGrid } from '../components/TimetableGrid';
import { exportToXlsx } from '../utils/exportXlsx';
import { usePreferences } from '../context/PreferencesContext';
import { save, ask } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import type { SubjectEntry, DayOfWeek, ConflictInfo, Schedule } from '../types';

import { RibbonToolbar } from '../components/RibbonToolbar';
import { PlacedSchedules } from '../components/PlacedSchedules';
import { SchedulePropertiesPanel } from '../components/SchedulePropertiesPanel';
import { BlueprintForm } from '../components/BlueprintForm';
import { StatusBar } from '../components/StatusBar';
import { useBlueprintSearch } from '../hooks/useBlueprintSearch';

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
    .filter((entry) => {
      const original = entries.find((e) => e.id === entry.id);
      const originalHadSchedules = original ? original.schedules.length > 0 : false;
      if (originalHadSchedules && entry.schedules.length === 0) {
        return false;
      }
      return true;
    });
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

  // Prevent default window dragover/drop behaviors to allow Tauri/WebView2 HTML5 drag and drop
  useEffect(() => {
    const preventDefault = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', preventDefault);
    window.addEventListener('drop', preventDefault);
    return () => {
      window.removeEventListener('dragover', preventDefault);
      window.removeEventListener('drop', preventDefault);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('store:history-change', {
      detail: { canUndo: store.canUndo, canRedo: store.canRedo }
    }));
  }, [store.canUndo, store.canRedo]);
  const editingEntry = useMemo(
    () => store.blueprints.find((e) => e.id === store.editingEntryId) || null,
    [store.blueprints, store.editingEntryId]
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
  const [selectedScheduleBlock, setSelectedScheduleBlock] = useState<{ entry: SubjectEntry; schedule: Schedule } | null>(null);
  const [subjectDrawerOpen, setSubjectDrawerOpen] = useState(false);

  // Custom mouse-drag states
  const [customDraggingId, setCustomDraggingId] = useState<string | null>(null);
  const [customDragPos, setCustomDragPos] = useState<{ x: number; y: number } | null>(null);

  // Link Binding States
  const [linkingModeActive, setLinkingModeActive] = useState(false);
  const [linkingFirstBlockKey, setLinkingFirstBlockKey] = useState<string | null>(null);
  const [linkingHighlightedKeys, setLinkingHighlightedKeys] = useState<Set<string> | null>(null);
  const [svgLines, setSvgLines] = useState<Array<{ x1: number; y1: number; x2: number; y2: number }>>([]);

  useEffect(() => {
    const showAll = linkingModeActive || !!linkingHighlightedKeys;
    if (!showAll) {
      setSvgLines([]);
      return;
    }

    const updateLines = () => {
      const newLines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
      const links = getLinks(store.dynamicData);

      for (const [childKey, parentKey] of links.entries()) {
        const shouldShow = linkingModeActive || (linkingHighlightedKeys && (linkingHighlightedKeys.has(childKey) || linkingHighlightedKeys.has(parentKey)));
        if (shouldShow) {
          const [cSubj, cSched] = childKey.split(':');
          const [pSubj, pSched] = parentKey.split(':');

          const cEl = document.getElementById(`grid-block-${cSubj}-${cSched}`);
          const pEl = document.getElementById(`grid-block-${pSubj}-${pSched}`);

          if (cEl && pEl) {
            const cRect = cEl.getBoundingClientRect();
            const pRect = pEl.getBoundingClientRect();

            newLines.push({
              x1: cRect.left + cRect.width / 2,
              y1: cRect.top + cRect.height / 2,
              x2: pRect.left + pRect.width / 2,
              y2: pRect.top + pRect.height / 2,
            });
          }
        }
      }
      setSvgLines(newLines);
    };

    updateLines();
    const t = setTimeout(updateLines, 100);

    window.addEventListener('resize', updateLines);
    window.addEventListener('scroll', updateLines, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', updateLines);
      window.removeEventListener('scroll', updateLines, true);
    };
  }, [linkingModeActive, linkingHighlightedKeys, store.dynamicData, store.instances]);

  const roomSuggestionsUnion = useMemo(() => {
    const fromDynamic = store.dynamicData
      .filter((d) => d.dataType === 'room')
      .map((d) => d.value);
    const union = new Set([...fromDynamic, ...store.suggestions.rooms]);
    return Array.from(union).sort();
  }, [store.dynamicData, store.suggestions.rooms]);

  const activeSelectedBlock = useMemo(() => {
    if (!selectedScheduleBlock) return null;
    const entry = store.instances.find((e) => e.id === selectedScheduleBlock.entry.id);
    if (!entry) return null;
    const schedule = entry.schedules.find((s) => s.id === selectedScheduleBlock.schedule.id);
    if (!schedule) return null;
    return { entry, schedule };
  }, [store.instances, selectedScheduleBlock]);

  useEffect(() => {
    if (!activeRoom && roomSuggestionsUnion.length > 0) {
      setActiveRoom(roomSuggestionsUnion[0]);
    }
  }, [roomSuggestionsUnion, activeRoom]);

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


  const { query: searchQuery, setQuery: setSearchQuery, results: searchResults } = useBlueprintSearch(store.blueprints);

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

  const handleCloseSubjectDrawer = useCallback(() => {
    setSubjectDrawerOpen(false);
    store.cancelEdit();
  }, [store]);

  useEffect(() => {
    if (store.editingEntryId) {
      setSubjectDrawerOpen(true);
    }
  }, [store.editingEntryId]);



  const studentSchedules = useMemo(() => {
    const keys = new Set<string>();
    const options: { label: string; value: string }[] = [];
    for (const entry of store.instances) {
      if (entry.program && entry.year && entry.section) {
        const key = `${entry.program}|${entry.year}|${entry.section}`;
        if (!keys.has(key)) {
          keys.add(key);
          options.push({
            label: `${entry.program} - Year ${entry.year} - ${entry.section}`,
            value: key,
          });
        }
      }
    }
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [store.instances]);

  const teacherOptions = useMemo(() => {
    const names = new Set<string>();
    const options: { label: string; value: string }[] = [];
    for (const entry of store.instances) {
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
  }, [store.instances]);
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
      return store.instances.filter(
        (e) =>
          e.program === prog &&
          String(e.year) === yr &&
          e.section === sec
      );
    }
    if (filterType === 'teacher' && selectedTeacher) {
      return store.instances.filter((e) => e.assignedTeacherName === selectedTeacher);
    }
    if (filterType === 'room') {
      if (selectedRooms.length === 0 || selectedRooms.includes('all')) {
        return store.instances.filter((e) => e.room);
      }
      return store.instances.filter((e) => {
        if (!e.room) return false;
        const entryRooms = e.room.split(',').map((r) => r.trim().toLowerCase());
        return entryRooms.some((r) => selectedRooms.map((sr) => sr.toLowerCase()).includes(r));
      });
    }
    return store.instances;
  }, [store.instances, filterType, selectedStudentKey, selectedTeacher, selectedRooms]);

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
        store.instances,
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
    let entriesToProcess = store.instances;
    if (exportFilterType === 'current') {
      entriesToProcess = filteredEntries;
    } else if (exportFilterType === 'room' && exportSelectedRooms.length > 0) {
      entriesToProcess = store.instances.filter((e) => {
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
      const saveObj = {
        entries: entriesToSave,
        dynamicData: store.dynamicData,
      };
      const json = JSON.stringify(saveObj, null, 2);
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
    return store.addBlueprint(entry);
  }, [store]);

  const handleEdit = useCallback((entry: SubjectEntry): void => {
    store.startEdit(entry.id);
  }, [store]);

  const handleCancelEdit = useCallback((): void => {
    store.cancelEdit();
    setSelectedScheduleBlock(null);
    setLinkingFirstBlockKey(null);
    setLinkingHighlightedKeys(null);
  }, [store]);

  const handleSelectScheduleBlock = useCallback(async (entry: SubjectEntry, schedule: Schedule) => {
    if (linkingModeActive) {
      const key = `${entry.id}:${schedule.id}`;
      if (!linkingFirstBlockKey) {
        setLinkingFirstBlockKey(key);
        const links = getLinks(store.dynamicData);
        if (links.has(key) || Array.from(links.values()).includes(key)) {
          const connected = getConnectedKeys(key, links);
          setLinkingHighlightedKeys(connected);
        } else {
          setLinkingHighlightedKeys(null);
        }
      } else {
        const firstKey = linkingFirstBlockKey;
        const secondKey = key;
        if (firstKey !== secondKey) {
          const links = getLinks(store.dynamicData);
          const isSecondLinked = links.has(secondKey) || Array.from(links.values()).includes(secondKey);
          const isFirstChild = links.has(firstKey);

          if (isSecondLinked) {
            message.warning("The second slot is already part of a link group and cannot be linked again.");
          } else if (isFirstChild) {
            message.warning("The first slot is a child slot in a link group and cannot be a parent.");
          } else {
            await store.addDynamicData('link', secondKey, firstKey);
            message.success("Schedule slots linked successfully.");

            const firstParts = firstKey.split(':');
            const secondParts = secondKey.split(':');
            const latestEntries = store.instances;
            const firstEntry = latestEntries.find(e => e.id === firstParts[0]);
            const secondEntry = latestEntries.find(e => e.id === secondParts[0]);

            if (firstEntry && secondEntry) {
              const firstSched = firstEntry.schedules.find(s => s.id === firstParts[1]);
              const secondSched = secondEntry.schedules.find(s => s.id === secondParts[1]);

              let updatedSchedules = secondEntry.schedules;
              if (firstSched && secondSched) {
                updatedSchedules = secondEntry.schedules.map(s => {
                  if (s.id === secondSched.id) {
                    return {
                      ...s,
                      assignedTeacherName: firstSched.assignedTeacherName,
                    };
                  }
                  return s;
                });
              }

              store.updateInstance({
                ...secondEntry,
                subjectCode: firstEntry.subjectCode,
                offerCode: firstEntry.offerCode,
                subjectDescription: firstEntry.subjectDescription,
                assignedTeacherName: firstEntry.assignedTeacherName,
                department: firstEntry.department,
                program: firstEntry.program,
                year: firstEntry.year,
                section: firstEntry.section,
                color: firstEntry.color,
                schedules: updatedSchedules,
              });
            }
          }
        }
        setLinkingFirstBlockKey(null);
        setLinkingHighlightedKeys(null);
      }
    } else {
      setSelectedScheduleBlock({ entry, schedule });
    }
  }, [linkingModeActive, linkingFirstBlockKey, store]);

  const handleUnlinkBlock = useCallback(async (blockKey: string) => {
    const linkRow = store.dynamicData.find(
      (d) => d.dataType === 'link' && d.value === blockKey
    );
    if (linkRow) {
      await store.deleteDynamicData(linkRow.id);
      message.success("Schedule slot detached from link.");
      setLinkingFirstBlockKey(null);
      setLinkingHighlightedKeys(null);
    }
  }, [store]);

  const handleToggleLinkingMode = useCallback(() => {
    setLinkingModeActive((prev) => {
      const next = !prev;
      if (!next) {
        setLinkingFirstBlockKey(null);
        setLinkingHighlightedKeys(null);
      }
      return next;
    });
  }, []);

  const handleDropEntry = useCallback((entryId: string, day: DayOfWeek, startMin: number, room: string) => {
    const entry = store.blueprints.find((e) => e.id === entryId);
    if (!entry) return;
    const startStr = toTime(startMin);
    const endStr = toTime(startMin + 60);
    const newSched = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      days: [day],
      startTime: startStr,
      endTime: endStr,
      rooms: [room],
    };

    const newId = Math.random().toString(36).slice(2) + Date.now().toString(36);

    store.addInstance({
      ...entry,
      id: newId,
      schedules: [newSched],
      room,
    });
  }, [store]);

  const handleDragStartCustom = useCallback((entryId: string, clientX: number, clientY: number) => {
    setCustomDraggingId(entryId);
    setCustomDragPos({ x: clientX, y: clientY });
  }, []);

  useEffect(() => {
    if (!customDraggingId) return;

    const handleMouseMove = (e: MouseEvent) => {
      setCustomDragPos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const columnEl = el ? el.closest('.grid-day-column') : null;
      if (columnEl) {
        const day = columnEl.getAttribute('data-day-column') as DayOfWeek;
        const room = columnEl.getAttribute('data-room') || '';
        const rect = columnEl.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        const slotIndex = Math.max(0, Math.floor((relativeY - 32) / 36)); // 32px is header cell height, 36px is ROW_HEIGHT
        const startMin = viewStart + slotIndex * 30; // 30 is SLOT_INTERVAL
        handleDropEntry(customDraggingId, day, startMin, room);
      }
      setCustomDraggingId(null);
      setCustomDragPos(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [customDraggingId, viewStart, handleDropEntry]);

  const handleDeleteSchedule = useCallback((entryId: string, _scheduleId: string) => {
    store.deleteInstance(entryId);
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

  const subjectSuggestions = useMemo(() => {
    return {
      ...store.suggestions,
      rooms: roomSuggestionsUnion,
    };
  }, [store.suggestions, roomSuggestionsUnion]);

  const templatesList = useMemo(() => {
    return [
      ...store.blueprints.map((e) => ({
        subjectCode: e.subjectCode,
        offerCode: e.offerCode,
        subjectDescription: e.subjectDescription,
        assignedTeacherName: e.assignedTeacherName,
        room: e.room || '',
        program: e.program,
        year: e.year,
        section: e.section,
      })),
      ...store.instances.map((e) => ({
        subjectCode: e.subjectCode,
        offerCode: e.offerCode,
        subjectDescription: e.subjectDescription,
        assignedTeacherName: e.assignedTeacherName,
        room: e.room || '',
        program: e.program,
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
        year: s.year,
        section: s.section,
      })),
    ];
  }, [store.blueprints, store.instances, store.importedSuggestions]);



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
            rooms: Array.isArray(s.rooms)
              ? (s.rooms as string[])
              : (typeof item.room === 'string' && item.room ? [item.room] : []),
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
        <Spin size="large" description="Loading timetable..." />
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
          roomOptions={roomSuggestionsUnion}
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
            setSubjectDrawerOpen(true);
          }}
          dynamicData={store.dynamicData}
          addDynamicData={store.addDynamicData}
          deleteDynamicData={store.deleteDynamicData}
          updateDynamicData={store.updateDynamicData}
          linkingModeActive={linkingModeActive}
          onToggleLinkingMode={handleToggleLinkingMode}
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
            <BlueprintList
              blueprints={store.blueprints}
              onEdit={handleEdit}
              onDelete={store.deleteBlueprint}
              hiddenEntryIds={hiddenEntryIds}
              onToggleHide={handleToggleHideEntry}
              editingEntryId={editingEntry?.id}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchResults={searchResults}
              onDragStartCustom={handleDragStartCustom}
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
                viewStart={viewStart}
                viewEnd={viewEnd}
                bandedRows={store.bandedRows}
                editingEntryId={editingEntry?.id}
                onCancelEdit={handleCancelEdit}
                onUpdateEntry={store.updateInstance}
                onDeleteEntry={store.deleteBlueprint}
                onDropEntry={handleDropEntry}
                onDeleteSchedule={handleDeleteSchedule}
                activeRoom={activeRoom}
                onSelectScheduleBlock={handleSelectScheduleBlock}
                linkingFirstBlockKey={linkingFirstBlockKey}
                linkingHighlightedKeys={linkingHighlightedKeys}
                linkingModeActive={linkingModeActive}
                onUnlinkBlock={handleUnlinkBlock}
              />
            </div>
          </div>

          {/* Right Slide-in Schedules Panel / Schedule Properties */}
          {activeSelectedBlock ? (
            <SchedulePropertiesPanel
              entry={activeSelectedBlock.entry}
              schedule={activeSelectedBlock.schedule}
              dynamicData={store.dynamicData}
              onSave={(updatedEntry) => {
                const scheduleId = activeSelectedBlock.schedule.id;
                const conflicts = store.updateInstance(updatedEntry, scheduleId);
                if (conflicts.length > 0) {
                  messageApi.error('Conflict detected during save! Check conflict details.');
                } else {
                  messageApi.success('Subject properties updated.');
                }
              }}
              onCancel={() => setSelectedScheduleBlock(null)}
              onDeleteSchedule={(entryId, scheduleId) => {
                handleDeleteSchedule(entryId, scheduleId);
                setSelectedScheduleBlock(null);
              }}
            />
          ) : (
            <PlacedSchedules
              entries={gridEntries}
              onHighlightSchedule={handleHighlightSchedule}
              onDeleteSchedule={handleDeleteSchedule}
            />
          )}
        </Content>

        {/* ── Status Bar ────────────────────────────────────────────── */}
        <StatusBar
          fileName={store.filePath ? store.filePath.split(/[/\\]/).pop() ?? null : null}
          linkingModeActive={linkingModeActive}
          onToggleLinkingMode={handleToggleLinkingMode}
          roomOptions={roomSuggestionsUnion}
          activeRoom={activeRoom}
          onActiveRoomChange={setActiveRoom}
          linkingFirstBlockKey={linkingFirstBlockKey}
          allConflictsList={allConflictsList}
          onHighlightSchedule={handleHighlightSchedule}
        />

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
                      options={roomSuggestionsUnion.map((r) => ({ label: r, value: r }))}
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

        {/* Sliding Sidebar for Blueprint Form */}
        <Drawer
          title={editingEntry ? 'Edit Blueprint' : 'Add Blueprint'}
          placement="left"
          width={450}
          onClose={handleCloseSubjectDrawer}
          open={subjectDrawerOpen}
          destroyOnClose
        >
          <BlueprintForm
            suggestions={subjectSuggestions}
            blueprints={store.blueprints}
            templates={templatesList}
            onSubmit={(entry) => {
              const conflicts = handleFormSubmit(entry);
              if (conflicts.length > 0) {
                messageApi.error('Conflict detected!');
              } else {
                messageApi.success(editingEntry ? 'Blueprint updated!' : 'Blueprint added!');
                setSearchQuery('');
                handleCloseSubjectDrawer();
              }
              return conflicts;
            }}
            editingEntry={editingEntry}
            onCancelEdit={handleCloseSubjectDrawer}
            formState={store.formState}
            onFormStateChange={store.updateFormState}
            dynamicData={store.dynamicData}
          />
        </Drawer>
      </Layout>

      {svgLines.length > 0 && (
        <svg
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            zIndex: 999999,
          }}
        >
          {svgLines.map((line, idx) => (
            <line
              key={idx}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="#ef4444"
              strokeWidth={3}
              strokeDasharray="5,5"
              style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.3))' }}
            />
          ))}
        </svg>
      )}

      {customDraggingId && customDragPos && (
        <div
          style={{
            position: 'fixed',
            left: customDragPos.x + 12,
            top: customDragPos.y + 12,
            pointerEvents: 'none',
            zIndex: 9999999,
            opacity: 0.9,
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            background: '#FFFFFF',
            border: '2px solid #2B4C7E',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 11,
            fontWeight: 700,
            color: '#1E3560',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Tag color="#2B4C7E" style={{ margin: 0, fontWeight: 700, fontSize: 10, borderRadius: 4 }}>
            {store.blueprints.find((e) => e.id === customDraggingId)?.subjectCode || 'Subject'}
          </Tag>
          <span>
            {store.blueprints.find((e) => e.id === customDraggingId)?.offerCode || ''}
          </span>
        </div>
      )}
    </ConfigProvider>
  );
}
