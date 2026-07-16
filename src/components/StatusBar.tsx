import { Button, Select, Typography, Drawer, List, ConfigProvider, Space, Badge } from 'antd';
import { LinkOutlined, BellFilled, CloseCircleFilled, ReloadOutlined } from '@ant-design/icons';
import type { SubjectEntry, ConflictInfo } from '../types';
import { useState, useMemo } from 'react';

const { Text } = Typography;

/** Fixed Academic Blue background for the status bar — not affected by theme dropdown */
const STATUS_BAR_BG = '#1E3560';

interface StatusBarProps {
  fileName: string | null;
  linkingModeActive: boolean;
  onToggleLinkingMode: () => void;
  roomOptions: Array<{ label: string; value: string }>;
  activeRoom: string | null;
  onActiveRoomChange: (room: string) => void;
  linkingFirstBlockKey: string | null;
  allConflictsList: Array<{ entry: SubjectEntry; conflict: ConflictInfo }>;
  onHighlightSchedule: (entryId: string, scheduleId: string) => void;
  isDirty: boolean;
  statusMessage?: string;

  importNotifications?: string[];
  roomConflictSummary?: Array<{ room: string; conflictCount: number; roomValue: string }>;
  onRefreshRoomConflicts?: () => void;

  // Collaboration
  collabConnected?: boolean;
  collabLatency?: number;
  collabUsersCount?: number;
  collabSessionInfo?: { ip: string; port: number } | null;
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
  isDirty,
  statusMessage,
  importNotifications = [],
  roomConflictSummary = [],
  onRefreshRoomConflicts,

