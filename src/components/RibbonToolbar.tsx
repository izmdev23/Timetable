import { Button, Select, Checkbox, Space, Divider, Typography, Tooltip } from 'antd';
import {
  SaveOutlined,
  DownloadOutlined,
  UploadOutlined,
  EyeOutlined,
  PlusOutlined,
  UndoOutlined,
  RedoOutlined
} from '@ant-design/icons';
import type { DayOfWeek } from '../types';
import { DAY_ORDER } from '../types';

const { Text } = Typography;
import { Tag } from 'antd';
const AntdCheckableTag = Tag.CheckableTag;

interface RibbonToolbarProps {
  // File operations
  onSave: () => void;
  onSaveAs: () => void;
  onImportMerge: () => void;
  onExportSuggestions: () => void;
  onImportSuggestions: () => void;
  onViewSuggestions: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;

  // View settings
  filterType: 'all' | 'student' | 'teacher' | 'room';
  onFilterTypeChange: (val: 'all' | 'student' | 'teacher' | 'room') => void;
  selectedStudentKey: string | null;
  onSelectedStudentKeyChange: (val: string | null) => void;
  studentSchedules: { label: string; value: string }[];
  selectedTeacher: string | null;
  onSelectedTeacherChange: (val: string | null) => void;
  teacherOptions: { label: string; value: string }[];
  selectedRooms: string[];
  onSelectedRoomsChange: (val: string[]) => void;
  roomOptions: string[];
  theme: string;
  onThemeChange: (val: string) => void;
  bandedRows: boolean;
  onBandedRowsChange: (val: boolean) => void;

  // Timetable Grid settings
  hiddenDays: DayOfWeek[];
  onToggleDay: (days: DayOfWeek[]) => void;
  viewStart: number;
  onViewStartChange: (val: number) => void;
  viewEnd: number;
  onViewEndChange: (val: number) => void;
  timeOptions: { label: string; value: number }[];

  // App Actions
  onAddSubjectEntry: () => void;
}

