import { useMemo, useState, useEffect, memo, useRef, useLayoutEffect } from 'react';
import { Typography, Tooltip, Popover, Dropdown } from 'antd';
import { DeleteOutlined, AimOutlined, DisconnectOutlined, SwapOutlined, CopyOutlined, HomeOutlined } from '@ant-design/icons';
import gsap from 'gsap';
import type { SubjectEntry, DayOfWeek, Schedule } from '../types';
import { DAY_ORDER } from '../types';
import { colorForSubject, getThemeColors } from '../theme';
import { formatTeacherForDisplay, parseTeacherName } from '../utils/teacherName';
import { minutesTo12Hr, formatTimeTo12Hr } from '../utils/time';

const { Text } = Typography;

interface TimetableGridProps {
  entries: SubjectEntry[];
  hiddenDays: DayOfWeek[];
  viewStart: number;
  viewEnd: number;
  bandedRows: boolean;
  editingEntryId?: string | null;
  onCancelEdit?: () => void;
  onUpdateEntry?: (entry: SubjectEntry) => void;
  onDeleteEntry?: (id: string) => void;
  onDropEntry?: (entryId: string, day: DayOfWeek, startMin: number, room: string) => void;
  onDeleteSchedule?: (entryId: string, scheduleId: string) => void;
  activeRoom: string | null;
  onSelectScheduleBlock?: (entry: SubjectEntry, schedule: Schedule) => void;
  linkingFirstBlockKey?: string | null;
  linkingHighlightedKeys?: Set<string> | null;
  linkingModeActive?: boolean;
  onUnlinkBlock?: (blockKey: string) => void;
  onMoveRoom?: (blockKey: string) => void;
  onMoveToAvailableRoom?: (blockKeys: string[]) => void;
  theme?: string;
  selectedBlockKeys: Set<string>;
  onToggleSelectBlock: (blockKey: string) => void;
  onClearSelection: () => void;
  onCopyBlocks: (blockKeys: string[]) => void;
  onPasteBlocks: () => void;
  canPaste: boolean;
}

interface SlotEntry {
  entry: SubjectEntry;
  day: DayOfWeek;
  startMin: number;
  endMin: number;
  schedule: Schedule;
}

