import { Button, Select, Typography, Drawer, List, ConfigProvider, Space } from 'antd';
import { LinkOutlined, BellFilled, CloseCircleFilled } from '@ant-design/icons';
import type { SubjectEntry, ConflictInfo } from '../types';
import { useState } from 'react';

const { Text } = Typography;

const THEME_BG: Record<string, string> = {
  blue: '#1E3560',
  green: '#2A4B37',
  purple: '#4A2758',
  orange: '#8A520A',
  charcoal: '#27354B',
};

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
  theme?: string;
  importNotifications?: string[];
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
  theme = 'blue',
  importNotifications = [],
}: StatusBarProps) {
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);

  const bgColor = THEME_BG[theme] || THEME_BG.blue;

  const latestConflict = allConflictsList.length > 0 ? allConflictsList[allConflictsList.length - 1] : null;

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
      {/* Left: Filename + status message */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, marginRight: 8 }}>
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
        <Button
          size="small"
          type="text"
          icon={<BellFilled style={{ fontSize: '14px', color: allConflictsList.length > 0 ? '#ff6b6b' : (importNotifications.length > 0 ? '#1890ff' : 'rgba(255,255,255,0.7)') }} />}
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
      </div>

      {/* Notifications Drawer */}
      <Drawer
        title={<span style={{ fontWeight: 600, color: '#ff4d4f' }}>Notifications</span>}
        placement="right"
        width={420}
        onClose={() => setNotifDrawerOpen(false)}
        open={notifDrawerOpen}
      >
        {allConflictsList.length === 0 && importNotifications.length === 0 ? (
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
          </Space>
        )}
      </Drawer>
    </div>
  );
}
