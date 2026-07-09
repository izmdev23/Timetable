import { Button, Select, Checkbox, Space, Divider, Typography, Tooltip, Drawer, Form, Input, Tabs, Card, Dropdown } from 'antd';
import {
  SaveOutlined,
  DownloadOutlined,
  UploadOutlined,
  PlusOutlined,
  UndoOutlined,
  RedoOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import type { DayOfWeek } from '../types';
import { DAY_ORDER } from '../types';
import { useState, useEffect } from 'react';
import type { DynamicData } from '../hooks/useTimetableStore';

const { Text } = Typography;
import { Tag } from 'antd';
const AntdCheckableTag = Tag.CheckableTag;

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
  linkingModeActive?: boolean;
  onToggleLinkingMode?: () => void;

  // Dynamic Data Actions
  dynamicData: DynamicData[];
  addDynamicData: (dataType: string, value: string, displayAs: string) => Promise<void>;
  deleteDynamicData: (id: string) => Promise<void>;
  updateDynamicData: (id: string, dataType: string, value: string, displayAs: string) => Promise<void>;
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
}: RibbonToolbarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm();
  const [editingDynamicId, setEditingDynamicId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('department');

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
      const lName = values.lastName?.trim() || '';
      const fName = values.firstName?.trim() || '';
      const mName = values.middleName?.trim() || '';
      finalValue = `${lName}, ${fName}, ${mName}`;
      finalDisplay = `${lName}, ${fName}${mName ? ' ' + mName.charAt(0) + '.' : ''}`;
    } else if (values.dataType === 'room') {
      finalValue = values.value?.trim() || '';
      finalDisplay = `${values.displayAs?.trim() || values.value?.trim() || ''}|${values.building || ''}`;
    } else {
      finalValue = values.value?.trim() || '';
      finalDisplay = values.displayAs?.trim() || values.value?.trim() || '';
    }

    if (editingDynamicId) {
      await updateDynamicData(editingDynamicId, values.dataType, finalValue, finalDisplay);
      setEditingDynamicId(null);
    } else {
      await addDynamicData(values.dataType, finalValue, finalDisplay);
    }
    const savedType = form.getFieldValue('dataType');
    form.resetFields();
    form.setFieldsValue({ dataType: savedType });
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

      {/* Add Entry & Dynamic Data Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <Space size={3}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onAddSubjectEntry}
            style={{ background: '#2B4C7E', borderColor: '#2B4C7E', padding: '8px 12px', fontWeight: 500 }}
          >
            Add Subject
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={() => setDrawerOpen(true)}
            style={{ padding: '8px 12px', fontWeight: 500 }}
          >
            Add Data
          </Button>
          <Button
            type={linkingModeActive ? 'primary' : 'default'}
            danger={linkingModeActive}
            icon={<LinkOutlined />}
            onClick={onToggleLinkingMode}
            style={{ padding: '8px 12px', fontWeight: 500 }}
          >
            Link
          </Button>
        </Space>
        <Text style={{ fontSize: 10, color: '#7A8BA8', fontWeight: 600 }}>INSERT / CONFIG</Text>
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
            style={{ width: 160 }}
            options={[
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

      <Drawer
        title="Manage Dynamic Toolbar Data"
        placement="right"
        width={400}
        onClose={() => {
          setDrawerOpen(false);
          setEditingDynamicId(null);
          form.resetFields();
        }}
        open={drawerOpen}
      >
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
          <Typography.Title level={5} style={{ fontSize: 13, marginBottom: 8 }}>
            Existing Data Entries
          </Typography.Title>
          <Tabs
            size="small"
            type="card"
            activeKey={activeTab}
            onChange={(key) => {
              setActiveTab(key);
              form.setFieldsValue({ dataType: key });
              setEditingDynamicId(null);
            }}
            items={['department', 'program', 'year', 'section', 'building', 'room', 'instructor'].map((type) => {
              const list = dynamicData.filter((d) => d.dataType === type);
              return {
                label: type === 'instructor' ? 'Instructors' : (type.charAt(0).toUpperCase() + type.slice(1)),
                key: type,
                children: (
                  <div style={{ maxHeight: 250, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingBlock: 4 }}>
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
                                    const parts = item.value.split(', ');
                                    form.setFieldsValue({
                                      dataType: 'instructor',
                                      lastName: parts[0] || '',
                                      firstName: parts[1] || '',
                                      middleName: parts[2] || '',
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
      </Drawer>
    </div>
  );
}