function toMin(time: string): number {
  const parts = time.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function minutesTo24Hr(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, '0');
  const m = (min % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function toTime(min: number): string {
  return minutesTo12Hr(min);
}

const ROW_HEIGHT = 36;
const COL_WIDTH = 130;
const TIME_COL_WIDTH = 72;
const SLOT_INTERVAL = 30;

export const TimetableGrid = memo(function TimetableGrid({
  entries,
  hiddenDays,
  viewStart,
  viewEnd,
  bandedRows,
  editingEntryId,
  onCancelEdit,
  onUpdateEntry,
  onDeleteEntry,
  onDropEntry,
  onDeleteSchedule,
  activeRoom,
  onSelectScheduleBlock,
  linkingFirstBlockKey,
  linkingHighlightedKeys,
  linkingModeActive,
  onUnlinkBlock,
  onMoveRoom,
  onMoveToAvailableRoom,
  theme = 'blue',
  selectedBlockKeys,
  onToggleSelectBlock,
  onClearSelection,
  onCopyBlocks,
  onPasteBlocks,
  canPaste,
}: TimetableGridProps) {
  const selectedBlockKeysRef = useRef(selectedBlockKeys);
  selectedBlockKeysRef.current = selectedBlockKeys;

  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const viewStartRef = useRef(viewStart);
  viewStartRef.current = viewStart;

  const viewEndRef = useRef(viewEnd);
  viewEndRef.current = viewEnd;

  const onUpdateEntryRef = useRef(onUpdateEntry);
  onUpdateEntryRef.current = onUpdateEntry;

  const onToggleSelectBlockRef = useRef(onToggleSelectBlock);
  onToggleSelectBlockRef.current = onToggleSelectBlock;

  const onClearSelectionRef = useRef(onClearSelection);
  onClearSelectionRef.current = onClearSelection;

  const scrollPosRef = useRef({ left: 0, top: 0 });
  const prevActiveRoomRef = useRef(activeRoom);

  useEffect(() => {
    prevActiveRoomRef.current = activeRoom;
  }, [activeRoom]);

  useLayoutEffect(() => {
    if (gridContainerRef.current) {
      gridContainerRef.current.scrollLeft = scrollPosRef.current.left;
      gridContainerRef.current.scrollTop = scrollPosRef.current.top;
    }
  });

  useEffect(() => {
    const handleHistoryFocus = (e: Event) => {
      const customEvent = e as CustomEvent<{
        oldState: { instances: SubjectEntry[] };
        newState: { instances: SubjectEntry[] };
      }>;
      const { oldState, newState } = customEvent.detail;
      const oldEntries = oldState.instances || [];
      const newEntries = newState.instances || [];
      if (!oldState || !newState) return;

      let affectedEntryId: string | null = null;
      let affectedScheduleId: string | null = null;

      for (const newEntry of newEntries) {
        const oldEntry = oldEntries.find((ent) => ent.id === newEntry.id);
        if (!oldEntry) {
          affectedEntryId = newEntry.id;
          affectedScheduleId = newEntry.schedules[0]?.id || null;
          break;
        } else {
          const oldSchedsJson = JSON.stringify(oldEntry.schedules);
          const newSchedsJson = JSON.stringify(newEntry.schedules);
          if (oldSchedsJson !== newSchedsJson) {
            affectedEntryId = newEntry.id;
            for (const newSched of newEntry.schedules) {
              const oldSched = oldEntry.schedules.find((s) => s.id === newSched.id);
              if (!oldSched || JSON.stringify(oldSched) !== JSON.stringify(newSched)) {
                affectedScheduleId = newSched.id;
                break;
              }
            }
            break;
          }
        }
      }

      if (affectedEntryId && affectedScheduleId) {
        setTimeout(() => {
          const blockId = `grid-block-${affectedEntryId}-${affectedScheduleId}`;
          const el = document.getElementById(blockId);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            el.classList.add('highlight-pulse');
            setTimeout(() => el.classList.remove('highlight-pulse'), 1500);
          }
        }, 50);
      }
    };

    window.addEventListener('timetable:history-focus', handleHistoryFocus);
    return () => window.removeEventListener('timetable:history-focus', handleHistoryFocus);
  }, []);

  useEffect(() => {
    const handleGridKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      if (e.key === 'Escape') {
        onClearSelection();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        const allKeys = new Set<string>();
        for (const entry of entries) {
          for (const sched of entry.schedules) {
            for (const _ of sched.days) {
              allKeys.add(`${entry.id}:${sched.id}`);
            }
          }
        }
        allKeys.forEach(key => {
          if (!selectedBlockKeys.has(key)) onToggleSelectBlock(key);
        });
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectedBlockKeys.size > 0) {
          e.preventDefault();
          onCopyBlocks(Array.from(selectedBlockKeys));
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (canPaste) {
          e.preventDefault();
          onPasteBlocks();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleGridKeyDown);
    return () => window.removeEventListener('keydown', handleGridKeyDown);
  }, [selectedBlockKeys, onClearSelection, onToggleSelectBlock, onCopyBlocks, onPasteBlocks, canPaste, entries]);

  const [activePopoverKey, setActivePopoverKey] = useState<string | null>(null);

  // Drag state (refs — no React re-renders during drag)
  const dragRef = useRef<{
    blockIds: string[];
    initialDays: DayOfWeek[];
    initialStartMins: number[];
    durations: number[];
    entryIds: string[];
    scheduleIds: string[];
    colors: string[];
    startX: number;
    startY: number;
  } | null>(null);

  // Pending drag data — promoted to dragRef after a 4px movement threshold
  const pendingDragRef = useRef<typeof dragRef.current>(null);

  const gridContainerRef = useRef<HTMLDivElement | null>(null);

  // Ghost elements for drop preview during drag
  const ghostElsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  // Inject ghost pulse keyframes once
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'timetable-grid-ghost-style';
    style.textContent = `@keyframes ghostPulse{0%,100%{background:rgba(59,130,246,0.08)}50%{background:rgba(59,130,246,0.25)}}.ghost-pulse{animation:ghostPulse 1s ease-in-out infinite}`;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  // Helper: compute drop position for a block during drag
  const computeDropPosition = (initialDay: DayOfWeek, initialStartMin: number, duration: number, dayShift: number, slotShift: number, vs: number, ve: number) => {
    const origIdx = DAY_ORDER.indexOf(initialDay);
    let newIdx = origIdx + dayShift;
    newIdx = Math.max(0, Math.min(DAY_ORDER.length - 1, newIdx));
    let startMin = initialStartMin + slotShift * 30;
    startMin = Math.max(vs, Math.min(ve - duration, startMin));
    return { day: DAY_ORDER[newIdx], top: ((startMin - vs) / 30) * ROW_HEIGHT };
  };

  // Marquee state (refs)
  const marqueeElRef = useRef<HTMLDivElement | null>(null);
  const marqueeDataRef = useRef<{
    startX: number;
    startY: number;
    mode: 'add' | 'subtract' | 'replace';
    container: HTMLDivElement;
  } | null>(null);

  // Global mousemove/mouseup for drag + marquee
  useEffect(() => {
    const DRAG_THRESHOLD = 4;

    const handleMouseMove = (e: MouseEvent) => {
      // Promote pending drag to active drag after threshold
      const pending = pendingDragRef.current;
      if (pending && !dragRef.current) {
        const dx = e.pageX - pending.startX;
        const dy = e.pageY - pending.startY;
        if (Math.abs(dx) >= DRAG_THRESHOLD || Math.abs(dy) >= DRAG_THRESHOLD) {
          dragRef.current = pending;
          pendingDragRef.current = null;
        }
      }

      // Handle drag
      const d = dragRef.current;
      if (d) {
        const deltaX = e.pageX - d.startX;
        const deltaY = e.pageY - d.startY;
        const dayShift = Math.round(deltaX / COL_WIDTH);
        const slotShift = Math.round(deltaY / ROW_HEIGHT);
        const vs = viewStartRef.current;
        const ve = viewEndRef.current;

        for (let i = 0; i < d.entryIds.length; i++) {
          const eId = d.entryIds[i];
          const sId = d.scheduleIds[i];
          const key = `${eId}:${sId}`;

          // Move original block with cursor + dim
          const el = document.getElementById(`grid-block-${eId}-${sId}`);
          if (el) gsap.set(el, { x: deltaX, y: deltaY, opacity: 0.3 });

          // Compute target drop position
          const { day: newDay, top: ghostTop } = computeDropPosition(
            d.initialDays[i], d.initialStartMins[i], d.durations[i],
            dayShift, slotShift, vs, ve
          );

          // Create or reuse ghost element inside target day column
          let ghost = ghostElsRef.current.get(key);
          if (!ghost) {
            ghost = document.createElement('div');
            ghost.className = 'ghost-pulse';
            ghost.style.cssText = [
              'position: absolute',
              'pointer-events: none',
              'z-index: 99998',
              `border: 2px dashed ${d.colors[i]}`,
              'border-radius: 3px',
              'background: rgba(59,130,246,0.08)',
              'opacity: 0.85',
              'box-sizing: border-box',
            ].join(';');
            ghostElsRef.current.set(key, ghost);
          }

          const dayCol = document.querySelector(`[data-day-column="${newDay}"]`);
          if (dayCol && ghost.parentElement !== dayCol) {
            if (ghost.parentElement) ghost.remove();
            dayCol.appendChild(ghost);
          }

          if (ghost.parentElement) {
            const heightPx = (d.durations[i] / 30) * ROW_HEIGHT;
            gsap.set(ghost, { top: ghostTop + 1, left: 2, right: 2, height: Math.max(heightPx - 2, 20) });
          }
        }
      }

      // Handle marquee
      const md = marqueeDataRef.current;
      if (md) {
        const x = Math.min(md.startX, e.clientX);
        const y = Math.min(md.startY, e.clientY);
        const w = Math.abs(e.clientX - md.startX);
        const h = Math.abs(e.clientY - md.startY);
        const rect = md.container.getBoundingClientRect();
        gsap.set(marqueeElRef.current, {
          x: x - rect.left + md.container.scrollLeft,
          y: y - rect.top + md.container.scrollTop,
          width: w,
          height: h,
        });
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      // Clear pending drag if it never promoted (was just a click)
      pendingDragRef.current = null;

      // Handle drag end
      const d = dragRef.current;
      if (d) {
        dragRef.current = null;

        // Clean up ghost elements
        for (const [, ghost] of ghostElsRef.current) ghost.remove();
        ghostElsRef.current.clear();

        // Reset block visibility
        for (let i = 0; i < d.entryIds.length; i++) {
          const el = document.getElementById(`grid-block-${d.entryIds[i]}-${d.scheduleIds[i]}`);
          if (el) gsap.set(el, { opacity: 1, x: 0, y: 0 });
        }

        const deltaX = e.pageX - d.startX;
        const deltaY = e.pageY - d.startY;
        const dayShift = Math.round(deltaX / COL_WIDTH);
        const slotShift = Math.round(deltaY / ROW_HEIGHT);

        // Skip state commits for no-op drags (block didn't actually move)
        if (dayShift === 0 && slotShift === 0) {
          // Nothing to do — block snaps back visually via the gsap reset above
        } else {
          const updated = new Map<string, SubjectEntry>();
          const entries = entriesRef.current;
          const onUpdate = onUpdateEntryRef.current;
          const vs = viewStartRef.current;
          const ve = viewEndRef.current;

          for (let i = 0; i < d.entryIds.length; i++) {
            const eId = d.entryIds[i];
            const sId = d.scheduleIds[i];
            const origDay = d.initialDays[i];
            const origStartMin = d.initialStartMins[i];
            const duration = d.durations[i];

            const origDayIdx = DAY_ORDER.indexOf(origDay);
            let newDayIdx = origDayIdx + dayShift;
            newDayIdx = Math.max(0, Math.min(DAY_ORDER.length - 1, newDayIdx));
            const newDay = DAY_ORDER[newDayIdx];

            let newStartMin = origStartMin + slotShift * SLOT_INTERVAL;
            newStartMin = Math.max(vs, Math.min(ve - duration, newStartMin));

            const entry = entries.find(en => en.id === eId);
            if (!entry) continue;

            const existing = updated.get(eId);
            const baseEntry = existing || entry;

            const updatedSchedules = baseEntry.schedules.map((s) => {
              if (s.id === sId) {
                const daysCopy = s.days.map((day) => (day === origDay ? newDay : day));
                const uniqueDays = Array.from(new Set(daysCopy));
                return {
                  ...s,
                  days: uniqueDays,
                  startTime: minutesTo24Hr(newStartMin),
                  endTime: minutesTo24Hr(newStartMin + duration),
                };
              }
              return s;
            });

            updated.set(eId, {
              ...baseEntry,
              schedules: updatedSchedules,
            });
          }

          // Batch: single onUpdate call per unique entry
          for (const [, ue] of updated) {
            onUpdate?.(ue);
          }
        }
      }

      // Handle marquee end
      const md = marqueeDataRef.current;
      if (md) {
        marqueeDataRef.current = null;

        const x1 = Math.min(md.startX, e.clientX);
        const y1 = Math.min(md.startY, e.clientY);
        const x2 = Math.max(md.startX, e.clientX);
        const y2 = Math.max(md.startY, e.clientY);

        if (marqueeElRef.current) {
          marqueeElRef.current.remove();
          marqueeElRef.current = null;
        }

        if (Math.abs(e.clientX - md.startX) < 3 && Math.abs(e.clientY - md.startY) < 3) return;

        const blocks = document.querySelectorAll('.timetable-entry-block');
        const intersecting: string[] = [];

        blocks.forEach((block) => {
          const rect = block.getBoundingClientRect();
          if (rect.left < x2 && rect.right > x1 && rect.top < y2 && rect.bottom > y1) {
            const id = block.id.replace('grid-block-', '');
            intersecting.push(id);
          }
        });

        if (intersecting.length === 0) return;

        const selectedKeys = selectedBlockKeysRef.current;
        const toggle = onToggleSelectBlockRef.current;
        const clear = onClearSelectionRef.current;

        if (md.mode === 'add') {
          for (const key of intersecting) {
            if (!selectedKeys.has(key)) toggle(key);
          }
        } else if (md.mode === 'subtract') {
          for (const key of intersecting) {
            if (selectedKeys.has(key)) toggle(key);
          }
        } else {
          clear();
          for (const key of intersecting) {
            toggle(key);
          }
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    const ghosts = ghostElsRef.current;
    return () => {
      for (const [, ghost] of ghosts) ghost.remove();
      ghosts.clear();
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startMarquee = (e: React.MouseEvent, container: HTMLDivElement) => {
    const startX = e.clientX;
    const startY = e.clientY;
    const mode: 'add' | 'subtract' | 'replace' = e.ctrlKey || e.metaKey ? 'add' : e.shiftKey ? 'subtract' : 'replace';

    const el = document.createElement('div');
    el.style.cssText = [
      'position: absolute',
      'pointer-events: none',
      'z-index: 999',
      'background: rgba(59,130,246,0.12)',
      'border: 1px solid rgba(59,130,246,0.6)',
      'border-radius: 3px',
    ].join(';');
    container.appendChild(el);

    const rect = container.getBoundingClientRect();
    gsap.set(el, {
      x: startX - rect.left + container.scrollLeft,
      y: startY - rect.top + container.scrollTop,
      width: 0,
      height: 0,
    });
    marqueeElRef.current = el;
    marqueeDataRef.current = { startX, startY, mode, container };
  };

  const slotEntries = useMemo(() => {
    const flat: SlotEntry[] = [];
    for (const entry of entries) {
      for (const sched of entry.schedules) {
        for (const day of sched.days) {
          const s = toMin(sched.startTime);
          const e = toMin(sched.endTime);
          flat.push({ entry, day, startMin: s, endMin: e, schedule: sched });
        }
      }
    }
    return flat;
  }, [entries]);

  const rowCount = (viewEnd - viewStart) / SLOT_INTERVAL;
  const gridHeight = rowCount * ROW_HEIGHT;
  const totalDays = DAY_ORDER.length;

  const dayEntriesMap = useMemo(() => {
    const map = new Map<string, SlotEntry[]>();
    for (const day of DAY_ORDER) {
      map.set(day, slotEntries.filter((se) =>
        se.day === day && se.startMin < viewEnd && se.endMin > viewStart
      ));
    }
    return map;
  }, [slotEntries, viewStart, viewEnd]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div ref={gridContainerRef} onScroll={() => { const el = gridContainerRef.current; if (el) { scrollPosRef.current = { left: el.scrollLeft, top: el.scrollTop }; } }} style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 250px)', border: '1px solid #D0D7E3', borderRadius: 4, position: 'relative' }}>
        <div
          onClick={onCancelEdit}
          style={{ display: 'flex', minWidth: TIME_COL_WIDTH + totalDays * COL_WIDTH, position: 'relative' }}
        >
            <div style={{ width: TIME_COL_WIDTH, flexShrink: 0, position: 'sticky', left: 0, zIndex: 3, background: '#F5F7FA' }}>
              <div style={headerCellStyle(TIME_COL_WIDTH, true, theme)}>&nbsp;</div>
              <div style={{ position: 'relative', height: gridHeight + 4 }}>
                {Array.from({ length: rowCount }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      top: i * ROW_HEIGHT,
                      width: '100%',
                      height: ROW_HEIGHT,
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'flex-end',
                      paddingRight: 6,
                      paddingTop: 2,
                      borderTop: i === 0 ? '1px solid #D0D7E3' : '1px dashed #E4E9F0',
                      boxSizing: 'border-box',
                    }}
                  >
                    <Text style={{ fontSize: 10, color: '#7A8BA8', lineHeight: 1 }}>
                      {toTime(viewStart + i * SLOT_INTERVAL)}
                    </Text>
                  </div>
                ))}
                <div
                  style={{
                    position: 'absolute',
                    top: rowCount * ROW_HEIGHT,
                    width: '100%',
                    height: 4,
                    display: 'flex',
                    borderTop: '1px solid #D0D7E3',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {DAY_ORDER.map((day) => {
              const dayEntries = (() => {
                const drag = dragRef.current;
                if (!drag) return dayEntriesMap.get(day) || [];
                const filtered = slotEntries.filter((se) => {
                  const idx = drag.blockIds.indexOf(`${se.entry.id}:${se.schedule.id}`);
                  if (idx === -1) return se.day === day && se.startMin < viewEnd && se.endMin > viewStart;
                  return drag.initialDays[idx] === day;
                });
                return filtered;
              })();
              const isHidden = hiddenDays.includes(day);

              return (
                <div
                  key={day}
                  style={{
                    width: COL_WIDTH,
                    flexShrink: 0,
                    borderLeft: '1px solid #D0D7E3',
                    opacity: isHidden ? 0.25 : 1,
                    transition: 'opacity 0.2s ease',
                  }}
                >
                  <div style={headerCellStyle(COL_WIDTH, false, theme)}>
                    <Text strong style={{ fontSize: 12, color: '#ffffff' }}>
                      {day}
                    </Text>
                  </div>

                  <div
                    className="grid-day-column"
                    data-day-column={day}
                    data-room={activeRoom || ''}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'copy';
                      e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.08)';
                    }}
                    onDragEnter={(e) => e.preventDefault()}
                    onDragLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.style.backgroundColor = 'transparent';
                      const entryId = e.dataTransfer.getData('text/plain');
                      if (!entryId) return;
                      if (!activeRoom) {
                        alert('Please select a Room Timetable first.');
                        return;
                      }
                      const rect = e.currentTarget.getBoundingClientRect();
                      const relativeY = e.clientY - rect.top;
                      const slotIndex = Math.floor(relativeY / ROW_HEIGHT);
                      const startMin = viewStart + slotIndex * SLOT_INTERVAL;
                      onDropEntry?.(entryId, day, startMin, activeRoom);
                    }}
                    style={{ position: 'relative', height: gridHeight + 4, transition: 'background-color 0.2s ease' }}
                  >
                    <div
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        const target = e.target as HTMLElement;
                        if (target.closest('.timetable-entry-block')) return;
                        if (target.closest('.ant-dropdown-trigger')) return;
                        const container = gridContainerRef.current;
                        if (!container) return;
                        startMarquee(e, container);
                      }}
                      style={{ position: 'absolute', inset: 0, zIndex: 0 }}
                    >
                      {/* Background rows */}
                      {Array.from({ length: rowCount }, (_, i) => (
                        <div
                          key={i}
                          style={{
                            position: 'absolute',
                            top: i * ROW_HEIGHT,
                            left: 0,
                            right: 0,
                            height: ROW_HEIGHT,
                            borderTop: i === 0 ? '1px solid #D0D7E3' : '1px dashed #E4E9F0',
                            background: (bandedRows && i % 2 !== 0) ? 'rgba(238,241,246,0.5)' : 'transparent',
                            pointerEvents: 'none',
                          }}
                        />
                      ))}
                    </div>
                    <div
                      style={{
                        position: 'absolute',
                        top: rowCount * ROW_HEIGHT,
                        left: 0,
                        right: 0,
                        height: 4,
                        borderTop: '1px solid #D0D7E3',
                        pointerEvents: 'none',
                      }}
                    />

                    {dayEntries.map((se, idx) => {
                      const topPx = ((se.startMin - viewStart) / SLOT_INTERVAL) * ROW_HEIGHT;
                      const heightPx = ((se.endMin - se.startMin) / SLOT_INTERVAL) * ROW_HEIGHT;
                      const isEditing = editingEntryId === se.entry.id;
                      const blockKey = `${se.entry.id}:${se.schedule.id}`;
                      const isLinkingFirst = linkingFirstBlockKey === blockKey;
                      const isDimmed = !!linkingHighlightedKeys && !linkingHighlightedKeys.has(blockKey);
                      const color = colorForSubject(se.entry.subjectCode, se.entry.color);
                      const isSelected = selectedBlockKeys.has(blockKey);

                      return (
                        <Tooltip
                          key={idx}
                          title={
                            <div style={{ fontSize: 11 }}>
                              <div>
                                <strong>{se.entry.subjectCode}</strong> — {se.entry.offerCode}
                              </div>
                              <div>{se.entry.subjectDescription}</div>
                              <div>{se.entry.program}</div>
                              <div>{se.entry.year} - {se.entry.section}</div>
                              <div>Teacher: {formatTeacherForDisplay(se.entry.assignedTeacherName) || 'Unassigned'}</div>
                              <div>Room: {se.entry.room}</div>
                              <div>
                                {toTime(se.startMin)}–{toTime(se.endMin)}
                              </div>
                            </div>
                          }
                        >
                          <Dropdown
                            menu={{
                              items: [
                                ...(selectedBlockKeys.size > 1
                                  ? [
                                      { label: `Move ${selectedBlockKeys.size} blocks to room`, key: 'move-multi', icon: <SwapOutlined /> },
                                      { label: `Move ${selectedBlockKeys.size} blocks to available room`, key: 'move-avail-multi', icon: <HomeOutlined /> },
                                      { label: `Delete ${selectedBlockKeys.size} blocks`, key: 'delete-multi', icon: <DeleteOutlined />, danger: true },
                                      { type: 'divider' as const },
                                    ]
                                  : [
                                      { label: 'Move to room', key: 'move', icon: <SwapOutlined /> },
                                      { label: 'Move to available room', key: 'move-avail', icon: <HomeOutlined /> },
                                    ]
                                ),
                                { label: 'Copy', key: 'copy', icon: <CopyOutlined /> },
                                ...(canPaste ? [{ label: 'Paste', key: 'paste' }] : []),
                                { type: 'divider' as const },
                                ...(linkingModeActive ? [
                                  { label: 'Unlink Schedule', key: 'unlink', icon: <DisconnectOutlined />, danger: true }
                                ] : []),
                                ...(selectedBlockKeys.size <= 1
                                  ? [
                                      { label: 'Delete Schedule Slot', key: 'delete', icon: <DeleteOutlined />, danger: true },
                                      { label: 'Go to Blueprint', key: 'goto', icon: <AimOutlined /> },
                                    ]
                                  : []
                                ),
                              ],
                              onClick: ({ key, domEvent }) => {
                                domEvent.stopPropagation();
                                if (key === 'move' || key === 'move-multi') {
                                  const keys = selectedBlockKeys.size > 0 ? Array.from(selectedBlockKeys) : [blockKey];
                                  keys.forEach(k => onMoveRoom?.(k));
                                } else if (key === 'move-avail' || key === 'move-avail-multi') {
                                  const keys = selectedBlockKeys.size > 0 ? Array.from(selectedBlockKeys) : [blockKey];
                                  onMoveToAvailableRoom?.(keys);
                                } else if (key === 'unlink') {
                                  onUnlinkBlock?.(blockKey);
                                } else if (key === 'delete') {
                                  if (onDeleteSchedule) onDeleteSchedule(se.entry.id, se.schedule.id);
                                  else if (onDeleteEntry) onDeleteEntry(se.entry.id);
                                } else if (key === 'delete-multi') {
                                  selectedBlockKeys.forEach(k => {
                                    const [eId, sId] = k.split(':');
                                    onDeleteSchedule?.(eId, sId);
                                  });
                                  onClearSelection();
                                } else if (key === 'copy') {
                                  onCopyBlocks(selectedBlockKeys.size > 0 ? Array.from(selectedBlockKeys) : [blockKey]);
                                } else if (key === 'paste') {
                                  onPasteBlocks();
                                } else if (key === 'goto') {
                                  const el = document.getElementById(`subject-card-${se.entry.id}`);
                                  if (el) {
                                    const container = el.closest('[class*="blueprint-list"]') || el.parentElement;
                                    if (container) {
                                      const containerRect = container.getBoundingClientRect();
                                      const elRect = el.getBoundingClientRect();
                                      const offset = elRect.top - containerRect.top - containerRect.height / 2 + elRect.height / 2;
                                      container.scrollBy({ top: offset, behavior: 'smooth' });
                                    }
                                    el.classList.remove('highlight-pulse');
                                    void el.offsetWidth;
                                    el.classList.add('highlight-pulse');
                                    setTimeout(() => el.classList.remove('highlight-pulse'), 1500);
                                    el.focus();
                                  }
                                }
                              }
                            }}
                            trigger={['contextMenu']}
                          >
                            <div
                              id={`grid-block-${se.entry.id}-${se.schedule.id}`}
                              className={`timetable-entry-block timetable-fade-target ${isLinkingFirst ? 'linking-first-block' : ''}`}
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (e.ctrlKey || e.metaKey) {
                                  onToggleSelectBlock(blockKey);
                                } else {
                                  onSelectScheduleBlock?.(se.entry, se.schedule);
                                }
                              }}
                              onKeyDown={(e) => {
                              if (e.key === 'Delete' || e.key === 'Backspace') {
                                e.stopPropagation();
                                e.preventDefault();
                                if (onDeleteSchedule) onDeleteSchedule(se.entry.id, se.schedule.id);
                              }
                            }}
                            onMouseDown={(e) => {
                              if (e.button !== 0) return;
                              e.stopPropagation();

                              const selectedKeys = selectedBlockKeysRef.current;
                              const isInMultiSelection = selectedKeys.size > 1 && selectedKeys.has(blockKey);

                              let blockIds: string[];
                              if (isInMultiSelection) {
                                blockIds = Array.from(selectedKeys);
                              } else {
                                blockIds = [blockKey];
                              }

                              const initialDays: DayOfWeek[] = [];
                              const initialStartMins: number[] = [];
                              const durations: number[] = [];
                              const entryIds: string[] = [];
                              const scheduleIds: string[] = [];
                              const colors: string[] = [];

                              for (const bk of blockIds) {
                                const [eId, sId] = bk.split(':');
                                const entry = entries.find(en => en.id === eId);
                                if (!entry) continue;
                                const sched = entry.schedules.find(s => s.id === sId);
                                if (!sched) continue;
                                const blockColor = colorForSubject(entry.subjectCode, entry.color);
                                for (const d of sched.days) {
                                  entryIds.push(eId);
                                  scheduleIds.push(sId);
                                  initialDays.push(d);
                                  initialStartMins.push(toMin(sched.startTime));
                                  durations.push(toMin(sched.endTime) - toMin(sched.startTime));
                                  colors.push(blockColor);
                                }
                              }

                              if (entryIds.length === 0) return;

                              // Store as pending — promoted to active drag after 4px threshold
                              pendingDragRef.current = {
                                blockIds,
                                initialDays,
                                initialStartMins,
                                durations,
                                entryIds,
                                scheduleIds,
                                colors,
                                startX: e.pageX,
                                startY: e.pageY,
                              };
                            }}
                              style={{
                                position: 'absolute',
                                top: topPx + 1,
                                left: 2,
                                right: 2,
                                height: Math.max(heightPx - 2, 20),
                                backgroundColor: color,
                                borderRadius: 3,
                                padding: '2px 5px',
                                overflow: 'hidden',
                                zIndex: isSelected ? 5 : (isEditing ? 3 : 1),
                                opacity: isDimmed
                                  ? 0.2
                                  : (!(se.schedule.assignedTeacherName || se.entry.assignedTeacherName) ? 0.65 : 1),
                                border: isSelected
                                  ? '2px solid #3B82F6'
                                  : isEditing ? '2px solid rgba(255,255,255,0.95)' : 'none',
                                boxShadow: isSelected
                                  ? '0 0 0 3px rgba(59,130,246,0.7), 0 4px 16px rgba(0,0,0,0.35)'
                                  : isEditing
                                    ? '0 0 0 3px rgba(59,130,246,0.7), 0 4px 16px rgba(0,0,0,0.35)'
                                    : '0 1px 3px rgba(0,0,0,0.2)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'flex-start',
                                cursor: 'pointer',
                              }}
                          >
                            <div
                              style={{
                                position: 'absolute',
                                top: 0, left: 0, right: 0, height: 6,
                                cursor: 'ns-resize', zIndex: 10,
                              }}
                              onMouseDown={(e) => { if (e.button !== 0) return; e.stopPropagation(); }}
                            />
                            <div
                              style={{
                                position: 'absolute',
                                bottom: 0, left: 0, right: 0, height: 6,
                                cursor: 'ns-resize', zIndex: 10,
                              }}
                              onMouseDown={(e) => { if (e.button !== 0) return; e.stopPropagation(); }}
                            />
                            <Text
                              style={{
                                fontSize: 10, fontWeight: 700, color: '#fff', lineHeight: 1.3,
                                display: 'block', whiteSpace: 'nowrap', overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {se.entry.subjectCode}
                            </Text>
                            {heightPx >= 36 && (
                              <Text
                                style={{
                                  fontSize: 9, color: 'rgba(255,255,255,0.95)', lineHeight: 1.3,
                                  display: 'block', whiteSpace: 'nowrap', overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {se.entry.program} - {se.entry.year}{se.entry.section}
                              </Text>
                            )}
                            {heightPx >= 48 && (
                              <Text
                                style={{
                                  fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.3,
                                  display: 'block', whiteSpace: 'nowrap', overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {(() => {
                                  const teacher = se.schedule.assignedTeacherName || se.entry.assignedTeacherName;
                                  if (!teacher) return 'Unassigned';
                                  const { lastName, firstName } = parseTeacherName(teacher);
                                  return firstName ? `${firstName.charAt(0).toUpperCase()}. ${lastName}` : lastName || 'Unassigned';
                                })()}
                              </Text>
                            )}
                          </div>
                          </Dropdown>
                        </Tooltip>
                      );
                    })}

                    {(() => {
                      interface Event {
                        time: number;
                        type: 'start' | 'end';
                        entry: SubjectEntry;
                      }

                      const events: Event[] = [];
                      for (const se of dayEntries) {
                        events.push({ time: se.startMin, type: 'start', entry: se.entry });
                        events.push({ time: se.endMin, type: 'end', entry: se.entry });
                      }
                      events.sort((a, b) => a.time - b.time || (a.type === 'start' ? -1 : 1));

                      const overlapsList: { startMin: number; endMin: number; entries: SubjectEntry[] }[] = [];
                      const active = new Map<string, SubjectEntry>();
                      let sweepStart = -1;

                      for (const evt of events) {
                        if (evt.type === 'start') {
                          if (active.size >= 2 && sweepStart >= 0 && sweepStart !== evt.time) {
                            overlapsList.push({ startMin: sweepStart, endMin: evt.time, entries: Array.from(active.values()) });
                          }
                          active.set(evt.entry.id, evt.entry);
                          sweepStart = evt.time;
                        } else {
                          if (active.size > 1 && sweepStart >= 0 && sweepStart !== evt.time) {
                            overlapsList.push({ startMin: sweepStart, endMin: evt.time, entries: Array.from(active.values()) });
                          }
                          active.delete(evt.entry.id);
                          sweepStart = evt.time;
                        }
                      }

                      return overlapsList.map((overlap, oIdx) => {
                        const displayStart = Math.max(overlap.startMin, viewStart);
                        const displayEnd = Math.min(overlap.endMin, viewEnd);
                        if (displayStart >= displayEnd) return null;

                        const topPx = ((displayStart - viewStart) / SLOT_INTERVAL) * ROW_HEIGHT;
                        const heightPx = ((displayEnd - displayStart) / SLOT_INTERVAL) * ROW_HEIGHT;

                        const popoverContent = (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#D32F2F' }}>
                              Conflict Time: {toTime(overlap.startMin)}–{toTime(overlap.endMin)}
                            </div>
                            <div style={{ fontSize: 11, color: '#7A8BA8', marginBottom: 2 }}>
                              Hover an entry below to see its details:
                            </div>
                            {overlap.entries.map((ent, idx) => (
                              <Tooltip
                                key={idx}
                                placement="right"
                                title={
                                  <div style={{ fontSize: 11 }}>
                                    <div><strong>{ent.subjectCode}</strong> — {ent.offerCode}</div>
                                    <div>{ent.subjectDescription}</div>
                                    <div>{ent.program}</div>
                                    <div>{ent.year} - {ent.section}</div>
                                    <div>Teacher: {formatTeacherForDisplay(ent.assignedTeacherName) || 'Unassigned'}</div>
                                    <div>Room: {ent.room}</div>
                                    <div style={{ marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 4 }}>
                                      <strong>Schedules:</strong>
                                      {ent.schedules.map((s, sIdx) => (
                                        <div key={sIdx} style={{ fontSize: 10, opacity: 0.9 }}>
                                          {s.days.join('/')} {formatTimeTo12Hr(s.startTime)}–{formatTimeTo12Hr(s.endTime)}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                }
                              >
                                <div
                                  onMouseEnter={() => {
                                    for (const s of ent.schedules) {
                                      const el = document.getElementById(`grid-block-${ent.id}-${s.id}`);
                                      if (el) el.classList.add('highlight-pulse');
                                    }
                                  }}
                                  onMouseLeave={() => {
                                    for (const s of ent.schedules) {
                                      const el = document.getElementById(`grid-block-${ent.id}-${s.id}`);
                                      if (el) el.classList.remove('highlight-pulse');
                                    }
                                  }}
                                  style={{
                                    padding: '6px 10px',
                                    background: colorForSubject(ent.subjectCode, ent.color),
                                    color: '#ffffff', borderRadius: 4, fontSize: 11, fontWeight: 600,
                                    cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActivePopoverKey(null);
                                    for (const s of ent.schedules) {
                                      const el = document.getElementById(`grid-block-${ent.id}-${s.id}`);
                                      if (el) {
                                        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                                        el.classList.add('highlight-pulse');
                                        setTimeout(() => el.classList.remove('highlight-pulse'), 1500);
                                        if (el instanceof HTMLElement) el.focus();
                                      }
                                    }
                                  }}
                                >
                                  <span>{ent.subjectCode} ({ent.offerCode})</span>
                                </div>
                              </Tooltip>
                            ))}
                          </div>
                        );

                        const popoverKey = `overlap-popover-${day}-${oIdx}`;
                        const isPopoverOpen = activePopoverKey === popoverKey;

                        return (
                          <Popover
                            key={popoverKey}
                            title={<span style={{ fontSize: 12, fontWeight: 700, color: '#FF4D4F' }}>Schedule Conflict</span>}
                            content={popoverContent}
                            open={isPopoverOpen}
                            onOpenChange={(visible) => setActivePopoverKey(visible ? popoverKey : null)}
                            trigger="hover"
                            placement="right"
                          >
                            <div
                              key={`overlap-${oIdx}`}
                              className="timetable-fade-target"
                              style={{
                                position: 'absolute',
                                top: topPx + 1, left: 2, right: 2,
                                height: Math.max(heightPx - 2, 20),
                                backgroundImage: 'linear-gradient(45deg, rgba(255, 77, 79, 0.3) 25%, transparent 25%, transparent 50%, rgba(255, 77, 79, 0.3) 50%, rgba(255, 77, 79, 0.3) 75%, transparent 75%, transparent)',
                                backgroundSize: '12px 12px',
                                backgroundColor: 'rgba(255, 77, 79, 0.05)',
                                border: '1px solid rgba(255, 77, 79, 0.4)',
                                borderRadius: 3, zIndex: 2, pointerEvents: 'auto', cursor: 'help',
                              }}
                            />
                          </Popover>
                        );
                      });
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
    </div>
  );
});

function headerCellStyle(width: number, isTimeCol: boolean, theme: string = 'blue'): React.CSSProperties {
  const colors = getThemeColors(theme);
  return {
    width,
    height: 32,
    background: isTimeCol ? '#F5F7FA' : colors.headerBg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: isTimeCol ? 'flex-end' : 'center',
    paddingRight: isTimeCol ? 6 : 0,
    borderBottom: `2px solid ${colors.primary}`,
    position: 'sticky',
    top: 0,
    zIndex: 2,
    boxSizing: 'border-box',
  };
}
