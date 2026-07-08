import { useMemo, useState, useEffect, memo } from 'react';
import { Empty, Typography, Tooltip, Tag, Select, Popover, Dropdown } from 'antd';
import { EditOutlined, DeleteOutlined, AimOutlined } from '@ant-design/icons';
import type { SubjectEntry, DayOfWeek, Schedule } from '../types';
import { DAY_ORDER } from '../types';
import { colorForSubject } from '../theme';
import { formatTeacherForDisplay, parseTeacherName } from '../utils/teacherName';
import { minutesTo12Hr, formatTimeTo12Hr } from '../utils/time';

const { Text } = Typography;
const { CheckableTag } = Tag;

interface TimetableGridProps {
  entries: SubjectEntry[];
  hiddenDays: DayOfWeek[];
  onToggleDay: (days: DayOfWeek[]) => void;
  viewStart: number;
  viewEnd: number;
  onViewStartChange: (val: number) => void;
  onViewEndChange: (val: number) => void;
  bandedRows: boolean;
  /** Called when the user clicks a schedule block to edit the entry */
  onEditEntry?: (entry: SubjectEntry) => void;
  /** ID of the entry currently being edited */
  editingEntryId?: string | null;
  /** Called when the user clicks empty space to clear editing focus */
  onCancelEdit?: () => void;
  /** Called when schedule block is dragged and snapped to a new position */
  onUpdateEntry?: (entry: SubjectEntry) => void;
  /** Called to delete an entry entirely */
  onDeleteEntry?: (id: string) => void;
  onDropEntry?: (entryId: string, day: DayOfWeek, startMin: number) => void;
  onDeleteSchedule?: (entryId: string, scheduleId: string) => void;
}

interface SlotEntry {
  entry: SubjectEntry;
  day: DayOfWeek;
  startMin: number;
  endMin: number;
  schedule: Schedule;
}