export function RibbonToolbar({
  onSave,
  onSaveAs,
  onImportMerge,
  onExportSuggestions,
  onImportSuggestions,
  onViewSuggestions,
  canUndo,
  canRedo,
  onUndo,
  onRedo,

  filterType,
  onFilterTypeChange,
  selectedStudentKey,
  onSelectedStudentKeyChange,
  studentSchedules,
  selectedTeacher,
  onSelectedTeacherChange,
  teacherOptions,
  selectedRooms,
  onSelectedRoomsChange,
  roomOptions,
  theme,
  onThemeChange,
  bandedRows,
  onBandedRowsChange,

  hiddenDays,
  onToggleDay,
  viewStart,
  onViewStartChange,
  viewEnd,
  onViewEndChange,
  timeOptions,

  onAddSubjectEntry,
}: RibbonToolbarProps) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #D0D7E3',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
        zIndex: 10,
        height: 84,
        flexShrink: 0,
      }}
    >
      {/* File Group */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <Space size={3}>
          <Tooltip title="Save Timetable (Ctrl+S)">
            <Button icon={<SaveOutlined />} onClick={onSave} style={{ padding: '8px 10px' }} />
          </Tooltip>
          <Tooltip title="Export Timetable (XLSX / JSON) (Ctrl+Shift+S)">
            <Button icon={<DownloadOutlined />} onClick={onSaveAs} style={{ padding: '8px 10px' }} />
          </Tooltip>
          <Tooltip title="Import & Merge Schedules">
            <Button icon={<UploadOutlined />} onClick={onImportMerge} style={{ padding: '8px 10px' }} />
          </Tooltip>
        </Space>
        <Text style={{ fontSize: 10, color: '#7A8BA8', fontWeight: 600 }}>FILE</Text>
      </div>

      <Divider type="vertical" style={{ height: '70%', margin: '0 4px', borderColor: '#D0D7E3' }} />

      {/* History Group */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <Space size={3}>
          <Button icon={<UndoOutlined />} disabled={!canUndo} onClick={onUndo} style={{ padding: '8px 10px' }} />
          <Button icon={<RedoOutlined />} disabled={!canRedo} onClick={onRedo} style={{ padding: '8px 10px' }} />
        </Space>
        <Text style={{ fontSize: 10, color: '#7A8BA8', fontWeight: 600 }}>HISTORY</Text>
      </div>

      <Divider type="vertical" style={{ height: '70%', margin: '0 4px', borderColor: '#D0D7E3' }} />

      {/* Autocomplete suggestions */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <Space size={3}>
          <Tooltip title="Export Autocomplete Suggestions">
            <Button icon={<DownloadOutlined />} onClick={onExportSuggestions} style={{ padding: '8px 10px' }} />
          </Tooltip>
          <Tooltip title="Import Autocomplete Suggestions">
            <Button icon={<UploadOutlined />} onClick={onImportSuggestions} style={{ padding: '8px 10px' }} />
          </Tooltip>
          <Tooltip title="View Imported Autocomplete Suggestions">
            <Button icon={<EyeOutlined />} onClick={onViewSuggestions} style={{ padding: '8px 10px' }} />
          </Tooltip>
        </Space>
        <Text style={{ fontSize: 10, color: '#7A8BA8', fontWeight: 600 }}>SUGGESTIONS</Text>
      </div>

      <Divider type="vertical" style={{ height: '70%', margin: '0 4px', borderColor: '#D0D7E3' }} />

      {/* Add Entry Action */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={onAddSubjectEntry}
          style={{ background: '#2B4C7E', borderColor: '#2B4C7E', padding: '8px 12px', fontWeight: 500 }}
        >
          Add Subject
        </Button>
        <Text style={{ fontSize: 10, color: '#7A8BA8', fontWeight: 600 }}>INSERT</Text>
      </div>

      <Divider type="vertical" style={{ height: '70%', margin: '0 4px', borderColor: '#D0D7E3' }} />

      {/* Filter and View options */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <Space size={4}>
          <Select
            value={filterType}
            onChange={onFilterTypeChange}
            style={{ width: 130 }}
            options={[
              { label: 'All Schedules', value: 'all' },
              { label: 'Student Schedule', value: 'student' },
              { label: 'Teacher Schedule', value: 'teacher' },
              { label: 'Room Schedule', value: 'room' },
            ]}
          />
          {filterType === 'student' && (
            <Select
              value={selectedStudentKey}
              onChange={onSelectedStudentKeyChange}
              style={{ width: 150 }}
              options={studentSchedules}
              placeholder="Select Student"
              disabled={studentSchedules.length === 0}
            />
          )}
          {filterType === 'teacher' && (
            <Select
              value={selectedTeacher}
              onChange={onSelectedTeacherChange}
              style={{ width: 150 }}
              options={teacherOptions}
              placeholder="Select Teacher"
              disabled={teacherOptions.length === 0}
            />
          )}
          {filterType === 'room' && (
            <Space size={4}>
              <Select
                mode="tags"
                tokenSeparators={[',']}
                value={selectedRooms}
                onChange={onSelectedRoomsChange}
                style={{ width: 150 }}
                placeholder="Select Rooms"
                options={[{ label: 'All', value: 'all' }, ...roomOptions.map((r) => ({ label: r, value: r }))]}
                maxTagCount="responsive"
              />
              <Button onClick={() => onSelectedRoomsChange(['all'])}>
                Clear All
              </Button>
            </Space>
          )}
          <Select
            value={theme}
            onChange={onThemeChange}
            style={{ width: 120 }}
            options={[
              { label: 'Academic Blue', value: 'blue' },
              { label: 'Emerald Forest', value: 'green' },
              { label: 'Amethyst Purple', value: 'purple' },
              { label: 'Sunset Terracotta', value: 'orange' },
              { label: 'Midnight Slate', value: 'charcoal' },
            ]}
          />
          <Checkbox checked={bandedRows} onChange={(e) => onBandedRowsChange(e.target.checked)} style={{ fontSize: 11 }}>
            Banded
          </Checkbox>
        </Space>
        <Text style={{ fontSize: 10, color: '#7A8BA8', fontWeight: 600 }}>VIEW CONTROLS</Text>
      </div>

      <Divider type="vertical" style={{ height: '70%', margin: '0 4px', borderColor: '#D0D7E3' }} />

      {/* Days & Time bounds */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <Space size={4}>
          <Space size={1} style={{ display: 'inline-flex' }}>
            {DAY_ORDER.map((day) => {
              const isVisible = !hiddenDays.includes(day);
              return (
                <AntdCheckableTag
                  key={day}
                  checked={isVisible}
                  onChange={(checked: boolean) => {
                    if (checked) {
                      onToggleDay(hiddenDays.filter((d) => d !== day));
                    } else {
                      onToggleDay([...hiddenDays, day]);
                    }
                  }}
                  style={{
                    border: '1px solid #D0D7E3',
                    padding: '0 4px',
                    fontSize: 9,
                    borderRadius: 2,
                    lineHeight: '18px',
                    height: 20,
                  }}
                >
                  {day}
                </AntdCheckableTag>
              );
            })}
          </Space>
          <Divider type="vertical" style={{ margin: '0 2px' }} />
          <Select
            style={{ width: 80 }}
            value={viewStart}
            onChange={onViewStartChange}
            options={timeOptions.slice(0, -1)}
          />
          <Text style={{ fontSize: 11 }}>to</Text>
          <Select
            style={{ width: 80 }}
            value={viewEnd}
            onChange={onViewEndChange}
            options={timeOptions.filter((opt) => opt.value > viewStart)}
          />
        </Space>
        <Text style={{ fontSize: 10, color: '#7A8BA8', fontWeight: 600 }}>TIMETABLE WINDOW</Text>
      </div>
    </div>
  );
}
