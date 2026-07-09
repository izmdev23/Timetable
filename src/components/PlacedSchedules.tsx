import { Typography, Dropdown } from 'antd';
import { CalendarOutlined, DeleteOutlined, AimOutlined } from '@ant-design/icons';
import type { SubjectEntry } from '../types';
import { formatTimeTo12Hr } from '../utils/time';
import { colorForSubject } from '../theme';

const { Text } = Typography;

interface PlacedSchedulesProps {
  entries: SubjectEntry[];
  onHighlightSchedule: (entryId: string, scheduleId: string) => void;
  onDeleteSchedule: (entryId: string, scheduleId: string) => void;
}

export function PlacedSchedules({
  entries,
  onHighlightSchedule,
  onDeleteSchedule,
}: PlacedSchedulesProps) {
  const scheduleItems = entries.flatMap((entry) => {
    return entry.schedules.flatMap((s) => {
      return s.days.map((day) => ({
        entry,
        schedule: s,
        day,
        uniqueKey: `${entry.id}-${s.id}-${day}`,
      }));
    });
  });

  return (
    <div
      style={{
        width: 260,
        background: '#FFFFFF',
        borderLeft: '1px solid #D0D7E3',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #E4E9F0', background: '#F8FAFC' }}>
        <Text strong style={{ fontSize: 13, color: '#1E3560' }}>
          <CalendarOutlined style={{ marginRight: 6 }} /> Placed Schedules ({scheduleItems.length})
        </Text>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {scheduleItems.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#7A8BA8', fontSize: 12 }}>
            Drag blueprints to the timetable grid to place them.
          </div>
        ) : (
          scheduleItems.map(({ entry, schedule, day, uniqueKey }) => {
            const bg = colorForSubject(entry.subjectCode, entry.color);

            const menuItems = [
              { label: 'Delete Schedule Slot', key: 'delete', icon: <DeleteOutlined />, danger: true },
              { label: 'Go to entry', key: 'goto', icon: <AimOutlined /> },
            ];

            return (
              <Dropdown
                key={uniqueKey}
                menu={{
                  items: menuItems,
                  onClick: ({ key, domEvent }) => {
                    domEvent.stopPropagation();
                    if (key === 'delete') {
                      onDeleteSchedule(entry.id, schedule.id);
                    } else if (key === 'goto') {
                      const el = document.getElementById(`subject-card-${entry.id}`);
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
                  onClick={() => onHighlightSchedule(entry.id, schedule.id)}
                  style={{
                    borderLeft: `4px solid ${bg}`,
                    background: '#F8FAFC',
                    border: '1px solid #E4E9F0',
                    borderLeftWidth: 4,
                    borderRadius: 4,
                    padding: '8px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    transition: 'all 0.15s ease',
                    userSelect: 'none',
                  }}
                  className="subject-card-item"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong style={{ fontSize: 12, color: '#1E3560' }}>{entry.subjectCode}</Text>
                    <span style={{ fontSize: 10, color: '#7A8BA8', fontWeight: 600 }}>{entry.offerCode}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#4A5B78', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {entry.subjectDescription}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#7A8BA8', marginTop: 2 }}>
                    <span>Room: <strong style={{ color: '#4A5B78' }}>{entry.room || 'N/A'}</strong></span>
                    <span style={{ color: '#2B4C7E', fontWeight: 600 }}>{day} {formatTimeTo12Hr(schedule.startTime)}–{formatTimeTo12Hr(schedule.endTime)}</span>
                  </div>
                </div>
              </Dropdown>
            );
          })
        )}
      </div>
    </div>
  );
}