/** Converts "HH:mm" to total minutes */
function toMin(time: string): number {
  const parts = time.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

/** Converts minutes to "HH:mm" 24-hour format */
function minutesTo24Hr(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, '0');
  const m = (min % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** Converts minutes to display string "hh:mm AM/PM" */
function toTime(min: number): string {
  return minutesTo12Hr(min);
}

const ROW_HEIGHT = 36; // px per 30-minute slot
const COL_WIDTH = 130; // px per day column
const TIME_COL_WIDTH = 72; // px for the time label column (widened for AM/PM format)
const SLOT_INTERVAL = 30; // minutes per row

// Generate list of 30-minute intervals for select inputs (from 00:00 to 24:00)
const TIME_OPTIONS = Array.from({ length: 49 }, (_, i) => {
  const min = i * 30;
  return { label: toTime(min), value: min };
});

/**
 * Weekly timetable grid rendered as an absolutely-positioned overlay layout.
 * Displays time slots corresponding to the selected view range (e.g., 07:30 to 20:00).
 * Displays all days Monday to Sunday in X axis.
 * Supports day visibility toggles (hidden days drawn with 25% opacity).
 */
export const TimetableGrid = memo(function TimetableGrid({
  entries,
  hiddenDays,
  onToggleDay,
  viewStart,
  viewEnd,
  onViewStartChange,
  onViewEndChange,
  bandedRows,
  onEditEntry,
  editingEntryId,
  onCancelEdit,
  onUpdateEntry,
  onDeleteEntry,
  onDropEntry,
  onDeleteSchedule,
}: TimetableGridProps) {
  // Listen for undo/redo events to scroll and highlight the affected schedule block
  useEffect(() => {
    const handleHistoryFocus = (e: Event) => {
      const customEvent = e as CustomEvent<{
        oldState: { entries: SubjectEntry[] };
        newState: { entries: SubjectEntry[] };
      }>;
      const { oldState, newState } = customEvent.detail;
      if (!oldState || !newState) return;

      let affectedEntryId: string | null = null;
      let affectedScheduleId: string | null = null;

      // Find added or modified entry and schedule
      for (const newEntry of newState.entries) {
        const oldEntry = oldState.entries.find((ent) => ent.id === newEntry.id);
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
  const [activePopoverKey, setActivePopoverKey] = useState<string | null>(null);

  const [dragState, setDragState] = useState<{
    entry: SubjectEntry;
    schedule: Schedule;
    originalDay: DayOfWeek;
    currentDay: DayOfWeek;
    originalStartMin: number;
    currentStartMin: number;
    duration: number;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.pageX - dragState.startX;
      const deltaY = e.pageY - dragState.startY;

      const dayShift = Math.round(deltaX / COL_WIDTH);
      const originalDayIdx = DAY_ORDER.indexOf(dragState.originalDay);
      let newDayIdx = originalDayIdx + dayShift;
      newDayIdx = Math.max(0, Math.min(DAY_ORDER.length - 1, newDayIdx));
      const newDay = DAY_ORDER[newDayIdx];

      const slotShift = Math.round(deltaY / ROW_HEIGHT);
      let newStartMin = dragState.originalStartMin + slotShift * 30;
      newStartMin = Math.max(viewStart, Math.min(viewEnd - dragState.duration, newStartMin));

      setDragState((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          currentDay: newDay,
          currentStartMin: newStartMin,
          offsetX: deltaX,
          offsetY: deltaY,
        };
      });
    };

    const handleMouseUp = () => {
      if (dragState) {
        const { entry, schedule, originalDay, currentDay, currentStartMin, duration } = dragState;
        const newStartTime = minutesTo24Hr(currentStartMin);
        const newEndTime = minutesTo24Hr(currentStartMin + duration);

        const updatedSchedules = entry.schedules.map((s) => {
          if (s.id === schedule.id) {
            const daysCopy = s.days.map((d) => (d === originalDay ? currentDay : d));
            const uniqueDays = Array.from(new Set(daysCopy));
            return {
              ...s,
              days: uniqueDays,
              startTime: newStartTime,
              endTime: newEndTime,
            };
          }
          return s;
        });

        const updatedEntry: SubjectEntry = {
          ...entry,
          schedules: updatedSchedules,
        };

        onUpdateEntry?.(updatedEntry);
      }
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, viewStart, viewEnd, onUpdateEntry]);

  const [resizeState, setResizeState] = useState<{
    entry: SubjectEntry;
    schedule: Schedule;
    day: DayOfWeek;
    edge: 'top' | 'bottom';
    originalStartMin: number;
    originalEndMin: number;
    currentStartMin: number;
    currentEndMin: number;
    startY: number;
  } | null>(null);

  useEffect(() => {
    if (!resizeState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.pageY - resizeState.startY;
      const slotShift = Math.round(deltaY / ROW_HEIGHT);
      const minutesShift = slotShift * 30;

      let newStartMin = resizeState.originalStartMin;
      let newEndMin = resizeState.originalEndMin;

      if (resizeState.edge === 'top') {
        newStartMin = resizeState.originalStartMin + minutesShift;
        newStartMin = Math.max(viewStart, Math.min(newEndMin - 30, newStartMin));
      } else {
        newEndMin = resizeState.originalEndMin + minutesShift;
        newEndMin = Math.min(viewEnd, Math.max(newStartMin + 30, newEndMin));
      }

      setResizeState((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          currentStartMin: newStartMin,
          currentEndMin: newEndMin,
        };
      });
    };

    const handleMouseUp = () => {
      if (resizeState) {
        const { entry, schedule, currentStartMin, currentEndMin } = resizeState;
        const newStartTime = minutesTo24Hr(currentStartMin);
        const newEndTime = minutesTo24Hr(currentEndMin);

        const updatedSchedules = entry.schedules.map((s) => {
          if (s.id === schedule.id) {
            return {
              ...s,
              startTime: newStartTime,
              endTime: newEndTime,
            };
          }
          return s;
        });

        const updatedEntry: SubjectEntry = {
          ...entry,
          schedules: updatedSchedules,
        };

        onUpdateEntry?.(updatedEntry);
      }
      setResizeState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizeState, viewStart, viewEnd, onUpdateEntry]);

  const handleStartChange = (val: number) => {
    onViewStartChange(val);
    if (val >= viewEnd) {
      const newEnd = Math.min(val + 30, 24 * 60);
      onViewEndChange(newEnd);
    }
  };

  const handleEndChange = (val: number) => {
    onViewEndChange(val);
    if (val <= viewStart) {
      const newStart = Math.max(0, val - 30);
      onViewStartChange(newStart);
    }
  };

  const slotEntries = useMemo(() => {
    const flat: SlotEntry[] = [];
    for (const entry of entries) {
      if (!entry.room || entry.room.trim() === '') continue;
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* View Options Toolbar */}
      <div
        style={{
          marginBottom: 12,
          padding: '10px 14px',
          background: '#F5F7FA',
          borderRadius: 6,
          border: '1px solid #D0D7E3',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        {/* Day Visibility Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text strong style={{ fontSize: 12, color: '#1E3560' }}>
            Show Days:
          </Text>
          {DAY_ORDER.map((day) => {
            const isVisible = !hiddenDays.includes(day);
            return (
              <CheckableTag
                key={day}
                className="day-toggle-tag"
                checked={isVisible}
                onChange={(checked) => {
                  if (checked) {
                    onToggleDay(hiddenDays.filter((d) => d !== day));
                  } else {
                    onToggleDay([...hiddenDays, day]);
                  }
                }}
                style={{
                  border: '1px solid #D0D7E3',
                  padding: '2px 8px',
                  fontSize: 11,
                  borderRadius: 4,
                  userSelect: 'none',
                  background: isVisible ? '#1E3560' : 'rgba(0,0,0,0.04)',
                  color: isVisible ? '#FFFFFF' : '#7A8BA8',
                }}
              >
                {day}
              </CheckableTag>
            );
          })}
        </div>

        {/* Timespan filter dropdowns */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text strong style={{ fontSize: 12, color: '#1E3560' }}>
            Time Window:
          </Text>
          <Select
            size="small"
            style={{ width: 80 }}
            value={viewStart}
            onChange={handleStartChange}
            options={TIME_OPTIONS.slice(0, -1)} // omit 24:00 as start time
          />
          <Text style={{ fontSize: 12 }}>to</Text>
          <Select
            size="small"
            style={{ width: 80 }}
            value={viewEnd}
            onChange={handleEndChange}
            options={TIME_OPTIONS.filter((opt) => opt.value > viewStart)} // end must be after start
          />
        </div>
      </div>

      {entries.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
          <Empty description="Add entries to see the timetable" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      ) : (
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 250px)', border: '1px solid #D0D7E3', borderRadius: 4 }}>
          <div
            onClick={onCancelEdit}
            style={{ display: 'flex', minWidth: TIME_COL_WIDTH + totalDays * COL_WIDTH, position: 'relative' }}
          >
            {/* Time label column */}
            <div style={{ width: TIME_COL_WIDTH, flexShrink: 0, position: 'sticky', left: 0, zIndex: 3, background: '#F5F7FA' }}>
              {/* Header cell */}
              <div style={headerCellStyle(TIME_COL_WIDTH, true)}>&nbsp;</div>
              {/* Time rows */}
              <div style={{ position: 'relative', height: gridHeight + 20 }}>
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
                {/* End of view timespan label */}
                <div
                  style={{
                    position: 'absolute',
                    top: rowCount * ROW_HEIGHT,
                    width: '100%',
                    height: 20,
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'flex-end',
                    paddingRight: 6,
                    paddingTop: 2,
                    borderTop: '1px solid #D0D7E3',
                    boxSizing: 'border-box',
                  }}
                >
                  <Text style={{ fontSize: 10, color: '#7A8BA8', lineHeight: 1, fontWeight: 700 }}>
                    {toTime(viewEnd)}
                  </Text>
                </div>
              </div>
            </div>

            {/* Day columns */}
            {DAY_ORDER.map((day) => {
              // Get entries for the day, and filter by timespan overlap
              const dayEntries = slotEntries.filter((se) => {
                const isDragged = dragState !== null &&
                  dragState.entry.id === se.entry.id &&
                  dragState.originalDay === se.day &&
                  dragState.schedule.id === se.schedule.id;
                const isResized = resizeState !== null &&
                  resizeState.entry.id === se.entry.id &&
                  resizeState.day === se.day &&
                  resizeState.schedule.id === se.schedule.id;
                const activeDay = isDragged ? dragState.currentDay : se.day;
                const activeStart = isDragged
                  ? dragState.currentStartMin
                  : (isResized ? resizeState.currentStartMin : se.startMin);
                const activeEnd = isDragged
                  ? (dragState.currentStartMin + dragState.duration)
                  : (isResized ? resizeState.currentEndMin : se.endMin);
                return activeDay === day && activeStart < viewEnd && activeEnd > viewStart;
              });
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
                  {/* Day header (white text for the x-axis) */}
                  <div style={headerCellStyle(COL_WIDTH, false)}>
                    <Text strong style={{ fontSize: 12, color: '#ffffff' }}>
                      {day}
                    </Text>
                  </div>

                  {/* Entry cells */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.08)';
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.style.backgroundColor = 'transparent';
                      const entryId = e.dataTransfer.getData('text/plain');
                      if (!entryId) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const relativeY = e.clientY - rect.top;
                      const slotIndex = Math.floor(relativeY / ROW_HEIGHT);
                      const startMin = viewStart + slotIndex * SLOT_INTERVAL;
                      onDropEntry?.(entryId, day, startMin);
                    }}
                    style={{ position: 'relative', height: gridHeight + 20, transition: 'background-color 0.2s ease' }}
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
                        }}
                      />
                    ))}
                    <div
                      style={{
                        position: 'absolute',
                        top: rowCount * ROW_HEIGHT,
                        left: 0,
                        right: 0,
                        height: 20,
                        borderTop: '1px solid #D0D7E3',
                      }}
                    />

                    {/* Scheduled entry blocks */}
                    {dayEntries.map((se, idx) => {
                      // Clamp to view bounds
                      const isDragged = dragState !== null &&
                        dragState.entry.id === se.entry.id &&
                        dragState.originalDay === se.day &&
                        dragState.schedule.id === se.schedule.id;

                      const isResized = resizeState !== null &&
                        resizeState.entry.id === se.entry.id &&
                        resizeState.day === se.day &&
                        resizeState.schedule.id === se.schedule.id;

                      const displayStart = Math.max(
                        isDragged ? dragState.currentStartMin : (isResized ? resizeState.currentStartMin : se.startMin),
                        viewStart
                      );
                      const displayEnd = Math.min(
                        isDragged ? (dragState.currentStartMin + dragState.duration) : (isResized ? resizeState.currentEndMin : se.endMin),
                        viewEnd
                      );

                      const topPx = ((displayStart - viewStart) / SLOT_INTERVAL) * ROW_HEIGHT;
                      const heightPx = ((displayEnd - displayStart) / SLOT_INTERVAL) * ROW_HEIGHT;
                      const color = colorForSubject(se.entry.subjectCode, se.entry.color);
                      const isEditing = editingEntryId === se.entry.id;

                      return (
                        <Tooltip
                          key={idx}
                          title={
                            <div style={{ fontSize: 11 }}>
                              <div>
                                <strong>{se.entry.subjectCode}</strong> — {se.entry.offerCode}
                              </div>
                              <div>{se.entry.subjectDescription}</div>
                              <div>{se.entry.program} ({se.entry.programShorthand})</div>
                              <div>{se.entry.year} - {se.entry.section}</div>
                              <div>Teacher: {formatTeacherForDisplay(se.entry.assignedTeacherName)}</div>
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
                                { label: 'Edit Entry', key: 'edit', icon: <EditOutlined /> },
                                { label: 'Delete Schedule Slot', key: 'delete', icon: <DeleteOutlined />, danger: true },
                                { label: 'Go to entry', key: 'goto', icon: <AimOutlined /> },
                              ],
                              onClick: ({ key, domEvent }) => {
                                domEvent.stopPropagation();
                                if (key === 'edit') {
                                  onEditEntry?.(se.entry);
                                } else if (key === 'delete') {
                                  if (onDeleteSchedule) {
                                    onDeleteSchedule(se.entry.id, se.schedule.id);
                                  } else if (onDeleteEntry) {
                                    onDeleteEntry(se.entry.id);
                                  }
                                } else if (key === 'goto') {
                                  const el = document.getElementById(`subject-card-${se.entry.id}`);
                                  if (el) {
                                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    el.focus();
                                  }
                                }
                              }
                            }}
                            trigger={['contextMenu']}
                          >
                            <div
                              id={`grid-block-${se.entry.id}-${se.schedule.id}`}
                              className="timetable-entry-block"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              onKeyDown={(e) => {
                              if (e.key === 'Delete' || e.key === 'Backspace') {
                                e.stopPropagation();
                                e.preventDefault();
                                if (se.entry.schedules.length <= 1) {
                                  onDeleteEntry?.(se.entry.id);
                                } else {
                                  const updated = {
                                    ...se.entry,
                                    schedules: se.entry.schedules.filter((s) => s.id !== se.schedule.id),
                                  };
                                  onUpdateEntry?.(updated);
                                }
                              }
                            }}
                            onMouseDown={(e) => {
                              if (e.button !== 0) return;
                              e.stopPropagation();
                              setDragState({
                                entry: se.entry,
                                schedule: se.schedule,
                                originalDay: se.day,
                                currentDay: se.day,
                                originalStartMin: se.startMin,
                                currentStartMin: se.startMin,
                                duration: se.endMin - se.startMin,
                                startX: e.pageX,
                                startY: e.pageY,
                                offsetX: 0,
                                offsetY: 0,
                              });
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
                              zIndex: isDragged || isResized ? 4 : (isEditing ? 3 : 1),
                              opacity: isDragged || isResized ? 0.75 : 1,
                              border: isDragged || isResized
                                ? '2px dashed rgba(255,255,255,0.8)'
                                : isEditing ? '2px solid rgba(255,255,255,0.95)' : 'none',
                              boxShadow: isEditing
                                ? '0 0 0 3px rgba(59,130,246,0.7), 0 4px 16px rgba(0,0,0,0.35)'
                                : '0 1px 3px rgba(0,0,0,0.2)',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'flex-start',
                              cursor: isDragged ? 'move' : 'pointer',
                            }}
                          >
                            {/* Top resize handle */}
                            <div
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: 6,
                                cursor: 'ns-resize',
                                zIndex: 10,
                              }}
                              onMouseDown={(e) => {
                                if (e.button !== 0) return;
                                e.stopPropagation();
                                setResizeState({
                                  entry: se.entry,
                                  schedule: se.schedule,
                                  day: se.day,
                                  edge: 'top',
                                  originalStartMin: se.startMin,
                                  originalEndMin: se.endMin,
                                  currentStartMin: se.startMin,
                                  currentEndMin: se.endMin,
                                  startY: e.pageY,
                                });
                              }}
                            />
                            {/* Bottom resize handle */}
                            <div
                              style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                height: 6,
                                cursor: 'ns-resize',
                                zIndex: 10,
                              }}
                              onMouseDown={(e) => {
                                if (e.button !== 0) return;
                                e.stopPropagation();
                                setResizeState({
                                  entry: se.entry,
                                  schedule: se.schedule,
                                  day: se.day,
                                  edge: 'bottom',
                                  originalStartMin: se.startMin,
                                  originalEndMin: se.endMin,
                                  currentStartMin: se.startMin,
                                  currentEndMin: se.endMin,
                                  startY: e.pageY,
                                });
                              }}
                            />
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: '#fff',
                                lineHeight: 1.3,
                                display: 'block',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {se.entry.subjectCode}
                            </Text>
                            {heightPx >= 36 && (
                              <Text
                                style={{
                                  fontSize: 9,
                                  color: 'rgba(255,255,255,0.95)',
                                  lineHeight: 1.3,
                                  display: 'block',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {se.entry.programShorthand} - {se.entry.year}{se.entry.section}
                              </Text>
                            )}
                            {heightPx >= 48 && (
                              <Text
                                style={{
                                  fontSize: 9,
                                  color: 'rgba(255,255,255,0.85)',
                                  lineHeight: 1.3,
                                  display: 'block',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {(() => {
                                  const { lastName, firstName } = parseTeacherName(se.entry.assignedTeacherName);
                                  return firstName ? `${firstName.charAt(0).toUpperCase()}. ${lastName}` : lastName;
                                })()}
                              </Text>
                            )}
                          </div>
                          </Dropdown>
                        </Tooltip>
                      );
                    })}

                    {/* Render overlap overlay elements for conflicts */}
                    {(() => {
                      const overlapsList: { startMin: number; endMin: number; entries: SubjectEntry[] }[] = [];
                      for (let i = 0; i < dayEntries.length; i++) {
                        for (let j = i + 1; j < dayEntries.length; j++) {
                          const a = dayEntries[i];
                          const b = dayEntries[j];
                          const overlapStart = Math.max(a.startMin, b.startMin);
                          const overlapEnd = Math.min(a.endMin, b.endMin);
                          if (overlapStart < overlapEnd) {
                            const existingIdx = overlapsList.findIndex(
                              (o) => o.startMin === overlapStart && o.endMin === overlapEnd
                            );
                            if (existingIdx >= 0) {
                              const existingList = overlapsList[existingIdx].entries;
                              if (!existingList.some((e) => e.id === a.entry.id)) {
                                existingList.push(a.entry);
                              }
                              if (!existingList.some((e) => e.id === b.entry.id)) {
                                existingList.push(b.entry);
                              }
                            } else {
                              overlapsList.push({
                                startMin: overlapStart,
                                endMin: overlapEnd,
                                entries: [a.entry, b.entry]
                              });
                            }
                          }
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
                                    <div>{ent.program} ({ent.programShorthand})</div>
                                    <div>{ent.year} - {ent.section}</div>
                                    <div>Teacher: {formatTeacherForDisplay(ent.assignedTeacherName)}</div>
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
                                      if (el) {
                                        el.classList.add('highlight-pulse');
                                      }
                                    }
                                  }}
                                  onMouseLeave={() => {
                                    for (const s of ent.schedules) {
                                      const el = document.getElementById(`grid-block-${ent.id}-${s.id}`);
                                      if (el) {
                                        el.classList.remove('highlight-pulse');
                                      }
                                    }
                                  }}
                                  style={{
                                    padding: '6px 10px',
                                    background: colorForSubject(ent.subjectCode, ent.color),
                                    color: '#ffffff',
                                    borderRadius: 4,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
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
                                        if (el instanceof HTMLElement) {
                                          el.focus();
                                        }
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
                            onOpenChange={(visible) => {
                              setActivePopoverKey(visible ? popoverKey : null);
                            }}
                            trigger="hover"
                            placement="right"
                          >
                            <div
                              key={`overlap-${oIdx}`}
                              style={{
                                position: 'absolute',
                                top: topPx + 1,
                                left: 2,
                                right: 2,
                                height: Math.max(heightPx - 2, 20),
                                backgroundImage: 'linear-gradient(45deg, rgba(255, 77, 79, 0.3) 25%, transparent 25%, transparent 50%, rgba(255, 77, 79, 0.3) 50%, rgba(255, 77, 79, 0.3) 75%, transparent 75%, transparent)',
                                backgroundSize: '12px 12px',
                                backgroundColor: 'rgba(255, 77, 79, 0.05)',
                                border: '1px solid rgba(255, 77, 79, 0.4)',
                                borderRadius: 3,
                                zIndex: 2,
                                pointerEvents: 'auto',
                                cursor: 'help',
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
      )}
    </div>
  );
});

function headerCellStyle(width: number, isTimeCol: boolean): React.CSSProperties {
  return {
    width,
    height: 32,
    background: isTimeCol ? '#F5F7FA' : '#1E3560',
    display: 'flex',
    alignItems: 'center',
    justifyContent: isTimeCol ? 'flex-end' : 'center',
    paddingRight: isTimeCol ? 6 : 0,
    borderBottom: '2px solid #2B4C7E',
    position: 'sticky',
    top: 0,
    zIndex: 2,
    boxSizing: 'border-box',
  };
}
