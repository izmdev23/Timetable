import { Button, Select, Typography, Popover } from 'antd';
import { LinkOutlined, BellFilled, CloseCircleFilled } from '@ant-design/icons';
import type { SubjectEntry, ConflictInfo } from '../types';

const { Text } = Typography;

interface StatusBarProps {
  fileName: string | null;
  linkingModeActive: boolean;
  onToggleLinkingMode: () => void;
  roomOptions: string[];
  activeRoom: string | null;
  onActiveRoomChange: (room: string) => void;
  linkingFirstBlockKey: string | null;
  allConflictsList: Array<{ entry: SubjectEntry; conflict: ConflictInfo }>;
  onHighlightSchedule: (entryId: string, scheduleId: string) => void;
}

export function StatusBar({
  fileName,
  linkingModeActive,
  onToggleLinkingMode,
  roomOptions,
  activeRoom,
  onActiveRoomChange,
  linkingFirstBlockKey,
  allConflictsList,
  onHighlightSchedule,
}: StatusBarProps) {
  const latestConflict = allConflictsList.length > 0 ? allConflictsList[allConflictsList.length - 1] : null;

  const conflictPopoverContent = (
    <div style={{ maxHeight: '272px', overflowY: 'auto', width: '420px' }}>
      {allConflictsList.map(({ entry, conflict }, idx) => (
        <div
          key={idx}
          onMouseEnter={() => {
            const s1 = entry.schedules.find(
              (s) => s.days.includes(conflict.day) && s.startTime === conflict.startTime
            );
            if (s1) {
              onHighlightSchedule(entry.id, s1.id);
            }
            const s2 = conflict.conflictingEntry.schedules.find(
              (s) => s.days.includes(conflict.day) && s.startTime === conflict.startTime
            );
            if (s2) {
              onHighlightSchedule(conflict.conflictingEntry.id, s2.id);
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
  );

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderTop: '1px solid #D0D7E3',
        padding: '4px 12px',
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        zIndex: 10,
        height: 32,
        fontSize: 11,
      }}
    >
      {/* Left: Filename */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, marginRight: 12 }}>
        <Text style={{ fontSize: 11, color: '#7A8BA8' }}>
          {fileName || 'Unsaved Timetable'}
        </Text>
      </div>

      {/* Left-center: Latest conflict message */}
      {latestConflict && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 12, color: '#ff4d4f', fontWeight: 500, flexShrink: 0 }}>
          <CloseCircleFilled style={{ fontSize: 11 }} />
          <Text style={{ fontSize: 11, color: '#ff4d4f' }}>
            {latestConflict.entry.offerCode} × {latestConflict.conflict.conflictingEntry.offerCode} ({latestConflict.conflict.type})
          </Text>
        </div>
      )}

      {/* Spacer pushes center and right groups */}
      <div style={{ flex: 1 }} />

      {/* Center: Link Mode status/button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginRight: 12 }}>
        {linkingModeActive && (
          <Text style={{ fontSize: 11, color: '#0050B3', fontWeight: 600 }}>
            <LinkOutlined style={{ marginRight: 4 }} />
            {linkingFirstBlockKey
              ? 'Now click second block to link'
              : 'Click a schedule block as parent'}
          </Text>
        )}
        <Button
          size="small"
          type={linkingModeActive ? 'primary' : 'default'}
          danger={linkingModeActive}
          icon={<LinkOutlined />}
          onClick={onToggleLinkingMode}
          style={{ fontSize: 11, height: 24 }}
        >
          {linkingModeActive ? 'Exit Link Mode' : 'Link Mode'}
        </Button>
      </div>

      {/* Right: Room selector + conflict bell */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <Text style={{ fontSize: 11, color: '#7A8BA8' }}>Room:</Text>
        <Select
          size="small"
          style={{ width: 140 }}
          value={activeRoom}
          onChange={onActiveRoomChange}
          options={roomOptions.map((r) => ({ label: r, value: r }))}
          placeholder="Select Room"
        />
        <Popover
          content={allConflictsList.length > 0 ? conflictPopoverContent : <div style={{ padding: 12, color: '#7A8BA8', fontSize: 12 }}>No conflicts detected.</div>}
          title={<span style={{ fontWeight: 600, color: '#ff4d4f' }}>Conflict Details</span>}
          trigger="click"
          placement="topRight"
        >
          <Button
            size="small"
            type="text"
            className="conflict-bell-btn"
            icon={<BellFilled style={{ fontSize: '14px', color: allConflictsList.length > 0 ? '#ff4d4f' : '#7A8BA8' }} />}
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
    </div>
  );
}
