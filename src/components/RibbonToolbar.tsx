import { Button, Select, Checkbox, Space, Divider, Typography, Tooltip, Drawer, Form, Input, InputNumber, Tabs, Card, Dropdown, message, Modal } from 'antd';
import { Sketch } from '@uiw/react-color';
import {
  SaveOutlined,
  DownloadOutlined,
  UploadOutlined,
  PlusOutlined,
  UndoOutlined,
  RedoOutlined,
  LinkOutlined,
  FilterOutlined,
  UserOutlined,
  SolutionOutlined,
  HomeOutlined,
  BgColorsOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { DayOfWeek } from '../types';
import { DAY_ORDER } from '../types';
import { useState, useEffect } from 'react';
import type { DynamicData } from '../types';
import { formatInstructorValue, parseInstructorValue, formatInstructorDisplay } from '../utils/teacherName';

const { Text } = Typography;
import { Tag } from 'antd';
const AntdCheckableTag = Tag.CheckableTag;

const getDisplayLabel = (item: DynamicData): string => {
  if (item.dataType === 'room') {
    return item.displayAs.split('|')[0] || item.value;
  }
  if (item.dataType === 'instructor') {
    const parts = item.value.split(', ');
    const lastName = parts[0] || '';
    const firstName = parts[1] || '';
    return `${lastName}, ${firstName}`.trim();
  }
  return item.displayAs || item.value;
};

interface RibbonToolbarProps {
  // File operations
  onSave: () => void;
  onSaveAs: () => void;
  onImportMerge: () => void;
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
  roomOptions: Array<{ label: string; value: string }>;
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
  linkingModeActive?: boolean;
  onToggleLinkingMode?: () => void;

  // Dynamic Data Actions
  dynamicData: DynamicData[];
  addDynamicData: (dataType: string, value: string, displayAs: string) => Promise<void>;
  deleteDynamicData: (id: string) => Promise<void>;
  updateDynamicData: (id: string, dataType: string, value: string, displayAs: string) => Promise<void>;

  // Cell sizing
  globalColWidth: number;
  globalRowHeight: number;
  onApplyGlobalCellSizing: (width: number, height: number) => void;

  // Collaboration
  isCollabConnected?: boolean;
  onHostSession?: () => void;
  onJoinSession?: () => void;
  onLeaveSession?: () => void;
}

export function RibbonToolbar({
  onSave,
  onSaveAs,
  onImportMerge,
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
  linkingModeActive,
  onToggleLinkingMode,

  dynamicData,
  addDynamicData,
  deleteDynamicData,
  updateDynamicData,
  globalColWidth,
  globalRowHeight,
  onApplyGlobalCellSizing,

  isCollabConnected,
  onHostSession,
  onJoinSession,
  onLeaveSession,
}: RibbonToolbarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm();
  const [editingDynamicId, setEditingDynamicId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('department');
  const [sortOrder, setSortOrder] = useState<'created' | 'name-asc' | 'name-desc'>('created');

  // Local inputs for cell sizing – applied on blur or Enter
  const [colWidthInput, setColWidthInput] = useState<number>(globalColWidth);
  const [rowHeightInput, setRowHeightInput] = useState<number>(globalRowHeight);

  useEffect(() => { setColWidthInput(globalColWidth); }, [globalColWidth]);
  useEffect(() => { setRowHeightInput(globalRowHeight); }, [globalRowHeight]);

  const applySizing = () => {
    const w = Math.max(60, colWidthInput);
    const h = Math.max(18, rowHeightInput);
    onApplyGlobalCellSizing(w, h);
  };

  const isCustom = theme && theme.startsWith('custom:');
  const customHex = isCustom ? theme.split(':')[1] : '#2B4C7E';

  const [customColorModalOpen, setCustomColorModalOpen] = useState(false);
  const [tempCustomColor, setTempCustomColor] = useState(customHex);

  // Sync tempCustomColor when theme changes externally
  useEffect(() => {
    if (isCustom) {
      setTempCustomColor(customHex);
    }
  }, [customHex, isCustom]);

  // Watch dataType to change form fields dynamically
  const formDataType = Form.useWatch('dataType', form) ?? 'department';

  // Sync form dataType with activeTab
  useEffect(() => {
    if (drawerOpen) {
      setActiveTab(formDataType);
    }
  }, [formDataType, drawerOpen]);

  const handleFinishData = async (values: any) => {
    let finalValue = '';
    let finalDisplay = '';

    if (values.dataType === 'instructor') {
      const firstName = values.firstName?.trim() || '';
      const middleName = values.middleName?.trim() || '';
      const lastName = values.lastName?.trim() || '';
      finalValue = formatInstructorValue(firstName, middleName, lastName);
      finalDisplay = formatInstructorDisplay(firstName, middleName, lastName);
    } else if (values.dataType === 'room') {
      finalValue = values.value?.trim() || '';
      finalDisplay = `${values.displayAs?.trim() || values.value?.trim() || ''}|${values.building || ''}`;
    } else {
      finalValue = values.value?.trim() || '';
      finalDisplay = values.displayAs?.trim() || values.value?.trim() || '';
    }

    try {
      if (editingDynamicId) {
        await updateDynamicData(editingDynamicId, values.dataType, finalValue, finalDisplay);
        setEditingDynamicId(null);
      } else {
        await addDynamicData(values.dataType, finalValue, finalDisplay);
      }
      const savedType = form.getFieldValue('dataType');
      form.resetFields();
      form.setFieldsValue({ dataType: savedType });
      setTimeout(() => {
        const valueField = form.getFieldInstance('value') || form.getFieldInstance('lastName');
        if (valueField) {
          (valueField as HTMLElement)?.focus?.();
          (valueField as HTMLElement)?.click?.();
        }
      }, 50);
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Failed to save data');
    }
  };
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
        overflowY: 'hidden',
        whiteSpace: 'nowrap',
        boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
        zIndex: 10,
        height: 84,
        flexShrink: 0,
      }}
    >
      {/* File Group — merged with Undo/Redo */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <Space size={2}>
          <Tooltip title="Save Collection (Ctrl+S)">
            <Button icon={<SaveOutlined />} onClick={onSave} style={{ padding: '6px 8px', fontSize: 12 }} />
          </Tooltip>
          <Tooltip title="Save As / Export (Ctrl+Shift+S)">
            <Button icon={<DownloadOutlined />} onClick={onSaveAs} style={{ padding: '6px 8px', fontSize: 12 }} />
          </Tooltip>
          <Tooltip title="Import & Merge JSON Data">
            <Button icon={<UploadOutlined />} onClick={onImportMerge} style={{ padding: '6px 8px', fontSize: 12 }} />
          </Tooltip>
        </Space>
        <Space size={2}>
          <Button icon={<UndoOutlined />} disabled={!canUndo} onClick={onUndo} style={{ padding: '4px 8px', fontSize: 11, height: 24 }} />
          <Button icon={<RedoOutlined />} disabled={!canRedo} onClick={onRedo} style={{ padding: '4px 8px', fontSize: 11, height: 24 }} />
        </Space>
        <Text style={{ fontSize: 9, color: '#7A8BA8', fontWeight: 600, lineHeight: 1 }}>FILE</Text>
      </div>

      <Divider type="vertical" style={{ height: '70%', margin: '0 4px', borderColor: '#D0D7E3' }} />

      {/* Add Entry & Dynamic Data Actions — square buttons with flex column */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <Space size={2}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onAddSubjectEntry}
            style={{ background: '#2B4C7E', borderColor: '#2B4C7E', width: 48, height: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 500, padding: 0 }}
          >
            <span>Subject</span>
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={() => setDrawerOpen(true)}
            style={{ width: 48, height: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 500, padding: 0 }}
          >
            <span>Data</span>
          </Button>
          <Button
            type={linkingModeActive ? 'primary' : 'default'}
            danger={linkingModeActive}
            icon={<LinkOutlined />}
            onClick={onToggleLinkingMode}
            style={{ width: 48, height: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 500, padding: 0 }}
          >
            <span>Link</span>
          </Button>
        </Space>
        <Text style={{ fontSize: 9, color: '#7A8BA8', fontWeight: 600, lineHeight: 1 }}>INSERT</Text>
      </div>

      <Divider type="vertical" style={{ height: '70%', margin: '0 4px', borderColor: '#D0D7E3' }} />

      {/* Collaboration */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <Space size={2}>
          <Tooltip title="Host Session">
            <Button
              icon={<TeamOutlined />}
              onClick={onHostSession}
              disabled={isCollabConnected}
              style={{ width: 48, height: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 500, padding: 0 }}
            >
              <span>Host</span>
            </Button>
          </Tooltip>
          <Tooltip title="Join Session">
            <Button
              icon={<TeamOutlined />}
              onClick={onJoinSession}
              disabled={isCollabConnected}
              style={{ width: 48, height: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 500, padding: 0 }}
            >
              <span>Join</span>
            </Button>
          </Tooltip>
          {isCollabConnected && (
            <Tooltip title="Leave Session">
              <Button
                danger
                icon={<TeamOutlined />}
                onClick={onLeaveSession}
                style={{ width: 48, height: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 500, padding: 0 }}
              >
                <span>Leave</span>
              </Button>
            </Tooltip>
          )}
        </Space>
        <Text style={{ fontSize: 9, color: '#7A8BA8', fontWeight: 600, lineHeight: 1 }}>COLLAB</Text>
      </div>

      <Divider type="vertical" style={{ height: '70%', margin: '0 4px', borderColor: '#D0D7E3' }} />

      {/* Filter and View options */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <Space size={4}>
          <Select
            value={filterType}
            onChange={onFilterTypeChange}
            style={{ width: 110 }}
            options={[
              { label: <span><FilterOutlined style={{ marginRight: 6, color: '#1890ff' }} />All</span>, value: 'all' },
              { label: <span><UserOutlined style={{ marginRight: 6, color: '#722ed1' }} />Student</span>, value: 'student' },
              { label: <span><SolutionOutlined style={{ marginRight: 6, color: '#fa8c16' }} />Instructor</span>, value: 'teacher' },
              { label: <span><HomeOutlined style={{ marginRight: 6, color: '#52c41a' }} />Room</span>, value: 'room' },
            ]}
          />
          {filterType === 'student' && (
            <Select
              value={selectedStudentKey}
              onChange={onSelectedStudentKeyChange}
              style={{ width: 140 }}
              options={studentSchedules.map(opt => ({
                label: <span><UserOutlined style={{ marginRight: 6, color: '#8c8c8c' }} />{opt.label}</span>,
                value: opt.value
              }))}
              placeholder={<span><UserOutlined style={{ marginRight: 6 }} />Student</span>}
              disabled={studentSchedules.length === 0}
            />
          )}
          {filterType === 'teacher' && (
            <Select
              showSearch
              filterOption={(input, option) =>
                String(option?.value ?? '').toLowerCase().includes(input.toLowerCase())
              }
              value={selectedTeacher}
              onChange={onSelectedTeacherChange}
              style={{ width: 140 }}
              options={teacherOptions.map(opt => ({
                label: <span><SolutionOutlined style={{ marginRight: 6, color: '#8c8c8c' }} />{opt.label}</span>,
                value: opt.value
              }))}
              placeholder={<span><SolutionOutlined style={{ marginRight: 6 }} />Instructor</span>}
              disabled={teacherOptions.length === 0}
            />
          )}
          {filterType === 'room' && (
            <Space size={2}>
              <Select
                mode="tags"
                tokenSeparators={[',']}
                value={selectedRooms}
                onChange={onSelectedRoomsChange}
                style={{ width: 140 }}
                placeholder={<span><HomeOutlined style={{ marginRight: 6 }} />Rooms</span>}
                options={[{ label: 'All', value: 'all' }, ...roomOptions].map(opt => ({
                  label: <span><HomeOutlined style={{ marginRight: 6, color: '#8c8c8c' }} />{opt.label}</span>,
                  value: opt.value
                }))}
                maxTagCount="responsive"
              />
              <Button size="small" onClick={() => onSelectedRoomsChange(['all'])} style={{ fontSize: 10, height: 30 }}>
                Clear
              </Button>
            </Space>
          )}
          <Select
            value={theme}
            onChange={(val) => {
              if (val === 'custom_trigger') {
                setCustomColorModalOpen(true);
              } else {
                onThemeChange(val);
              }
            }}
            style={{ width: 140 }}
            suffixIcon={<BgColorsOutlined />}
            options={(() => {
              const options = [
                { label: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: '#2B4C7E' }} />
                    <span>Academic Blue</span>
                  </div>
                ), value: 'blue' },
                { label: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: '#3D6B50' }} />
                    <span>Emerald Forest</span>
                  </div>
                ), value: 'green' },
                { label: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: '#6B3D7E' }} />
                    <span>Amethyst Purple</span>
                  </div>
                ), value: 'purple' },
                { label: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: '#B35446' }} />
                    <span>Sunset Terracotta</span>
                  </div>
                ), value: 'orange' },
                { label: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: '#3D4F6B' }} />
                    <span>Midnight Slate</span>
                  </div>
                ), value: 'charcoal' },
              ];

              if (isCustom) {
                options.push({
                  label: (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: customHex }} />
                      <span>Custom ({customHex})</span>
                    </div>
                  ), value: theme
                });
              }

              options.push({
                label: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: 'linear-gradient(45deg, red, orange, yellow, green, blue, purple)'
                    }} />
                    <span>Custom Color...</span>
                  </div>
                ), value: 'custom_trigger'
              });

              return options;
            })()}
          />
          <Checkbox checked={bandedRows} onChange={(e) => onBandedRowsChange(e.target.checked)} style={{ fontSize: 11 }}>
            Banded
          </Checkbox>
        </Space>
        <Text style={{ fontSize: 10, color: '#7A8BA8', fontWeight: 600 }}>VIEW CONTROLS</Text>
      </div>

      <Divider type="vertical" style={{ height: '70%', margin: '0 4px', borderColor: '#D0D7E3' }} />

      {/* Days & Time bounds */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
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
                  lineHeight: '16px',
                  height: 18,
                }}
              >
                {day}
              </AntdCheckableTag>
            );
          })}
        </Space>
        <Space size={4} align="center" style={{ marginTop: 2 }}>
          <Select
            size="small"
            style={{ width: 80 }}
            value={viewStart}
            onChange={onViewStartChange}
            options={timeOptions.slice(0, -1)}
          />
          <Text style={{ fontSize: 10 }}>to</Text>
          <Select
            size="small"
            style={{ width: 80 }}
            value={viewEnd}
            onChange={onViewEndChange}
            options={timeOptions.filter((opt) => opt.value > viewStart)}
          />
        </Space>
        <Text style={{ fontSize: 9, color: '#7A8BA8', fontWeight: 600, marginTop: 2 }}>TIMETABLE WINDOW</Text>
      </div>

      {/* CELL SIZING group */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingInline: 8, borderRight: '1px solid #2A3A52' }}>
        <Space size={4}>
          <Space direction="vertical" size={0} style={{ alignItems: 'center' }}>
            <InputNumber
              size="small"
              min={60}
              max={400}
              style={{ width: 64 }}
              value={colWidthInput}
              onChange={(v) => v !== null && setColWidthInput(v)}
              onBlur={applySizing}
              onKeyDown={(e) => { if (e.key === 'Enter') applySizing(); }}
            />
            <Text style={{ fontSize: 9, color: '#7A8BA8' }}>COL W</Text>
          </Space>
          <Space direction="vertical" size={0} style={{ alignItems: 'center' }}>
            <InputNumber
              size="small"
              min={18}
              max={200}
              style={{ width: 64 }}
              value={rowHeightInput}
              onChange={(v) => v !== null && setRowHeightInput(v)}
              onBlur={applySizing}
              onKeyDown={(e) => { if (e.key === 'Enter') applySizing(); }}
            />
            <Text style={{ fontSize: 9, color: '#7A8BA8' }}>ROW H</Text>
          </Space>
          <Tooltip title="Reset to defaults">
            <Button
              size="small"
              icon={<UndoOutlined />}
              onClick={() => onApplyGlobalCellSizing(130, 36)}
              style={{ marginTop: -2 }}
            />
          </Tooltip>
        </Space>
        <Text style={{ fontSize: 9, color: '#7A8BA8', fontWeight: 600, marginTop: 2 }}>CELL SIZING</Text>
      </div>

      <Drawer
        title="Manage Dynamic Toolbar Data"
        placement="right"
        width={400}
        styles={{ body: { padding: 0 } }}
        onClose={() => {
          setDrawerOpen(false);
          setEditingDynamicId(null);
          form.resetFields();
        }}
        open={drawerOpen}
      >
        <div style={{ padding: 24, paddingBottom: 0 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFinishData}
          initialValues={{ dataType: 'department' }}
        >
          <Form.Item
            name="dataType"
            label="Data Type"
            rules={[{ required: true, message: 'Please select data type' }]}
          >
            <Select
              options={[
                { label: 'Department', value: 'department' },
                { label: 'Program', value: 'program' },
                { label: 'Year', value: 'year' },
                { label: 'Section', value: 'section' },
                { label: 'Instructor', value: 'instructor' },
                { label: 'Building', value: 'building' },
                { label: 'Room', value: 'room' },
              ]}
              onChange={(value) => {
                setEditingDynamicId(null);
                form.resetFields();
                form.setFieldsValue({ dataType: value });
                setActiveTab(value);
              }}
            />
          </Form.Item>

          {formDataType === 'instructor' ? (
            <>
              <Form.Item
                name="lastName"
                label="Last Name"
                rules={[{ required: true, message: 'Required' }]}
              >
                <Input placeholder="e.g. Santos" autoComplete="off" />
              </Form.Item>
              <Form.Item
                name="firstName"
                label="First Name"
                rules={[{ required: true, message: 'Required' }]}
              >
                <Input placeholder="e.g. Maria" autoComplete="off" />
              </Form.Item>
              <Form.Item
                name="middleName"
                label="Middle Name (optional)"
              >
                <Input placeholder="e.g. Clara" autoComplete="off" />
              </Form.Item>
            </>
          ) : formDataType === 'room' ? (
            <>
              <Form.Item
                name="value"
                label="Room Name"
                rules={[{ required: true, message: 'Required' }]}
              >
                <Input placeholder="e.g. Rm 101" autoComplete="off" />
              </Form.Item>
              <Form.Item
                name="displayAs"
                label="Display As (optional)"
              >
                <Input placeholder="e.g. Lecture Room 101" autoComplete="off" />
              </Form.Item>
              <Form.Item
                name="building"
                label="Building"
                rules={[{ required: true, message: 'Please select building' }]}
              >
                <Select
                  placeholder="Select Building"
                  options={dynamicData
                    .filter((d) => d.dataType === 'building')
                    .map((d) => ({ label: d.displayAs || d.value, value: d.value }))}
                />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item
                name="value"
                label="Value (Internal)"
                rules={[{ required: true, message: 'Please enter value' }]}
              >
                <Input placeholder="e.g. BSCS" autoComplete="off" />
              </Form.Item>
              <Form.Item
                name="displayAs"
                label="Display As (optional)"
              >
                <Input placeholder="e.g. Bachelor of Science in Computer Science" autoComplete="off" />
              </Form.Item>
            </>
          )}

          <Form.Item style={{ marginBottom: 12 }}>
            <Button type="primary" htmlType="submit" block>
              {editingDynamicId ? 'Save Changes' : 'Add Entry'}
            </Button>
          </Form.Item>
          {editingDynamicId && (
            <Button
              style={{ marginBottom: 16 }}
              block
              onClick={() => {
                setEditingDynamicId(null);
                form.resetFields();
                form.setFieldsValue({ dataType: formDataType });
              }}
            >
              Cancel Edit
            </Button>
          )}
        </Form>

        <Divider style={{ margin: '12px 0' }} />

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Typography.Title level={5} style={{ fontSize: 13, margin: 0 }}>
              Existing Data Entries
            </Typography.Title>
            <Select
              size="small"
              value={sortOrder}
              onChange={setSortOrder}
              style={{ width: 130 }}
              options={[
                { label: 'Date Created', value: 'created' },
                { label: 'Name (A-Z)', value: 'name-asc' },
                { label: 'Name (Z-A)', value: 'name-desc' },
              ]}
            />
          </div>
          <Tabs
            size="small"
            type="card"
            style={{ margin: 0 }}
            activeKey={activeTab}
            onChange={(key) => {
              setActiveTab(key);
              form.setFieldsValue({ dataType: key });
              setEditingDynamicId(null);
            }}
            items={['department', 'program', 'year', 'section', 'building', 'room', 'instructor'].map((type) => {
              let list = dynamicData.filter((d) => d.dataType === type);
              if (sortOrder === 'name-asc') {
                list = [...list].sort((a, b) => getDisplayLabel(a).localeCompare(getDisplayLabel(b)));
              } else if (sortOrder === 'name-desc') {
                list = [...list].sort((a, b) => getDisplayLabel(b).localeCompare(getDisplayLabel(a)));
              }
              return {
                label: type === 'instructor' ? 'Instructors' : (type.charAt(0).toUpperCase() + type.slice(1)),
                key: type,
                children: (
                  <div style={{ maxHeight: 250, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {list.length === 0 ? (
                      <Text type="secondary" style={{ fontSize: 11, textAlign: 'center', display: 'block', padding: 12 }}>
                        No entries for {type === 'instructor' ? 'instructors' : type}.
                      </Text>
                    ) : (
                      list.map((item) => {
                        let displayLabel = item.displayAs;
                        let subText = `Value: ${item.value}`;
                        if (item.dataType === 'room') {
                          const parts = item.displayAs.split('|');
                          displayLabel = parts[0];
                          subText = `Building: ${parts[1] || 'None'}`;
                        } else if (item.dataType === 'instructor') {
                          const parts = item.value.split(', ');
                          const lastName = parts[0] || '';
                          const firstName = parts[1] || '';
                          const middleName = parts[2] || '';
                          displayLabel = `${lastName}, ${firstName}`;
                          subText = middleName ? `Middle Name: ${middleName}` : '';
                        }
                        return (
                          <Dropdown
                            key={item.id}
                            menu={{
                              items: [
                                { label: 'Edit', key: 'edit' },
                                { label: 'Delete', key: 'delete', danger: true },
                              ],
                              onClick: ({ key }) => {
                                if (key === 'edit') {
                                  setEditingDynamicId(item.id);
                                  if (item.dataType === 'room') {
                                    const parts = item.displayAs.split('|');
                                    form.setFieldsValue({
                                      dataType: 'room',
                                      value: item.value,
                                      displayAs: parts[0] || '',
                                      building: parts[1] || '',
                                    });
                                  } else if (item.dataType === 'instructor') {
                                    const parsed = parseInstructorValue(item.value);
                                    form.setFieldsValue({
                                      dataType: 'instructor',
                                      lastName: parsed.lastName || '',
                                      firstName: parsed.firstName || '',
                                      middleName: parsed.middleName || '',
                                    });
                                  } else {
                                    form.setFieldsValue({
                                      dataType: item.dataType,
                                      value: item.value,
                                      displayAs: item.displayAs,
                                    });
                                  }
                                  document.querySelector('.ant-drawer-body')?.scrollTo({ top: 0, behavior: 'smooth' });
                                } else if (key === 'delete') {
                                  deleteDynamicData(item.id);
                                }
                              }
                            }}
                            trigger={['contextMenu']}
                          >
                            <Card size="small" style={{ borderRadius: 6, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} hoverable>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>{displayLabel}</div>
                              {subText && <div style={{ fontSize: 10, color: '#8c8c8c' }}>{subText}</div>}
                            </Card>
                          </Dropdown>
                        );
                      })
                    )}
                  </div>
                )
              };
            })}
          />
        </div>
      </div>
      </Drawer>

      <Modal
        title="Choose Custom Theme Color"
        open={customColorModalOpen}
        onOk={() => {
          onThemeChange(`custom:${tempCustomColor}`);
          setCustomColorModalOpen(false);
        }}
        onCancel={() => setCustomColorModalOpen(false)}
        width={320}
        styles={{ body: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', paddingTop: '12px' } }}
        destroyOnClose
      >
        <Sketch
          color={tempCustomColor}
          onChange={(colorResult) => setTempCustomColor(colorResult.hex)}
        />
        <div style={{ fontSize: 12, marginTop: 8 }}>
          Selected Color: <strong style={{ color: tempCustomColor }}>{tempCustomColor}</strong>
        </div>
      </Modal>
    </div>
  );
}
