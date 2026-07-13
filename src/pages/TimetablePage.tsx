import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import gsap from 'gsap';
import { Layout, Typography, Spin, message, Button, Modal, List, Select, Checkbox, ConfigProvider, Drawer, Space, notification } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useTimetableStore } from '../hooks/useTimetableStore';
import { getLinks, getConnectedKeys } from '../utils/linkUtils';
import { getThemeConfig } from '../theme';
import { BlueprintList } from '../components/BlueprintList';
import { TimetableGrid } from '../components/TimetableGrid';
import { exportToXlsx } from '../utils/exportXlsx';
import * as ExcelJS from 'exceljs';
import { usePreferences } from '../context/PreferencesContext';
import { save, ask, open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import type { SubjectEntry, DayOfWeek, ConflictInfo, Schedule, DynamicData } from '../types';

import { RibbonToolbar } from '../components/RibbonToolbar';
import { PlacedSchedules } from '../components/PlacedSchedules';
import { SchedulePropertiesPanel } from '../components/SchedulePropertiesPanel';
import { BlueprintForm } from '../components/BlueprintForm';
import { ColumnMappingForm } from '../components/ColumnMappingForm';
import { detectBlueprintColumns, detectScheduleColumns } from '../utils/autoDetectColumns';
import { parseInstructorValue, formatInstructorValue, formatInstructorDisplay } from '../utils/teacherName';
import { resolveRoomForSchedule } from '../utils/conflictResolver';
import { StatusBar } from '../components/StatusBar';
import { useBlueprintSearch } from '../hooks/useBlueprintSearch';
import { useCollection } from '../hooks/useCollectionContext';

const { Content } = Layout;
const { Text } = Typography;

interface TimetablePageProps {
  /** SQLite id of the timetable being edited */
  timetableId: string;
  /** Display name of the timetable */
  timetableName: string;
  /** Called when the user navigates back to home */
  onBack: () => void;
  /** Incremented by TitleBar when File > Save As is triggered */
  exportTrigger: number;
  /** Incremented when Ctrl+S / File > Save is triggered */
  saveTrigger: number;
  /** Incremented when File > Import & Merge is triggered */
  importMergeTrigger: number;
  /** Incremented when File > Export JSON Data is triggered */
  exportJsonTrigger: number;
  /** Incremented when File > Export Room Timetable is triggered */
  exportExcelRoomTrigger: number;
  /** Incremented when File > Import Blueprints from Excel is triggered */
  importExcelTrigger: number;
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
export function TimetablePage({ timetableId, timetableName, onBack: _onBack, exportTrigger, saveTrigger, importMergeTrigger, exportJsonTrigger, exportExcelRoomTrigger, importExcelTrigger }: TimetablePageProps) {
  const store = useTimetableStore(timetableId);
  const collection = useCollection();
  const prefs = usePreferences();
  const [messageApi, contextHolder] = message.useMessage();
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const [statusMessage, setStatusMessage] = useState('');

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
      detail: { canUndo: store.canUndo, canRedo: store.canRedo, isDirty: store.isDirty }
    }));
  }, [store.canUndo, store.canRedo, store.isDirty]);

  // Auto-clear status message after 4 seconds
  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(''), 4000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

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
  const lastExportJsonTriggerRef = useRef(exportJsonTrigger);
  const lastExportExcelRoomTriggerRef = useRef(exportExcelRoomTrigger);
  const lastImportExcelTriggerRef = useRef(importExcelTrigger);

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFilterType, setExportFilterType] = useState<'current' | 'all' | 'room'>('current');
  const [exportSelectedRooms, setExportSelectedRooms] = useState<string[]>([]);
  const [exportExactMatch, setExportExactMatch] = useState(false);
  const [pendingExportPath, setPendingExportPath] = useState<string | null>(null);

  const [filterType, setFilterType] = useState<'all' | 'student' | 'teacher' | 'room'>('all');
  const [selectedStudentKey, setSelectedStudentKey] = useState<string | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [hiddenEntryIds, setHiddenEntryIds] = useState<string[]>([]);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [selectedScheduleBlock, setSelectedScheduleBlock] = useState<{ entry: SubjectEntry; schedule: Schedule } | null>(null);
  const selectedScheduleBlockRef = useRef(selectedScheduleBlock);
  selectedScheduleBlockRef.current = selectedScheduleBlock;
  const [selectedBlockKeys, setSelectedBlockKeys] = useState<Set<string>>(new Set());
  const [clipboardBlocks, setClipboardBlocks] = useState<Array<{ entryId: string; schedule: Schedule }>>([]);
  const [subjectDrawerOpen, setSubjectDrawerOpen] = useState(false);

  // Custom mouse-drag state (blueprint to timetable) — ghost element managed via raw DOM

  // Move Room Modal
  const [moveRoomBlockKey, setMoveRoomBlockKey] = useState<string | null>(null);
  const [moveRoomOpen, setMoveRoomOpen] = useState(false);
  const [moveTargetBuilding, setMoveTargetBuilding] = useState<string | null>(null);
  const [moveTargetRoom, setMoveTargetRoom] = useState<string | null>(null);

  // Export Room Modal
  const [exportRoomModalOpen, setExportRoomModalOpen] = useState(false);
  const [exportRoomBuilding, setExportRoomBuilding] = useState<string | null>(null);
  const [exportRoomRoom, setExportRoomRoom] = useState<string | null>(null);

  // Import Excel Modal
  const [importExcelModalOpen, setImportExcelModalOpen] = useState(false);
  const [importExcelFileBytes, setImportExcelFileBytes] = useState<Uint8Array | null>(null);
  const [importExcelFileName, setImportExcelFileName] = useState('');
  const [importExcelLoading, setImportExcelLoading] = useState(false);
  const [importExcelMapping, setImportExcelMapping] = useState<Record<string, string>>({});
  const [importExcelScheduleMapping, setImportExcelScheduleMapping] = useState<Record<string, string>>({});
  const [importExcelSkipped, setImportExcelSkipped] = useState<string[]>([]);
  const [importExcelSkippedDrawerOpen, setImportExcelSkippedDrawerOpen] = useState(false);
  const [importExcelPreviewRows, setImportExcelPreviewRows] = useState<string[][] | undefined>(undefined);
  const [importNotifications, setImportNotifications] = useState<string[]>([]);

  // Link Binding States
  const [linkingModeActive, setLinkingModeActive] = useState(false);
  const [linkingFirstBlockKey, setLinkingFirstBlockKey] = useState<string | null>(null);
  const [linkingHighlightedKeys, setLinkingHighlightedKeys] = useState<Set<string> | null>(null);

  // GSAP-optimized link lines (refs, no React state during scroll)
  const svgRef = useRef<SVGSVGElement | null>(null);
  const lineElsRef = useRef<Map<string, SVGLineElement>>(new Map());
  const linkPairsRef = useRef<Array<{ childKey: string; parentKey: string }>>([]);

  // Setup effect: build SVG + line elements when link data changes
  useEffect(() => {
    const showAll = linkingModeActive || !!linkingHighlightedKeys;
    // Remove existing SVG if nothing to show
    if (!showAll) {
      if (svgRef.current) {
        svgRef.current.remove();
        svgRef.current = null;
      }
      lineElsRef.current.clear();
      linkPairsRef.current = [];
      return;
    }

    const links = getLinks(store.dynamicData);
    const pairs: Array<{ childKey: string; parentKey: string }> = [];
    for (const [childKey, parentKey] of links.entries()) {
      const shouldShow = linkingModeActive || (linkingHighlightedKeys && (linkingHighlightedKeys.has(childKey) || linkingHighlightedKeys.has(parentKey)));
      if (shouldShow) pairs.push({ childKey, parentKey });
    }
    linkPairsRef.current = pairs;

    // Create SVG element if needed
    let svg = svgRef.current;
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:999999';
      document.body.appendChild(svg);
      svgRef.current = svg;
    }

    // Build line elements for current pairs
    const newKeys = new Set(pairs.map(p => p.childKey));
    // Remove orphaned lines
    for (const [key, el] of lineElsRef.current) {
      if (!newKeys.has(key)) {
        el.remove();
        lineElsRef.current.delete(key);
      }
    }
    // Create missing lines
    for (const { childKey } of pairs) {
      if (!lineElsRef.current.has(childKey)) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('stroke', '#ef4444');
        line.setAttribute('stroke-width', '3');
        line.setAttribute('stroke-dasharray', '5,5');
        line.style.filter = 'drop-shadow(0px 2px 4px rgba(0,0,0,0.3))';
        svg.appendChild(line);
        lineElsRef.current.set(childKey, line);
      }
    }

    const lineEls = lineElsRef.current;
    const linkPairs = linkPairsRef.current;
    return () => {
      if (svgRef.current) {
        svgRef.current.remove();
        svgRef.current = null;
      }
      lineEls.clear();
      linkPairs.splice(0, linkPairs.length);
    };
  }, [linkingModeActive, linkingHighlightedKeys, store.dynamicData]);

  // Update effect: position lines on scroll/resize via GSAP (no React state)
  useEffect(() => {
    const updateLines = () => {
      for (const { childKey, parentKey } of linkPairsRef.current) {
        const [cs, ci] = childKey.split(':');
        const [ps, pi] = parentKey.split(':');
        const cEl = document.getElementById(`grid-block-${cs}-${ci}`);
        const pEl = document.getElementById(`grid-block-${ps}-${pi}`);
        if (!cEl || !pEl) continue;
        const cr = cEl.getBoundingClientRect();
        const pr = pEl.getBoundingClientRect();
        const cVisible = cr.bottom > 0 && cr.top < window.innerHeight;
        const pVisible = pr.bottom > 0 && pr.top < window.innerHeight;
        const line = lineElsRef.current.get(childKey);
        if (!line) continue;
        if (cVisible && pVisible) {
          gsap.set(line, { attr: { x1: cr.left + cr.width / 2, y1: cr.top + cr.height / 2, x2: pr.left + pr.width / 2, y2: pr.top + pr.height / 2 } });
          line.style.removeProperty('display');
        } else {
          line.style.display = 'none';
        }
      }
    };

    let rafId: number | null = null;
    const rafUpdate = () => {
      if (rafId === null) rafId = requestAnimationFrame(() => { updateLines(); rafId = null; });
    };

    rafUpdate();
    window.addEventListener('resize', rafUpdate);
    window.addEventListener('scroll', rafUpdate, { passive: true, capture: true });
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', rafUpdate);
      window.removeEventListener('scroll', rafUpdate, { capture: true } as EventListenerOptions);
    };
  }, []);

  const roomSuggestionsUnion = useMemo(() => {
    const fromDynamic = store.dynamicData
      .filter((d) => d.dataType === 'room')
      .map((d) => d.value);
    const union = new Set([...fromDynamic, ...store.suggestions.rooms]);
    return Array.from(union).sort();
  }, [store.dynamicData, store.suggestions.rooms]);

  const roomOptions = useMemo(() => {
    const roomMap = new Map<string, { label: string; value: string }>();
    for (const d of store.dynamicData.filter(d => d.dataType === 'room')) {
      const parts = d.displayAs.split('|');
      const roomName = d.value;
      const building = parts[1] || 'External';
      const key = `${roomName}|${building}`.toLowerCase();
      const value = `${roomName}|${building}`;
      const label = `${building} - ${roomName}`;
      roomMap.set(key, { label, value });
    }
    for (const r of store.suggestions.rooms) {
      if (!r) continue;
      const parts = r.split('|');
      const roomName = parts[0];
      const building = parts[1] || 'External';
      const key = `${roomName}|${building}`.toLowerCase();
      if (!roomMap.has(key)) {
        const value = `${roomName}|${building}`;
        const label = `${building} - ${roomName}`;
        roomMap.set(key, { label, value });
      }
    }
    return Array.from(roomMap.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [store.dynamicData, store.suggestions.rooms]);

  const buildingOptions = useMemo(() => {
    const buildings = new Set<string>();
    for (const d of store.dynamicData.filter(d => d.dataType === 'room')) {
      const parts = d.displayAs.split('|');
      if (parts[1]) buildings.add(parts[1]);
    }
    return Array.from(buildings).sort().map(b => ({ label: b, value: b }));
  }, [store.dynamicData]);

  const filteredRoomOptions = useMemo(() => {
    return roomOptions.filter(r => {
      const parts = r.value.split('|');
      const building = parts[1] || '';
      return !moveTargetBuilding || building === moveTargetBuilding;
    });
  }, [roomOptions, moveTargetBuilding]);

  const filteredExportRoomOptions = useMemo(() => {
    return roomOptions.filter(r => {
      const parts = r.value.split('|');
      const building = parts[1] || '';
      return !exportRoomBuilding || building === exportRoomBuilding;
    });
  }, [roomOptions, exportRoomBuilding]);

  const activeSelectedBlock = useMemo(() => {
    if (!selectedScheduleBlock) return null;
    const entry = store.instances.find((e) => e.id === selectedScheduleBlock.entry.id);
    if (!entry) return null;
    const schedule = entry.schedules.find((s) => s.id === selectedScheduleBlock.schedule.id);
    if (!schedule) return null;
    return { entry, schedule };
  }, [store.instances, selectedScheduleBlock]);

  useEffect(() => {
    if (roomOptions.length === 0) {
      setActiveRoom(null);
    } else if (!activeRoom) {
      setActiveRoom(roomOptions[0].value);
    } else if (!roomOptions.some((o) => o.value === activeRoom)) {
      setActiveRoom(roomOptions[0].value);
    }
  }, [roomOptions, activeRoom]);

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

  // Load remembered filter settings per timetable
  useEffect(() => {
    if (!timetableId || store.isLoading) return;
    if (lastLoadedFilePathRef.current === timetableId) return;

    lastLoadedFilePathRef.current = timetableId;
    const key = `filter_config_${timetableId}`;
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
  }, [timetableId, store.isLoading]);

  // Save filter settings to localStorage whenever they change
  useEffect(() => {
    if (!timetableId || store.isLoading) return;
    if (lastLoadedFilePathRef.current !== timetableId) return;

    const key = `filter_config_${timetableId}`;
    const config = {
      filterType,
      selectedStudentKey,
      selectedTeacher,
      selectedRooms,
    };
    localStorage.setItem(key, JSON.stringify(config));
  }, [timetableId, store.isLoading, filterType, selectedStudentKey, selectedTeacher, selectedRooms]);

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
        return entryRooms.some((r) =>
          selectedRooms
            .map((sr) => sr.split('|')[0].trim().toLowerCase())
            .includes(r)
        );
      });
    }
    return store.instances;
  }, [store.instances, filterType, selectedStudentKey, selectedTeacher, selectedRooms]);

  const gridEntries = useMemo(() => {
    if (!activeRoom) return [];
    const activeRoomName = activeRoom.includes('|')
      ? activeRoom.split('|')[0].trim().toLowerCase()
      : activeRoom.trim().toLowerCase();
    const activeRoomFull = activeRoom.trim().toLowerCase();
    return filteredEntries
      .map((e) => {
        const roomSchedules = e.schedules.filter((s) =>
          s.rooms && s.rooms.some((r) => {
            const trimmed = r.trim().toLowerCase();
            if (trimmed === activeRoomFull) return true;
            if (!trimmed.includes('|') && trimmed === activeRoomName) return true;
            return false;
          })
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

  // Save (Ctrl+S): save to .ttcl or prompt for path on first save
  useEffect(() => {
    if (saveTrigger === 0 || saveTrigger <= lastSaveTriggerRef.current) {
      lastSaveTriggerRef.current = saveTrigger;
      return;
    }
    lastSaveTriggerRef.current = saveTrigger;

    async function handleSave() {
      if (collection.collectionPath) {
        try {
          await collection.saveCollection();
          store.markSaved();
          setStatusMessage('Saved');
        } catch (e: unknown) {
          messageApi.error(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      } else {
        const resolvedPath = await invoke<string>('resolve_default_path', { filename: `${timetableName}.ttcl` });
        const selectedPath = await save({
          title: 'Save Collection',
          defaultPath: resolvedPath,
          filters: [{ name: 'Timetable Collection', extensions: ['ttcl'] }]
        });
        if (!selectedPath) return;
        try {
          await collection.saveCollectionAs(selectedPath);
          store.markSaved();
          setStatusMessage('Saved');
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
        'This timetable currently contains scheduling conflicts. Are you sure you want to proceed?',
        {
          title: 'Export Warning',
          kind: 'warning',
          okLabel: 'Proceed Anyway',
          cancelLabel: 'Cancel',
        }
      );
      if (!confirmExport) return;
    }

    const resolvedPath = await invoke<string>('resolve_default_path', { filename: `${timetableName}` });
    const selectedPath = await save({
      title: 'Save As',
      defaultPath: resolvedPath,
      filters: [
        { name: 'Timetable Collection', extensions: ['ttcl'] },
        { name: 'JSON Data', extensions: ['json'] },
        { name: 'Excel Workbook', extensions: ['xlsx'] },
      ]
    });

    if (!selectedPath) return;

    if (selectedPath.toLowerCase().endsWith('.ttcl')) {
      try {
        if (collection.collectionPath === selectedPath) {
          await collection.saveCollection();
        } else {
          await collection.saveCollectionAs(selectedPath);
        }
        store.markSaved();
        setStatusMessage('Saved');
      } catch (e: unknown) {
        messageApi.error(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
      }
      return;
    }

    // For .json, export all data directly — no filter modal
    if (selectedPath.toLowerCase().endsWith('.json')) {
      const saveObj = {
        version: 2,
        blueprints: store.blueprints,
        instances: store.instances,
        dynamicData: store.dynamicData,
      };
      const json = JSON.stringify(saveObj, null, 2);
      const bytes = Array.from(new TextEncoder().encode(json));
      try {
        await invoke('save_file_bytes', { path: selectedPath, bytes });
        messageApi.success(`Exported JSON to ${selectedPath.split(/[\\\/]/).pop()}`);
      } catch (e: unknown) {
        messageApi.error(`JSON save failed: ${e instanceof Error ? e.message : String(e)}`);
      }
      return;
    }

    // For XLSX, show filter modal first
    setExportFilterType('current');
    setExportSelectedRooms([]);
    setExportExactMatch(false);
    setPendingExportPath(selectedPath);
    setExportModalOpen(true);
  }

  async function proceedWithSaveAs() {
    setExportModalOpen(false);
    const selectedPath = pendingExportPath;
    setPendingExportPath(null);
    if (!selectedPath) return;

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
          entriesToProcess, `${timetableName}.xlsx`,
          store.hiddenDays, prefs.excludeHiddenDays, viewStart, viewEnd, prefs.excludeTimeWindow,
          selectedPath,
        );
        messageApi.success(`Exported Excel to ${selectedPath.split(/[\\\/]/).pop()}`);
      } catch (e: unknown) {
        messageApi.error(`Excel export failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else if (selectedPath.toLowerCase().endsWith('.json')) {
      const saveObj = {
        version: 2,
        blueprints: store.blueprints,
        instances: store.instances,
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

  // Save As trigger (Ctrl+Shift+S): call handleSaveAs directly
  useEffect(() => {
    if (exportTrigger === 0 || exportTrigger <= lastExportTriggerRef.current) {
      lastExportTriggerRef.current = exportTrigger;
      return;
    }
    lastExportTriggerRef.current = exportTrigger;
    void handleSaveAs();
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

  // Export JSON Data: export collection data as shareable JSON
  useEffect(() => {
    if (exportJsonTrigger === 0 || exportJsonTrigger <= lastExportJsonTriggerRef.current) {
      lastExportJsonTriggerRef.current = exportJsonTrigger;
      return;
    }
    lastExportJsonTriggerRef.current = exportJsonTrigger;

    async function handleExportJson() {
      const resolvedPath = await invoke<string>('resolve_default_path', { filename: `${timetableName}.json` });
      const selectedPath = await save({
        title: 'Export JSON Data',
        defaultPath: resolvedPath,
        filters: [{ name: 'JSON Data', extensions: ['json'] }],
      });
      if (!selectedPath) return;

      const saveObj = {
        version: 2,
        blueprints: store.blueprints,
        instances: store.instances,
        dynamicData: store.dynamicData,
      };
      const json = JSON.stringify(saveObj, null, 2);
      const bytes = Array.from(new TextEncoder().encode(json));

      try {
        await invoke('save_file_bytes', { path: selectedPath, bytes });
        messageApi.success(`Exported JSON to ${selectedPath.split(/[\\\/]/).pop()}`);
      } catch (e: unknown) {
        messageApi.error(`JSON export failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    void handleExportJson();
  }, [exportJsonTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  // Export Room Timetable (Excel)
  useEffect(() => {
    if (exportExcelRoomTrigger === 0 || exportExcelRoomTrigger <= lastExportExcelRoomTriggerRef.current) {
      lastExportExcelRoomTriggerRef.current = exportExcelRoomTrigger;
      return;
    }
    lastExportExcelRoomTriggerRef.current = exportExcelRoomTrigger;
    setExportRoomBuilding(null);
    setExportRoomRoom(null);
    setExportRoomModalOpen(true);
  }, [exportExcelRoomTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  // Import Blueprints from Excel
  useEffect(() => {
    if (importExcelTrigger === 0 || importExcelTrigger <= lastImportExcelTriggerRef.current) {
      lastImportExcelTriggerRef.current = importExcelTrigger;
      return;
    }
    lastImportExcelTriggerRef.current = importExcelTrigger;
    setImportExcelModalOpen(true);
  }, [importExcelTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFormSubmit = useCallback((entry: SubjectEntry) => {
    return store.addBlueprint(entry);
  }, [store]);

  const handleEdit = useCallback((entry: SubjectEntry): void => {
    store.startEdit(entry.id);
  }, [store]);

  const handleCancelEdit = useCallback((): void => {
    store.cancelEdit();
    setSelectedScheduleBlock(null);
    setSelectedBlockKeys(new Set());
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

  const handleToggleSelectBlock = useCallback((blockKey: string) => {
    setSelectedBlockKeys((prev) => {
      const next = new Set(prev);
      const focused = selectedScheduleBlockRef.current;
      if (focused) {
        const focusedKey = `${focused.entry.id}:${focused.schedule.id}`;
        if (!next.has(focusedKey) && focusedKey !== blockKey) {
          next.add(focusedKey);
        }
      }
      if (next.has(blockKey)) next.delete(blockKey);
      else next.add(blockKey);
      return next;
    });
    setSelectedScheduleBlock(null);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedBlockKeys(new Set());
  }, []);

  const handleCopyBlocks = useCallback((blockKeys: string[]) => {
    const blocks: Array<{ entryId: string; schedule: Schedule }> = [];
    const seen = new Set<string>();
    for (const key of blockKeys) {
      if (seen.has(key)) continue;
      seen.add(key);
      const [entryId, scheduleId] = key.split(':');
      const entry = store.instances.find(e => e.id === entryId);
      if (!entry) continue;
      const schedule = entry.schedules.find(s => s.id === scheduleId);
      if (!schedule) continue;
      blocks.push({ entryId, schedule: { ...schedule } });
    }
    setClipboardBlocks(blocks);
    messageApi.success(`Copied ${blocks.length} block(s)`);
  }, [store.instances, messageApi]);

  const handlePasteBlocks = useCallback(() => {
    if (clipboardBlocks.length === 0) return;
    const newSelectedKeys: string[] = [];
    const newEntries: SubjectEntry[] = [];
    for (const { entryId, schedule } of clipboardBlocks) {
      const originalEntry = store.instances.find(e => e.id === entryId);
      if (!originalEntry) continue;
      const newId = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const newSchedId = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const newSched: Schedule = {
        ...schedule,
        id: newSchedId,
        rooms: schedule.rooms || [],
      };
      newEntries.push({
        id: newId,
        subjectCode: originalEntry.subjectCode,
        offerCode: originalEntry.offerCode,
        subjectDescription: originalEntry.subjectDescription,
        assignedTeacherName: originalEntry.assignedTeacherName,
        program: originalEntry.program,
        year: originalEntry.year,
        section: originalEntry.section,
        department: originalEntry.department,
        color: originalEntry.color,
        schedules: [newSched],
      });
      newSelectedKeys.push(`${newId}:${newSchedId}`);
    }
    if (newEntries.length === 0) return;
    store.addInstances(newEntries);
    setSelectedBlockKeys(new Set(newSelectedKeys));
    messageApi.success(`Pasted ${newEntries.length} block(s)`);
  }, [clipboardBlocks, store, messageApi]);

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

  const handleExcelImport = useCallback(async (payload: {
    mapping: Record<string, string>;
    includeSchedule: boolean;
    timeFormat: 'auto' | '12h' | '24h';
    scheduleMapping: Record<string, string>;
    autoCreateMissing?: boolean;
    autoFixConflicts?: boolean;
    allowAnyRoom?: boolean;
    limitToBuilding?: boolean;
  }) => {
    const {
      mapping,
      includeSchedule,
      timeFormat,
      scheduleMapping,
      autoCreateMissing = false,
      autoFixConflicts = false,
      allowAnyRoom = false,
      limitToBuilding = false,
    } = payload;
    setImportExcelLoading(true);

    const notifications: string[] = [];
    const skipped: string[] = [];
    const blueprintMap = new Map<string, SubjectEntry>();
    const blueprintsToAdd: SubjectEntry[] = [];
    const instancesToAdd: SubjectEntry[] = [];
    const linkPairs: Array<{ childKey: string; parentKey: string }> = [];
    const missingPrograms = new Set<string>();
    const missingSections = new Set<string>();
    const missingYears = new Set<string>();
    const missingDepartments = new Set<string>();
    const missingBuildings = new Set<string>();

    function colLettersToIndex(letters: string): number {
      let index = 0;
      for (let i = 0; i < letters.length; i++) {
        index = index * 26 + (letters.charCodeAt(i) - 64);
      }
      return index - 1;
    }

    function buildColMap(mp: Record<string, string>): Record<string, number> {
      const result: Record<string, number> = {};
      for (const [f, letter] of Object.entries(mp)) {
        if (letter) result[f] = colLettersToIndex(letter.toUpperCase());
      }
      return result;
    }

    function cleanTimeVal(raw: string, fmt: 'auto' | '12h' | '24h'): string | null {
      const s = raw.trim();
      if (!s || /^[\s\-—–_]+$/.test(s) || s === '0' || s === '0:00') return null;

      const lower = s.toLowerCase().replace(/\s+/g, '');
      const match12 = lower.match(/^(\d{1,2}):(\d{2})(a|p|am|pm)$/);
      if (match12) {
        let h = parseInt(match12[1], 10);
        const m = match12[2];
        const mer = match12[3];
        if (mer.startsWith('p') && h !== 12) h += 12;
        if (mer.startsWith('a') && h === 12) h = 0;
        return `${h.toString().padStart(2, '0')}:${m}`;
      }

      if (fmt === '12h') return null;

      const cleaned = s.replace(/[^\d:]/g, '');
      const match24 = cleaned.match(/^(\d{1,2}):(\d{2})$/);
      if (!match24) return null;
      let h = parseInt(match24[1], 10);
      const m = match24[2];
      if (h > 23) return null;
      return `${h.toString().padStart(2, '0')}:${m}`;
    }

    function instructorExists(dd: DynamicData[], firstName: string, middleName: string, lastName: string): boolean {
      return dd.some((d) => {
        if (d.dataType !== 'instructor') return false;
        const p = parseInstructorValue(d.value);
        return p.firstName.toLowerCase() === firstName.toLowerCase() &&
          p.middleName.toLowerCase() === middleName.toLowerCase() &&
          p.lastName.toLowerCase() === lastName.toLowerCase();
      });
    }

    function roomExists(dd: DynamicData[], room: string, building: string): boolean {
      const targetBldg = building || 'External';
      return dd.some((d) => {
        if (d.dataType !== 'room') return false;
        const parts = d.displayAs.split('|');
        const dRoom = d.value.toLowerCase();
        const dBldg = (parts[1] || 'External').toLowerCase();
        return dRoom === room.toLowerCase() && dBldg === targetBldg.toLowerCase();
      });
    }

    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(importExcelFileBytes as any);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) { messageApi.error('No worksheet found'); return; }

      const colMap = buildColMap(mapping);
      const schedColMap = includeSchedule ? buildColMap(scheduleMapping) : {};

      const unknownRooms = new Map<string, { roomName: string; buildingName: string; count: number }>();
      const unknownInstructors = new Map<string, { firstName: string; middleName: string; lastName: string }[]>();

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        const getVal = (mp: Record<string, number>, field: string): string => {
          const idx = mp[field];
          if (idx === undefined) return '';
          const cell = row.getCell(idx + 1);
          return cell.value?.toString()?.trim() || '';
        };

        const subjectCode = getVal(colMap, 'subjectCode');
        const offerCode = getVal(colMap, 'offerCode');

        if (!subjectCode && !offerCode) {
          skipped.push(`Row ${rowNumber}: missing subject code and offer code`);
          return;
        }

        const subjectDescription = getVal(colMap, 'subjectDescription');
        const department = getVal(colMap, 'department');
        const program = getVal(colMap, 'program');
        const yearStr = getVal(colMap, 'year');
        const section = getVal(colMap, 'section');
        const rawBlueprintRoom = getVal(colMap, 'room');
        const blueprintRoom = rawBlueprintRoom.includes(',') ? rawBlueprintRoom.split(',')[0].trim() : rawBlueprintRoom;
        const rawBlueprintBuilding = getVal(colMap, 'building');
        const blueprintBuilding = rawBlueprintBuilding.trim();
        const fullBlueprintRoom = blueprintRoom && blueprintBuilding ? `${blueprintRoom}|${blueprintBuilding}` : blueprintRoom;

        const dynamicData = store.dynamicData;
        const yearNum = parseInt(yearStr, 10);

        if (blueprintBuilding && !dynamicData.some((d: DynamicData) => d.dataType === 'building' && d.value === blueprintBuilding)) {
          if (autoCreateMissing) {
            missingBuildings.add(blueprintBuilding);
          } else {
            skipped.push(`Row ${rowNumber}: unknown building "${blueprintBuilding}"`);
            return;
          }
        }

        if (blueprintRoom) {
          const targetBldg = blueprintBuilding || 'External';
          if (!roomExists(dynamicData, blueprintRoom, targetBldg)) {
            const key = `${blueprintRoom}|${targetBldg}`;
            const existing = unknownRooms.get(key);
            if (existing) {
              existing.count++;
            } else {
              unknownRooms.set(key, { roomName: blueprintRoom, buildingName: targetBldg, count: 1 });
            }
          }
        }

        if (yearStr && isNaN(yearNum)) {
          skipped.push(`Row ${rowNumber}: invalid year "${yearStr}"`);
          return;
        }
        if (program && !dynamicData.some((d: DynamicData) => d.dataType === 'program' && d.value === program)) {
          if (autoCreateMissing) {
            missingPrograms.add(program);
          } else {
            skipped.push(`Row ${rowNumber}: unknown program "${program}"`);
            return;
          }
        }
        if (section && !dynamicData.some((d: DynamicData) => d.dataType === 'section' && d.value === section)) {
          if (autoCreateMissing) {
            missingSections.add(section);
          } else {
            skipped.push(`Row ${rowNumber}: unknown section "${section}"`);
            return;
          }
        }
        if (yearStr && !dynamicData.some((d: DynamicData) => d.dataType === 'year' && d.value === yearStr)) {
          if (autoCreateMissing) {
            missingYears.add(yearStr);
          } else {
            skipped.push(`Row ${rowNumber}: unknown year "${yearStr}"`);
            return;
          }
        }
        if (department && !dynamicData.some((d: DynamicData) => d.dataType === 'department' && d.value === department)) {
          if (autoCreateMissing) {
            missingDepartments.add(department);
          } else {
            skipped.push(`Row ${rowNumber}: unknown department "${department}"`);
            return;
          }
        }

        const bpKey = `${subjectCode}|${offerCode}`;
        if (!blueprintMap.has(bpKey)) {
          const bp: SubjectEntry = {
            id: crypto.randomUUID(),
            subjectCode, offerCode, subjectDescription,
            assignedTeacherName: '',
            program, year: yearNum || 0, section,
            department,
            room: fullBlueprintRoom || '',
            schedules: [],
          };
          blueprintMap.set(bpKey, bp);
          blueprintsToAdd.push(bp);
        }

        if (!includeSchedule) return;

        const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const DAY_KEYS = ['monIn', 'monOut', 'tueIn', 'tueOut', 'wedIn', 'wedOut', 'thuIn', 'thuOut', 'friIn', 'friOut', 'satIn', 'satOut', 'sunIn', 'sunOut'];

        const rawRoom = getVal(schedColMap, 'room');
        const rowRooms = rawRoom.split(',').map((r) => r.trim()).filter(Boolean);
        let roomIndex = 0;

        for (let d = 0; d < 7; d++) {
          const startRaw = getVal(schedColMap, DAY_KEYS[d * 2]);
          const endRaw = getVal(schedColMap, DAY_KEYS[d * 2 + 1]);

          const startTime = cleanTimeVal(startRaw, timeFormat);
          const endTime = cleanTimeVal(endRaw, timeFormat);

          if (!startTime && !endTime) continue;

          if (startRaw && !startTime) {
            notifications.push(`Row ${rowNumber}: invalid start time format for ${DAYS[d]}`);
            continue;
          }
          if (endRaw && !endTime) {
            notifications.push(`Row ${rowNumber}: invalid end time format for ${DAYS[d]}`);
            continue;
          }
          if (!startTime || !endTime) {
            notifications.push(`Row ${rowNumber}: incomplete time for ${DAYS[d]} (need both start and end)`);
            continue;
          }

          const firstName = getVal(schedColMap, 'firstName');
          const middleName = getVal(schedColMap, 'middleName');
          const lastName = getVal(schedColMap, 'lastName');

          if ((firstName || middleName || lastName) && !instructorExists(dynamicData, firstName, middleName, lastName)) {
            const displayName = `${lastName}, ${firstName} ${middleName}`.trim();
            if (!unknownInstructors.has(displayName)) {
              unknownInstructors.set(displayName, []);
            }
            unknownInstructors.get(displayName)!.push({ firstName, middleName, lastName });
          }

          const instructorDisplayName = formatInstructorDisplay(firstName, middleName, lastName);

          const schedId = crypto.randomUUID();
          const instanceId = crypto.randomUUID();
          const dummySched: Schedule = {
            id: schedId,
            days: [DAYS[d]],
            startTime,
            endTime,
            rooms: [],
            assignedTeacherName: instructorDisplayName || undefined,
          };
          const dummyInstance: SubjectEntry = {
            id: instanceId,
            subjectCode, offerCode, subjectDescription,
            assignedTeacherName: instructorDisplayName,
            room: '',
            program, year: yearNum || 0, section,
            department,
            schedules: [dummySched],
            blueprintId: blueprintMap.get(bpKey)!.id,
          };

          const resolution = resolveRoomForSchedule({
            schedule: dummySched,
            candidateEntry: dummyInstance,
            instancesToAdd,
            storeInstances: store.instances,
            dynamicData,
            detectConflicts: store.detectConflicts,
            rowRooms,
            blueprintBuilding,
            autoFixConflicts,
            allowAnyRoom,
            limitToBuilding,
            roomIndex,
          });

          const finalRoomVal = resolution.roomVal;
          roomIndex = resolution.nextRoomIndex;

          if (finalRoomVal) {
            const parts = finalRoomVal.split('|');
            const rVal = parts[0];
            const bVal = parts[1] || 'External';
            if (!roomExists(dynamicData, rVal, bVal)) {
              const key = `${rVal}|${bVal}`;
              const existing = unknownRooms.get(key);
              if (existing) {
                existing.count++;
              } else {
                unknownRooms.set(key, { roomName: rVal, buildingName: bVal, count: 1 });
              }
            }
          }

          const schedule: Schedule = {
            ...dummySched,
            rooms: finalRoomVal ? [finalRoomVal] : [],
          };

          const instance: SubjectEntry = {
            ...dummyInstance,
            room: finalRoomVal || '',
            schedules: [schedule],
          };
          instancesToAdd.push(instance);
        }
      });

      if (autoCreateMissing) {
        for (const programVal of missingPrograms) {
          await store.addDynamicData('program', programVal, programVal);
          notifications.push(`Created program "${programVal}"`);
        }
        for (const sectionVal of missingSections) {
          await store.addDynamicData('section', sectionVal, sectionVal);
          notifications.push(`Created section "${sectionVal}"`);
        }
        for (const yearVal of missingYears) {
          await store.addDynamicData('year', yearVal, yearVal);
          notifications.push(`Created year "${yearVal}"`);
        }
        for (const deptVal of missingDepartments) {
          await store.addDynamicData('department', deptVal, deptVal);
          notifications.push(`Created department "${deptVal}"`);
        }
        for (const bldgVal of missingBuildings) {
          if (!store.dynamicData.some((d: DynamicData) => d.dataType === 'building' && d.value === bldgVal)) {
            await store.addDynamicData('building', bldgVal, bldgVal);
            notifications.push(`Created building "${bldgVal}"`);
          }
        }
        for (const [, info] of unknownRooms) {
          const displayAs = `${info.roomName}|${info.buildingName}`;
          await store.addDynamicData('room', info.roomName, displayAs);
          notifications.push(`Created room "${info.roomName}" in building "${info.buildingName}"`);
        }

        if (includeSchedule) {
          for (const [, instDetails] of unknownInstructors) {
            const addedNames = new Set<string>();
            for (const inst of instDetails) {
              const key = `${inst.lastName}|${inst.firstName}|${inst.middleName}`.toLowerCase();
              if (addedNames.has(key)) continue;
              addedNames.add(key);
              const value = formatInstructorValue(inst.firstName, inst.middleName, inst.lastName);
              const displayAs = formatInstructorDisplay(inst.firstName, inst.middleName, inst.lastName);
              await store.addDynamicData('instructor', value, displayAs);
            }
          }
        }
      }

      if (blueprintsToAdd.length > 0 || instancesToAdd.length > 0) {
        store.addBlueprintsAndInstances(blueprintsToAdd, instancesToAdd);
      }

      if (instancesToAdd.length > 0) {

        const groups = new Map<string, SubjectEntry[]>();
        for (const inst of instancesToAdd) {
          const key = `${inst.subjectCode}|${inst.offerCode}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(inst);
        }
        for (const [, group] of groups) {
          if (group.length < 2) continue;
          const parent = group[0];
          for (let i = 1; i < group.length; i++) {
            const child = group[i];
            const parentKey = `${parent.id}:${parent.schedules[0]?.id}`;
            const childKey = `${child.id}:${child.schedules[0]?.id}`;
            if (parentKey && childKey) {
              linkPairs.push({ childKey, parentKey });
            }
          }
        }

        if (linkPairs.length > 0 && store.addLinksBatched) {
          await store.addLinksBatched(linkPairs);
        } else if (linkPairs.length > 0) {
          for (const { childKey, parentKey } of linkPairs) {
            await store.addDynamicData('link', childKey, parentKey);
          }
        }
      }

      if (!autoCreateMissing) {
        for (const [, info] of unknownRooms) {
          notifications.push(`${info.count} row(s) reference unknown room "${info.roomName}" in building "${info.buildingName}"`);
        }
        for (const [displayName] of unknownInstructors) {
          notifications.push(`1 row(s) reference unknown instructor "${displayName}"`);
        }
      }

      const msg = `Imported ${blueprintsToAdd.length} blueprint(s)`;
      const schedMsg = includeSchedule ? `, ${instancesToAdd.length} schedule(s) placed, ${linkPairs.length} link(s) created` : '';
      messageApi.success(msg + schedMsg);

      setImportExcelSkipped(skipped);
      if (skipped.length > 0) setImportExcelSkippedDrawerOpen(true);

      setImportNotifications(notifications);

      if (notifications.length > 0) {
        notificationApi.warning({
          message: 'Import Notifications',
          description: (
            <div style={{ whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>
              {notifications.map((n, i) => (
                <div key={i} style={{ marginBottom: 4 }}>• {n}</div>
              ))}
            </div>
          ),
          duration: 10,
        });
      }

      setImportExcelModalOpen(false);
      setImportExcelFileBytes(null);
      setImportExcelFileName('');
      setImportExcelMapping({});
      setImportExcelScheduleMapping({});
    } catch (e: unknown) {
      messageApi.error(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setImportExcelLoading(false);
    }
  }, [importExcelFileBytes, store, messageApi, notificationApi]);

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
    const entry = store.blueprints.find((e) => e.id === entryId);
    if (!entry) return;

    // Floating ghost that follows cursor
    const ghost = document.createElement('div');
    ghost.id = 'custom-drag-ghost';
    ghost.style.cssText = [
      'position: fixed',
      'pointer-events: none',
      'z-index: 9999999',
      'opacity: 0.9',
      'box-shadow: 0 4px 16px rgba(0,0,0,0.18)',
      'background: #FFFFFF',
      'border: 2px solid #2B4C7E',
      'border-radius: 6px',
      'padding: 6px 10px',
      'font-size: 11px',
      'font-weight: 700',
      'color: #1E3560',
      'display: flex',
      'align-items: center',
      'gap: 6px',
      'left: 0',
      'top: 0',
      'will-change: transform',
    ].join(';');
    ghost.innerHTML = `<span style="background:#2B4C7E;color:#fff;padding:0 6px;border-radius:4px;font-size:10px;font-weight:700">${entry.subjectCode}</span><span>${entry.offerCode}</span>`;
    document.body.appendChild(ghost);
    gsap.set(ghost, { x: clientX + 12, y: clientY + 12 });

    // Drop-preview ghost in grid (created lazily on first grid hover)
    let previewGhost: HTMLDivElement | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      gsap.set(ghost, { x: e.clientX + 12, y: e.clientY + 12 });

      // Check if cursor is over a grid day column
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const columnEl = el ? el.closest<HTMLElement>('.grid-day-column') : null;
      if (columnEl) {
        const room = columnEl.getAttribute('data-room') || '';
        if (!room) {
          if (previewGhost) { previewGhost.remove(); previewGhost = null; }
          return;
        }
        const rect = columnEl.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        const slotIndex = Math.max(0, Math.floor((relativeY - 32) / 36));
        const topPx = slotIndex * 36;

        if (!previewGhost) {
          previewGhost = document.createElement('div');
          previewGhost.className = 'ghost-pulse';
          previewGhost.style.cssText = [
            'position: absolute',
            'pointer-events: none',
            'z-index: 99998',
            'border: 2px dashed #2B4C7E',
            'border-radius: 3px',
            'background: rgba(59,130,246,0.08)',
            'opacity: 0.85',
            'box-sizing: border-box',
          ].join(';');
          columnEl.appendChild(previewGhost);
        } else if (previewGhost.parentElement !== columnEl) {
          previewGhost.remove();
          columnEl.appendChild(previewGhost);
        }

        gsap.set(previewGhost, { top: topPx + 1, left: 2, right: 2, height: 34 });
      } else {
        if (previewGhost) { previewGhost.remove(); previewGhost = null; }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      ghost.remove();
      if (previewGhost) previewGhost.remove();
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const columnEl = el ? el.closest('.grid-day-column') : null;
      if (columnEl) {
        const day = columnEl.getAttribute('data-day-column') as DayOfWeek;
        const room = columnEl.getAttribute('data-room') || '';
        if (!room) {
          messageApi.warning('Please select a Room Timetable first.');
          return;
        }
        const rect = columnEl.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        const slotIndex = Math.max(0, Math.floor((relativeY - 32) / 36));
        const startMin = viewStart + slotIndex * 30;
        handleDropEntry(entryId, day, startMin, room);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [store.blueprints, viewStart, handleDropEntry, messageApi]);

  const handleDeleteSchedule = useCallback((entryId: string, _scheduleId: string) => {
    store.deleteInstance(entryId);
  }, [store]);

  const handleMoveRoom = useCallback((blockKey: string) => {
    setMoveRoomBlockKey(blockKey);
    setMoveTargetBuilding(null);
    setMoveTargetRoom(null);
    setMoveRoomOpen(true);
  }, []);

  const handleConfirmMoveRoom = useCallback(async () => {
    if (!moveRoomBlockKey || !moveTargetRoom || !moveTargetBuilding) return;
    const [entryId, scheduleId] = moveRoomBlockKey.split(':');
    const entry = store.instances.find(e => e.id === entryId);
    if (!entry) return;
    const schedule = entry.schedules.find(s => s.id === scheduleId);
    if (!schedule) return;

    // Unlink all links involving this block
    for (const d of store.dynamicData) {
      if (d.dataType === 'link' && (d.value === moveRoomBlockKey || d.displayAs === moveRoomBlockKey)) {
        await store.deleteDynamicData(d.id);
      }
    }

    const newRoomValue = `${moveTargetRoom}|${moveTargetBuilding}`;
    const updatedSchedule = { ...schedule, rooms: [newRoomValue] };
    const updatedSchedules = entry.schedules.map(s => s.id === scheduleId ? updatedSchedule : s);
    const updatedEntry = { ...entry, schedules: updatedSchedules, room: newRoomValue };
    store.updateInstance(updatedEntry, scheduleId);
    setMoveRoomOpen(false);
    setMoveRoomBlockKey(null);
    messageApi.success('Schedule moved to new room');
  }, [moveRoomBlockKey, moveTargetRoom, moveTargetBuilding, store, messageApi]);

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
  function validateSubjectEntry(item: Record<string, unknown>): SubjectEntry | null {
    if (!item || typeof item.subjectCode !== 'string' || typeof item.offerCode !== 'string') return null;
    const rawSchedules = item.schedules;
    const schedules: Schedule[] = Array.isArray(rawSchedules)
      ? (rawSchedules as Record<string, unknown>[]).map((s) => ({
          id: typeof s.id === 'string' ? s.id : Math.random().toString(36).slice(2) + Date.now().toString(36),
          days: Array.isArray(s.days) ? (s.days as DayOfWeek[]) : [],
          startTime: typeof s.startTime === 'string' ? s.startTime : '',
          endTime: typeof s.endTime === 'string' ? s.endTime : '',
          rooms: Array.isArray(s.rooms) ? (s.rooms as string[]) : [],
        }))
      : [];
    return {
      id: typeof item.id === 'string' ? item.id : Math.random().toString(36).slice(2) + Date.now().toString(36),
      subjectCode: item.subjectCode as string,
      offerCode: item.offerCode as string,
      subjectDescription: typeof item.subjectDescription === 'string' ? item.subjectDescription : '',
      assignedTeacherName: typeof item.assignedTeacherName === 'string' ? item.assignedTeacherName : '',
      room: typeof item.room === 'string' ? item.room : '',
      schedules,
      program: typeof item.program === 'string' ? item.program : '',
      year: typeof item.year === 'number' ? item.year : 1,
      section: typeof item.section === 'string' ? item.section : '',
    };
  }

  function validateDynamicDataItem(item: Record<string, unknown>): DynamicData | null {
    if (!item || typeof item.dataType !== 'string') return null;
    return {
      id: typeof item.id === 'string' ? item.id : Math.random().toString(36).slice(2) + Date.now().toString(36),
      dataType: item.dataType as string,
      value: typeof item.value === 'string' ? item.value : '',
      displayAs: typeof item.displayAs === 'string' ? item.displayAs : '',
    };
  }

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

      let blueprintsToImport: SubjectEntry[] = [];
      let instancesToImport: SubjectEntry[] = [];
      let dynamicDataToImport: DynamicData[] | null = null;

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>;

        if (obj.version === 2) {
          // New format: { version: 2, blueprints, instances, dynamicData }
          if (Array.isArray(obj.blueprints)) {
            blueprintsToImport = (obj.blueprints as Record<string, unknown>[])
              .map((item) => validateSubjectEntry(item))
              .filter((e): e is SubjectEntry => e !== null);
          }
          if (Array.isArray(obj.instances)) {
            instancesToImport = (obj.instances as Record<string, unknown>[])
              .map((item) => validateSubjectEntry(item))
              .filter((e): e is SubjectEntry => e !== null);
          }
          if (Array.isArray(obj.dynamicData)) {
            dynamicDataToImport = (obj.dynamicData as Record<string, unknown>[])
              .map((item) => validateDynamicDataItem(item))
              .filter((e): e is DynamicData => e !== null);
          }
        } else if (Array.isArray(obj.entries)) {
          // Legacy v1: { entries, dynamicData }
          instancesToImport = (obj.entries as Record<string, unknown>[])
            .map((item) => validateSubjectEntry(item))
            .filter((e): e is SubjectEntry => e !== null);
          if (Array.isArray(obj.dynamicData)) {
            dynamicDataToImport = (obj.dynamicData as Record<string, unknown>[])
              .map((item) => validateDynamicDataItem(item))
              .filter((e): e is DynamicData => e !== null);
          }
        } else {
          throw new Error('Unrecognized JSON format. Expected version 2, or legacy { entries, dynamicData } format.');
        }
      } else if (Array.isArray(parsed)) {
        // Legacy bare array
        instancesToImport = (parsed as Record<string, unknown>[])
          .map((item) => validateSubjectEntry(item))
          .filter((e): e is SubjectEntry => e !== null);
      } else {
        throw new Error('Invalid JSON format. Expected an object or array.');
      }

      const summaryLines: string[] = ['Import complete.', ''];

      // Import blueprints
      if (blueprintsToImport.length > 0) {
        const bpResult = store.mergeBlueprints(blueprintsToImport);
        summaryLines.push(
          `Blueprints: ${bpResult.addedCount} added, ${bpResult.updatedCount} updated, ${bpResult.skippedCount} skipped`
        );
      }

      // Import instances
      if (instancesToImport.length > 0) {
        const instResult = store.mergeEntries(instancesToImport);
        summaryLines.push(
          `Instances: ${instResult.successCount} merged, ${instResult.skippedCount} skipped`
        );
      }

      // Import dynamic data
      if (dynamicDataToImport && dynamicDataToImport.length > 0) {
        const ddResult = store.mergeDynamicData(dynamicDataToImport);
        summaryLines.push(
          `Toolbar data: ${ddResult.addedCount} added, ${ddResult.skippedCount} skipped`
        );
      }

      if (summaryLines.length <= 2) {
        throw new Error('No valid data found in the file.');
      }

      const { message: nativeMessage } = await import('@tauri-apps/plugin-dialog');
      await nativeMessage(summaryLines.join('\n'), { title: 'Import Summary', kind: 'info' });
    } catch (e: unknown) {
      messageApi.error(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
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
        {notificationContextHolder}

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
          roomOptions={roomOptions}
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
              padding: '12px 12px 0',
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
                onMoveRoom={handleMoveRoom}
                selectedBlockKeys={selectedBlockKeys}
                onToggleSelectBlock={handleToggleSelectBlock}
                onClearSelection={handleClearSelection}
                onCopyBlocks={handleCopyBlocks}
                onPasteBlocks={handlePasteBlocks}
                canPaste={clipboardBlocks.length > 0}
              />
            </div>
          </div>

          {/* Right Slide-in Schedules Panel / Schedule Properties */}
          {activeSelectedBlock ? (
            <SchedulePropertiesPanel
              disabled={selectedBlockKeys.size > 1}
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
          fileName={collection.collectionPath ? collection.collectionPath.split(/[/\\]/).pop() ?? null : null}
          linkingModeActive={linkingModeActive}
          onToggleLinkingMode={handleToggleLinkingMode}
          roomOptions={roomOptions}
          activeRoom={activeRoom}
          onActiveRoomChange={setActiveRoom}
          linkingFirstBlockKey={linkingFirstBlockKey}
          allConflictsList={allConflictsList}
          onHighlightSchedule={handleHighlightSchedule}
          isDirty={store.isDirty}
          statusMessage={statusMessage}
          theme={store.theme}
          importNotifications={importNotifications}
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
          onOk={proceedWithSaveAs}
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
                      options={roomOptions}
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

      {/* Ghost element is now created as a raw DOM node for performance */}

      {/* ── Move Room Modal ────────────────────────────────────────── */}
      <Modal
        title="Move Schedule to Another Room"
        open={moveRoomOpen}
        onOk={handleConfirmMoveRoom}
        onCancel={() => { setMoveRoomOpen(false); setMoveRoomBlockKey(null); }}
        okText="Move"
        okButtonProps={{ disabled: !moveTargetRoom || !moveTargetBuilding }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>Building</div>
            <Select
              style={{ width: '100%' }}
              placeholder="Select building"
              value={moveTargetBuilding}
              onChange={(val) => { setMoveTargetBuilding(val); setMoveTargetRoom(null); }}
              options={buildingOptions}
              allowClear
            />
          </div>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>Room</div>
            <Select
              style={{ width: '100%' }}
              placeholder="Select room"
              value={moveTargetRoom}
              onChange={(val) => setMoveTargetRoom(val)}
              options={filteredRoomOptions}
              allowClear
            />
          </div>
        </Space>
      </Modal>

      {/* ── Export Room Timetable (Excel) Modal ────────────────────── */}
      <Modal
        title="Export Room Timetable to Excel"
        open={exportRoomModalOpen}
        onOk={async () => {
          if (!exportRoomRoom) return;
          setExportRoomModalOpen(false);
          const resolvedPath = await invoke<string>('resolve_default_path', { filename: `${timetableName}_${exportRoomRoom.replace(/[|]/g, '_')}.xlsx` });
          const selectedPath = await save({
            title: 'Export Room Timetable',
            defaultPath: resolvedPath,
            filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
          });
          if (!selectedPath) return;
          const entriesToExport = filterEntriesForExport(
            store.instances, store.hiddenDays, true, viewStart, viewEnd, true,
          ).filter((e) =>
            e.schedules.some((s) => {
              const roomVal = s.rooms.length > 0 ? s.rooms[0] : '';
              return roomVal === exportRoomRoom;
            })
          );
          try {
            await exportToXlsx(
              entriesToExport, `${timetableName}_${exportRoomRoom.replace(/[|]/g, '_')}.xlsx`,
              store.hiddenDays, true, viewStart, viewEnd, true,
              selectedPath,
            );
            messageApi.success(`Exported room timetable to ${selectedPath.split(/[\\/]/).pop()}`);
          } catch (e: unknown) {
            messageApi.error(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
          }
        }}
        onCancel={() => setExportRoomModalOpen(false)}
        okText="Export"
        okButtonProps={{ disabled: !exportRoomRoom }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>Building</div>
            <Select
              style={{ width: '100%' }}
              placeholder="Select building"
              value={exportRoomBuilding}
              onChange={(val) => { setExportRoomBuilding(val); setExportRoomRoom(null); }}
              options={buildingOptions}
              allowClear
            />
          </div>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>Room</div>
            <Select
              style={{ width: '100%' }}
              placeholder="Select room"
              value={exportRoomRoom}
              onChange={(val) => setExportRoomRoom(val)}
              options={filteredExportRoomOptions}
              allowClear
            />
          </div>
        </Space>
      </Modal>

      {/* ── Import Blueprints from Excel Modal ─────────────────────── */}
      <Modal
        title="Import Blueprints from Excel"
        open={importExcelModalOpen}
        onCancel={() => { setImportExcelModalOpen(false); setImportExcelFileBytes(null); setImportExcelFileName(''); setImportExcelMapping({}); setImportExcelSkipped([]); setImportExcelPreviewRows(undefined); }}
        footer={null}
        width={560}
      >
        {!importExcelFileBytes ? (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Text type="secondary">
              Select an Excel file (.xlsx) containing blueprint data.
            </Text>
            <Button
              onClick={async () => {
                const filePath = await open({
                  title: 'Select Excel File',
                  filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
                  multiple: false,
                  directory: false,
                });
                if (!filePath || typeof filePath !== 'string') return;
                setImportExcelLoading(true);
                try {
                  const bytes = await invoke<number[]>('read_file_bytes', { path: filePath });
                  const uint8 = new Uint8Array(bytes);
                  
                  // Auto-detect column mapping from header row
                  let bpDetected = {};
                  let schedDetected = {};
                  let rawRows: string[][] = [];
                  try {
                    const workbook = new ExcelJS.Workbook();
                    await workbook.xlsx.load(uint8 as any);
                    const worksheet = workbook.worksheets[0];
                    if (worksheet) {
                      bpDetected = detectBlueprintColumns(worksheet);
                      schedDetected = detectScheduleColumns(worksheet);

                      // Extract raw preview rows (first 6 data rows)
                      worksheet.eachRow((row, rowNumber) => {
                        if (rowNumber === 1) return;
                        if (rawRows.length >= 6) return false;
                        const rowData: string[] = [];
                        row.eachCell({ includeEmpty: true }, (cell: any) => {
                          rowData.push(cell.value?.toString()?.trim() || '');
                        });
                        rawRows.push(rowData);
                      });
                    }
                  } catch {
                    bpDetected = {};
                    schedDetected = {};
                    rawRows = [];
                  }

                  // Set all states in a single batch after the await is completed
                  setImportExcelMapping(bpDetected);
                  setImportExcelScheduleMapping(schedDetected);
                  setImportExcelPreviewRows(rawRows.length > 0 ? rawRows : undefined);
                  setImportExcelFileName(filePath.split(/[\\/]/).pop() || '');
                  setImportExcelFileBytes(uint8);
                } catch (e: unknown) {
                  messageApi.error(`Failed to read file: ${e instanceof Error ? e.message : String(e)}`);
                } finally {
                  setImportExcelLoading(false);
                }
              }}
              loading={importExcelLoading}
            >
              Select Excel File
            </Button>
            {importExcelFileName && (
              <Text style={{ fontSize: 12 }}>Selected: {importExcelFileName}</Text>
            )}
          </Space>
        ) : (
          <ColumnMappingForm
            key={importExcelFileName}
            initialMapping={importExcelMapping}
            initialScheduleMapping={importExcelScheduleMapping}
            onImport={handleExcelImport}
            loading={importExcelLoading}
            onSearchAllColumns={async () => {
              if (!importExcelFileBytes) return { mapping: {}, scheduleMapping: {} };
              const wb = new ExcelJS.Workbook();
              await wb.xlsx.load(importExcelFileBytes as any);
              const ws = wb.worksheets[0];
              if (!ws) return { mapping: {}, scheduleMapping: {} };
              const bpDetected = detectBlueprintColumns(ws);
              const schedDetected = detectScheduleColumns(ws);
              return { mapping: bpDetected, scheduleMapping: schedDetected };
            }}
            worksheetRows={importExcelPreviewRows}
          />
        )}
      </Modal>

      {/* Skipped Rows Drawer */}
      <Drawer
        title="Skipped Rows"
        placement="right"
        width={400}
        onClose={() => setImportExcelSkippedDrawerOpen(false)}
        open={importExcelSkippedDrawerOpen}
      >
        {importExcelSkipped.length === 0 ? (
          <Text type="secondary">No rows were skipped.</Text>
        ) : (
          <List
            size="small"
            dataSource={importExcelSkipped}
            renderItem={(item) => <List.Item><Text style={{ fontSize: 12 }}>{item}</Text></List.Item>}
          />
        )}
      </Drawer>
    </ConfigProvider>
  );
}