  collabConnected,
  collabLatency,
  collabUsersCount,
  collabSessionInfo,
}: StatusBarProps) {
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);

  const bgColor = STATUS_BAR_BG;

  const latestConflict = allConflictsList.length > 0 ? allConflictsList[allConflictsList.length - 1] : null;
  const totalConflicts = useMemo(() => roomConflictSummary.reduce((sum, r) => sum + r.conflictCount, 0), [roomConflictSummary]);
  const checkedRooms = roomConflictSummary.length;
  const roomsWithConflicts = roomConflictSummary.filter(r => r.conflictCount > 0).length;

  return (
    <div
      style={{
        background: bgColor,
        borderTop: '1px solid rgba(255,255,255,0.15)',
        padding: '0 8px',
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        zIndex: 10,
        height: 28,
        fontSize: 10,
      }}
    >
      {/* Left: Collab indicator + Filename + status message */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, marginRight: 8 }}>
        {collabConnected && (
          <Text
            style={{
              fontSize: 10,
              color: '#52c41a',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              cursor: 'help',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
            title={collabSessionInfo ? `${collabSessionInfo.ip}:${collabSessionInfo.port} · ${collabUsersCount || 0} users · ${collabLatency}ms` : undefined}
          >
            🟢 {collabUsersCount || 0}
          </Text>
        )}
        <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)' }}>
          {fileName && isDirty && (
            <Text style={{ fontSize: 14, lineHeight: '10px', color: 'rgba(255,255,255,0.85)' }}>●</Text>
          )}{' '}
          {fileName || 'Unsaved Timetable'}
          {statusMessage && (
            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic' }}>
              {' '}({statusMessage})
            </Text>
          )}
        </Text>
      </div>

      {/* Left-center: Latest conflict message */}
      {latestConflict && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginRight: 8, color: '#ff6b6b', fontWeight: 500, flexShrink: 0 }}>
          <CloseCircleFilled style={{ fontSize: 10 }} />
          <Text style={{ fontSize: 10, color: '#ff6b6b' }}>
            {latestConflict.entry.offerCode} × {latestConflict.conflict.conflictingEntry.offerCode} ({latestConflict.conflict.type})
          </Text>
        </div>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Center: Link Mode status/button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginRight: 8 }}>
        {linkingModeActive && (
          <Text style={{ fontSize: 10, color: '#85C1E9', fontWeight: 600 }}>
            <LinkOutlined style={{ marginRight: 3 }} />
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
          style={{ fontSize: 10, height: 22 }}
        >
          {linkingModeActive ? 'Exit Link Mode' : 'Link Mode'}
        </Button>
      </div>

      {/* Right: Room selector + notification bell */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Room:</Text>
        <ConfigProvider
          theme={{
            components: {
              Select: {
                colorBgContainer: 'transparent',
                colorBorder: 'rgba(255,255,255,0.25)',
                colorBgElevated: '#FFFFFF',
                controlItemBgHover: '#F5F7FA',
              },
            },
          }}
        >
          <Select
            size="small"
            variant="borderless"
            style={{ width: 140, color: 'rgba(255,255,255,0.85)' }}
            dropdownStyle={{ minWidth: 160, color: '#1A2640' }}
            value={activeRoom}
            onChange={onActiveRoomChange}
            options={roomOptions}
            placeholder="Select Room"
          />
        </ConfigProvider>
        <Badge
          count={totalConflicts}
          size="small"
          offset={[0, 2]}
          styles={{ root: { lineHeight: '14px' } }}
        >
          <Button
            size="small"
            type="text"
            icon={<BellFilled style={{ fontSize: '14px', color: allConflictsList.length > 0 || totalConflicts > 0 ? '#ff6b6b' : (importNotifications.length > 0 ? '#1890ff' : 'rgba(255,255,255,0.7)') }} />}
            onClick={() => setNotifDrawerOpen(true)}
            style={{
              border: 'none',
              padding: '0 6px',
              height: '22px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.7)',
            }}
            className="status-bar-btn"
          />
        </Badge>
      </div>

      {/* Notifications Drawer */}
      <Drawer
        title={<span style={{ fontWeight: 600, color: '#ff4d4f' }}>Notifications</span>}
        placement="right"
        width={420}
        onClose={() => setNotifDrawerOpen(false)}
        open={notifDrawerOpen}
      >
        {(allConflictsList.length === 0 && importNotifications.length === 0 && roomConflictSummary.length === 0) ? (
          <div style={{ padding: 12, color: '#7A8BA8', fontSize: 12 }}>No notifications.</div>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            {importNotifications.length > 0 && (
              <List
                header={<span style={{ fontWeight: 600, color: '#1890ff', fontSize: '13px' }}>Import Logs</span>}
                size="small"
                bordered
                dataSource={importNotifications}
                renderItem={(item) => (
                  <List.Item style={{ fontSize: '12px', color: '#595959', padding: '6px 12px' }}>
                    • {item}
                  </List.Item>
                )}
              />
            )}
            {allConflictsList.length > 0 && (
              <List
                header={<span style={{ fontWeight: 600, color: '#ff4d4f', fontSize: '13px' }}>Conflicts</span>}
                size="small"
                dataSource={allConflictsList}
                renderItem={({ entry, conflict }, idx) => (
                  <div
                    onMouseEnter={() => {
                      const s1 = entry.schedules.find(
                        (s) => s.days.includes(conflict.day) && s.startTime === conflict.startTime
                      );
                      if (s1) onHighlightSchedule(entry.id, s1.id);
                      const s2 = conflict.conflictingEntry.schedules.find(
                        (s) => s.days.includes(conflict.day) && s.startTime === conflict.startTime
                      );
                      if (s2) onHighlightSchedule(conflict.conflictingEntry.id, s2.id);
                    }}
                    style={{
                      padding: '6px 8px',
                      borderBottom: idx < allConflictsList.length - 1 ? '1px solid #f0f0f0' : 'none',
                      fontSize: '12px',
                      color: '#434343',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease',
                    }}
                    className="conflict-hover-item"
                  >
                    <span>
                      Offer Code <strong style={{ color: '#D32F2F' }}>{entry.offerCode}</strong> conflicts with <strong style={{ color: '#D32F2F' }}>{conflict.conflictingEntry.offerCode}</strong> ({conflict.type} conflict on {conflict.day})
                    </span>
                  </div>
                )}
              />
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, color: '#faad14', fontSize: '13px' }}>Room Conflict Summary</span>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={onRefreshRoomConflicts}
                  style={{ fontSize: 11 }}
                >
                  Check Now
                </Button>
              </div>
              {roomConflictSummary.length === 0 ? (
                <div style={{ padding: '4px 0', fontSize: 12, color: '#8c8c8c' }}>
                  Click "Check Now" to scan all rooms for conflicts.
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 8 }}>
                    {checkedRooms} room{checkedRooms > 1 ? 's' : ''} checked — {roomsWithConflicts} have conflicts, {checkedRooms - roomsWithConflicts} are clean
                  </div>
                  <List
                    size="small"
                    dataSource={roomConflictSummary}
                    renderItem={(item) => (
                      <div
                        onClick={() => onActiveRoomChange(item.roomValue)}
                        style={{
                          padding: '4px 8px',
                          fontSize: '12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer',
                          borderRadius: 3,
                          transition: 'background-color 0.15s ease',
                        }}
                        className="conflict-hover-item"
                      >
                        <span>{item.room}</span>
                        <span style={{
                          fontWeight: 600,
                          color: item.conflictCount === 0 ? '#52c41a' : item.conflictCount <= 2 ? '#faad14' : '#ff4d4f',
                          fontSize: 11,
                        }}>
                          {item.conflictCount === 0 ? 'Clean' : `${item.conflictCount} conflict${item.conflictCount > 1 ? 's' : ''}`}
                        </span>
                      </div>
                    )}
                  />
                </>
              )}
            </div>
          </Space>
        )}
      </Drawer>
    </div>
  );
}
