import { useState } from 'react';
import { Button, Form, Input, Space, Typography, Alert, Checkbox, Select, Divider, Modal, Table, Tag } from 'antd';
import { SearchOutlined, EyeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { BLUEPRINT_HEADERS, SCHEDULE_HEADERS } from '../utils/autoDetectColumns';

const { Text } = Typography;

const BASIC_FIELDS = [
  { key: 'subjectCode', label: 'Subject Code', required: true },
  { key: 'offerCode', label: 'Offer Code', required: true },
  { key: 'subjectDescription', label: 'Subject Description', required: true },
  { key: 'department', label: 'Department', required: true },
  { key: 'program', label: 'Program', required: true },
  { key: 'year', label: 'Year', required: true },
  { key: 'section', label: 'Section', required: true },
  { key: 'room', label: 'Room', required: false },
  { key: 'building', label: 'Building', required: false },
] as const;

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const DAY_FIELD_KEYS = [
  'monIn', 'monOut',
  'tueIn', 'tueOut',
  'wedIn', 'wedOut',
  'thuIn', 'thuOut',
  'friIn', 'friOut',
  'satIn', 'satOut',
  'sunIn', 'sunOut',
] as const;

const SCHEDULE_META_FIELDS = [
  { key: 'firstName', label: 'First Name' },
  { key: 'middleName', label: 'Middle Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'room', label: 'Room' },
] as const;

const TIME_FORMAT_OPTIONS = [
  { label: 'Auto Detect', value: 'auto' },
  { label: '12 Hour', value: '12h' },
  { label: '24 Hour', value: '24h' },
] as const;

export interface ImportPayload {
  mapping: Record<string, string>;
  includeSchedule: boolean;
  timeFormat: 'auto' | '12h' | '24h';
  scheduleMapping: Record<string, string>;
  autoCreateMissing: boolean;
  autoFixConflicts: boolean;
  allowAnyRoom: boolean;
  limitToBuilding: boolean;
}

interface ColumnMappingFormProps {
  onImport: (payload: ImportPayload) => void;
  loading: boolean;
  initialMapping?: Record<string, string>;
  initialScheduleMapping?: Record<string, string>;
  onSearchAllColumns: () => Promise<{ mapping: Record<string, string>; scheduleMapping: Record<string, string> }>;
  worksheetRows?: string[][];
}

const FIELD_LABEL_MAP: Record<string, string> = {
  subjectCode: 'Subject Code',
  offerCode: 'Offer Code',
  subjectDescription: 'Subject Description',
  department: 'Department',
  program: 'Program',
  year: 'Year',
  section: 'Section',
  monIn: 'Mon In',
  monOut: 'Mon Out',
  tueIn: 'Tue In',
  tueOut: 'Tue Out',
  wedIn: 'Wed In',
  wedOut: 'Wed Out',
  thuIn: 'Thu In',
  thuOut: 'Thu Out',
  friIn: 'Fri In',
  friOut: 'Fri Out',
  satIn: 'Sat In',
  satOut: 'Sat Out',
  sunIn: 'Sun In',
  sunOut: 'Sun Out',
  firstName: 'First Name',
  middleName: 'Middle Name',
  lastName: 'Last Name',
  room: 'Room',
};

const ALL_PREDEFINED_KEYS = [
  ...Object.entries(BLUEPRINT_HEADERS).map(([header, field]) => ({ group: 'Blueprint', header, field })),
  ...Object.entries(SCHEDULE_HEADERS).map(([header, field]) => ({ group: 'Schedule', header, field })),
];

const previewColumns: ColumnsType<Record<string, string>> = [
  { title: 'Row', dataIndex: '_row', key: '_row', width: 50 },
  { title: 'Subject Code', dataIndex: 'subjectCode', key: 'subjectCode', ellipsis: true },
  { title: 'Offer Code', dataIndex: 'offerCode', key: 'offerCode', ellipsis: true },
  { title: 'Description', dataIndex: 'subjectDescription', key: 'subjectDescription', ellipsis: true },
  { title: 'Department', dataIndex: 'department', key: 'department', ellipsis: true },
  { title: 'Program', dataIndex: 'program', key: 'program', ellipsis: true },
  { title: 'Year', dataIndex: 'year', key: 'year', width: 50 },
  { title: 'Section', dataIndex: 'section', key: 'section', ellipsis: true },
  { title: 'Room', dataIndex: 'room', key: 'room', ellipsis: true },
  { title: 'Building', dataIndex: 'building', key: 'building', ellipsis: true },
];

export function ColumnMappingForm({
  onImport,
  loading,
  initialMapping = {},
  initialScheduleMapping = {},
  onSearchAllColumns,
  worksheetRows,
}: ColumnMappingFormProps) {
  const [mapping, setMapping] = useState<Record<string, string>>(initialMapping);
  const [includeSchedule, setIncludeSchedule] = useState(false);
  const [timeFormat, setTimeFormat] = useState<'auto' | '12h' | '24h'>('auto');
  const [scheduleMapping, setScheduleMapping] = useState<Record<string, string>>(initialScheduleMapping);
  const [searching, setSearching] = useState(false);
  const [autoCreateMissing, setAutoCreateMissing] = useState(true);
  const [predefinedNamesOpen, setPredefinedNamesOpen] = useState(false);
  const [autoFixConflicts, setAutoFixConflicts] = useState(false);
  const [allowAnyRoom, setAllowAnyRoom] = useState(false);
  const [limitToBuilding, setLimitToBuilding] = useState(false);

  const setCol = (key: string, val: string) => {
    setMapping((prev) => ({ ...prev, [key]: val.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) }));
  };

  const setSchedCol = (key: string, val: string) => {
    setScheduleMapping((prev) => ({ ...prev, [key]: val.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) }));
  };

  const canImportBasic = BASIC_FIELDS.filter((f) => f.required).every((f) => mapping[f.key]);

  const canImport = canImportBasic;

  const handleSearch = async () => {
    setSearching(true);
    try {
      const result = await onSearchAllColumns();
      setMapping((prev) => ({ ...prev, ...result.mapping }));
      setScheduleMapping((prev) => ({ ...prev, ...result.scheduleMapping }));
    } finally {
      setSearching(false);
    }
  };

  const handleImport = () => {
    onImport({
      mapping,
      includeSchedule,
      timeFormat,
      scheduleMapping,
      autoCreateMissing,
      autoFixConflicts,
      allowAnyRoom,
      limitToBuilding,
    });
  };

  const previewData = worksheetRows && mapping
    ? worksheetRows.slice(0, 6).map((row, idx) => {
        const getPreviewVal = (mp: Record<string, string>, field: string): string => {
          const letter = mp[field];
          if (!letter) return '';
          const colIdx = letter.toUpperCase().charCodeAt(0) - 65;
          return row[colIdx] || '';
        };
        const rowData: Record<string, string> = { _row: String(idx + 2), key: String(idx) };
        for (const field of BASIC_FIELDS) {
          rowData[field.key] = getPreviewVal(mapping, field.key);
        }
        return rowData;
      })
    : [];

  const predefinedNamesColumns: ColumnsType<typeof ALL_PREDEFINED_KEYS[number]> = [
    { title: 'Group', dataIndex: 'group', key: 'group', width: 90, render: (g: string) => <Tag color={g === 'Blueprint' ? 'blue' : 'green'}>{g}</Tag> },
    { title: 'Excel Header', dataIndex: 'header', key: 'header', render: (h: string) => <Text code>{h}</Text> },
    { title: 'Maps To', dataIndex: 'field', key: 'field', render: (f: string) => <Text>{FIELD_LABEL_MAP[f] || f}</Text> },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      <Alert
        type="info"
        showIcon
        message="Map each column letter (A, B, C, …) to the corresponding blueprint field."
      />

      <Space>
        <Button size="small" icon={<EyeOutlined />} onClick={() => setPredefinedNamesOpen(true)}>
          View Predefined Names
        </Button>
        <Button
          size="small"
          icon={<SearchOutlined />}
          onClick={handleSearch}
          loading={searching}
        >
          Search in Excel
        </Button>
      </Space>

      <Modal
        title="Predefined Field Names"
        open={predefinedNamesOpen}
        onCancel={() => setPredefinedNamesOpen(false)}
        footer={null}
        width={600}
      >
        <Table
          dataSource={ALL_PREDEFINED_KEYS}
          columns={predefinedNamesColumns}
          rowKey={(r) => `${r.group}:${r.header}`}
          size="small"
          pagination={false}
          scroll={{ y: 400 }}
        />
      </Modal>

      <Form layout="vertical" size="small">
        {BASIC_FIELDS.map((field) => (
          <Form.Item
            key={field.key}
            label={
              <Text>
                {field.label}
                {field.required && <Text type="danger"> *</Text>}
              </Text>
            }
            style={{ marginBottom: 8 }}
          >
            <Input
              placeholder="Column (A, B, …, AA, AB…)"
              value={mapping[field.key] || ''}
              onChange={(e) => setCol(field.key, e.target.value)}
              maxLength={3}
              style={{ width: 130 }}
            />
          </Form.Item>
        ))}
      </Form>

      <Checkbox checked={autoCreateMissing} onChange={(e) => setAutoCreateMissing(e.target.checked)}>
        Auto-create missing toolbar data (programs, sections, years, departments, rooms, and instructors)
      </Checkbox>

      <Divider style={{ margin: '4px 0' }} />

      <Space align="center" size={12}>
        <Checkbox checked={includeSchedule} onChange={(e) => setIncludeSchedule(e.target.checked)}>
          Include Schedule
        </Checkbox>
        {includeSchedule && (
          <Select
            size="small"
            value={timeFormat}
            onChange={(val) => setTimeFormat(val)}
            options={TIME_FORMAT_OPTIONS.map((o) => ({ ...o }))}
            style={{ width: 140 }}
          />
        )}
      </Space>

      {includeSchedule && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8, padding: '0 8px' }}>
            <Checkbox checked={autoFixConflicts} onChange={(e) => setAutoFixConflicts(e.target.checked)}>
              Auto fix conflicting schedules
            </Checkbox>
            {autoFixConflicts && (
              <div style={{ paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Checkbox checked={allowAnyRoom} onChange={(e) => setAllowAnyRoom(e.target.checked)}>
                  Allow picking other rooms beyond specified
                </Checkbox>
                <Checkbox checked={limitToBuilding} onChange={(e) => setLimitToBuilding(e.target.checked)}>
                  Limit to building
                </Checkbox>
              </div>
            )}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #D0D7E3', fontWeight: 600, color: '#1E293B' }}>Day</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #D0D7E3', fontWeight: 600, color: '#1E293B' }}>Start (Col)</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #D0D7E3', fontWeight: 600, color: '#1E293B' }}>End (Col)</th>
              </tr>
            </thead>
            <tbody>
              {DAY_LABELS.map((day, i) => {
                const inKey = DAY_FIELD_KEYS[i * 2];
                const outKey = DAY_FIELD_KEYS[i * 2 + 1];
                return (
                  <tr key={day}>
                    <td style={{ padding: '4px 8px', fontWeight: 500, color: '#4A5B78' }}>{day}</td>
                    <td style={{ padding: '2px 8px' }}>
                      <Input
                        size="small"
                        placeholder="Letter"
                        value={scheduleMapping[inKey] || ''}
                        onChange={(e) => setSchedCol(inKey, e.target.value)}
                        maxLength={3}
                        style={{ width: 85 }}
                      />
                    </td>
                    <td style={{ padding: '2px 8px' }}>
                      <Input
                        size="small"
                        placeholder="Letter"
                        value={scheduleMapping[outKey] || ''}
                        onChange={(e) => setSchedCol(outKey, e.target.value)}
                        maxLength={3}
                        style={{ width: 85 }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <Divider style={{ margin: '4px 0' }} />

          <Text strong style={{ fontSize: 12, color: '#1E293B', display: 'block', marginBottom: 4 }}>Instructor</Text>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {SCHEDULE_META_FIELDS.slice(0, 3).map((field) => (
              <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Text style={{ fontSize: 11, color: '#7A8BA8' }}>{field.label}</Text>
                <Input
                  size="small"
                  placeholder="Col Letter"
                  value={scheduleMapping[field.key] || ''}
                  onChange={(e) => setSchedCol(field.key, e.target.value)}
                  maxLength={3}
                  style={{ width: 105 }}
                />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
            <Text style={{ fontSize: 11, color: '#7A8BA8' }}>Room</Text>
            <Input
              size="small"
              placeholder="Column Letter"
              value={scheduleMapping['room'] || ''}
              onChange={(e) => setSchedCol('room', e.target.value)}
              maxLength={3}
              style={{ width: 125 }}
            />
          </div>
        </>
      )}

      {previewData.length > 0 && (
        <>
          <Divider style={{ margin: '4px 0' }} />
          <Text strong style={{ fontSize: 12, color: '#1E293B', display: 'block', marginBottom: 4 }}>
            Preview (first {previewData.length} rows)
          </Text>
          <Table
            dataSource={previewData}
            columns={previewColumns}
            rowKey={(r) => r._row}
            size="small"
            pagination={false}
            scroll={{ x: 'max-content' }}
          />
        </>
      )}

      <Button
        type="primary"
        onClick={handleImport}
        disabled={!canImport}
        loading={loading}
        block
      >
        Import Blueprints
      </Button>
    </Space>
  );
}
