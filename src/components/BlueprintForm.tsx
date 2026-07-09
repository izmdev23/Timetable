import {
  Form,
  Select,
  AutoComplete,
  Button,
  Space,
  Alert,
  Typography,
  Card,
  Row,
  Col,
  Checkbox,
  Modal,
} from 'antd';
import { SaveOutlined, CloseOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import type { SubjectEntry, ConflictInfo, FormState } from '../types';

const { Text } = Typography;

interface BlueprintFormProps {
  suggestions: {
    assignedTeacherNames: string[];
    subjectCodes: string[];
    offerCodes: string[];
    rooms: string[];
    subjectDescriptions?: string[];
  };
  blueprints: SubjectEntry[];
  templates: Array<{
    subjectCode: string;
    offerCode: string;
    subjectDescription: string;
    assignedTeacherName: string;
    room: string;
    program?: string;
    programShorthand?: string;
    year?: number;
    section?: string;
  }>;
  onSubmit: (entry: SubjectEntry) => ConflictInfo[];
  editingEntry?: SubjectEntry | null;
  onCancelEdit?: () => void;
  formState: FormState;
  onFormStateChange: (state: FormState) => void;
  dynamicData: Array<{ id: string; dataType: string; value: string; displayAs: string }>;
}

interface FormValues {
  subjectCode: string;
  offerCode: string;
  subjectDescription: string;
  colorRandom: boolean;
  color: string;
  program: string;
  year: string;
  section: string;
  department: string;
}

const COLOR_PRESETS = [
  { label: 'Ocean Navy', value: '#2B4C7E' },
  { label: 'Forest Green', value: '#3D6B50' },
  { label: 'Royal Violet', value: '#6B3D7E' },
  { label: 'Terracotta', value: '#B35446' },
  { label: 'Deep Teal', value: '#2B6B6B' },
  { label: 'Steel Blue', value: '#4C5F7E' },
  { label: 'Warm Amber', value: '#C17817' },
  { label: 'Charcoal', value: '#3D4F6B' },
  { label: 'Crimson Red', value: '#9B2335' },
  { label: 'Sage Green', value: '#4D7C59' },
  { label: 'Slate Gray', value: '#64748B' },
  { label: 'Rose Wood', value: '#881337' },
];

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function toOptions(values: string[]): { value: string }[] {
  return values.map((v) => ({ value: v }));
}

export function BlueprintForm({
  suggestions,
  blueprints,
  templates,
  onSubmit,
  editingEntry,
  onCancelEdit,
  formState,
  onFormStateChange,
  dynamicData,
}: BlueprintFormProps) {
  const [form] = Form.useForm<FormValues>();
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const colorRandom = Form.useWatch('colorRandom', form) ?? true;

  useEffect(() => {
    const values: FormValues = {
      subjectCode: formState.subjectCode,
      offerCode: formState.offerCode,
      subjectDescription: formState.subjectDescription,
      colorRandom: formState.colorRandom,
      color: formState.color,
      program: formState.program,
      year: formState.year,
      section: formState.section,
      department: formState.department || '',
    };
    form.setFieldsValue(values);
    setConflicts([]);
  }, [formState, form]);

  useEffect(() => {
    const handleHistoryFocus = (e: Event) => {
      const customEvent = e as CustomEvent<{
        oldState: { formState: FormState };
        newState: { formState: FormState };
      }>;
      const { oldState, newState } = customEvent.detail;
      if (!oldState || !newState) return;

      const keys: (keyof FormState)[] = [
        'subjectCode',
        'offerCode',
        'subjectDescription',
        'program',
        'year',
        'section',
        'colorRandom',
        'color',
        'department',
      ];

      for (const key of keys) {
        const oldVal = oldState.formState[key];
        const newVal = newState.formState[key];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          setTimeout(() => {
            const el = document.getElementById(key);
            if (el) {
              el.focus();
              if (el instanceof HTMLInputElement) {
                el.select();
              }
              el.classList.add('highlight-pulse');
              setTimeout(() => el.classList.remove('highlight-pulse'), 1500);
            }
          }, 50);
          break;
        }
      }
    };

    window.addEventListener('timetable:history-focus', handleHistoryFocus);
    return () => window.removeEventListener('timetable:history-focus', handleHistoryFocus);
  }, []);

  function handleFinish(values: FormValues): void {
    const entry: SubjectEntry = {
      id: editingEntry?.id ?? uid(),
      subjectCode: values.subjectCode.trim(),
      offerCode: values.offerCode.trim(),
      subjectDescription: values.subjectDescription.trim(),
      assignedTeacherName: '',
      room: '',
      color: values.colorRandom ? undefined : values.color,
      schedules: [],
      program: values.program,
      year: Number(values.year),
      section: values.section,
      department: values.department,
    };

    if (!editingEntry) {
      const isDuplicate = blueprints.some((existing) => {
        const fieldsMatch =
          existing.subjectCode.trim().toLowerCase() === entry.subjectCode.toLowerCase() &&
          existing.offerCode.trim().toLowerCase() === entry.offerCode.toLowerCase() &&
          existing.subjectDescription.trim().toLowerCase() === entry.subjectDescription.toLowerCase() &&
          existing.program.trim().toLowerCase() === entry.program.toLowerCase() &&
          existing.year === entry.year &&
          existing.section.trim().toLowerCase() === entry.section.toLowerCase() &&
          (existing.department || '').trim().toLowerCase() === (entry.department || '').toLowerCase();

        return fieldsMatch;
      });

      if (isDuplicate) {
        Modal.confirm({
          title: 'Duplicate Blueprint Warning',
          content: 'A blueprint with the exact same data already exists. Do you want to proceed and add this duplicate?',
          okText: 'Yes, Add Duplicate',
          cancelText: 'Cancel',
          onOk() {
            onSubmit(entry);
            setConflicts([]);
            form.resetFields();
          },
        });
        return;
      }
    }

    onSubmit(entry);
    setConflicts([]);
    if (!editingEntry) form.resetFields();
  }

  function handleCancel(): void {
    form.resetFields();
    setConflicts([]);
    onCancelEdit?.();
  }

  function updateStoreFormState(allValues: FormValues) {
    const newFormState = {
      subjectCode: allValues.subjectCode || '',
      offerCode: allValues.offerCode || '',
      subjectDescription: allValues.subjectDescription || '',
      room: [],
      colorRandom: allValues.colorRandom ?? true,
      color: allValues.color || '#2B4C7E',
      schedules: [],
      program: allValues.program || '',
      year: allValues.year || '1',
      section: allValues.section || '',
      department: allValues.department || '',
    };
    onFormStateChange(newFormState);
  }

  function handleSubjectCodeSelect(value: string) {
    const match = templates.find((t) => t.subjectCode === value);
    if (match) {
      const current = form.getFieldsValue();
      const updated = {
        ...current,
        subjectCode: value,
        offerCode: match.offerCode,
        subjectDescription: match.subjectDescription,
        program: match.program || '',
        year: match.year !== undefined ? String(match.year) : '1',
        section: match.section || '',
      };
      updateStoreFormState(updated);
    }
  }

  return (
    <Card
      size="small"
      title={
        <Text strong style={{ fontSize: 13 }}>
          {editingEntry ? 'Edit Blueprint' : 'Add Blueprint'}
        </Text>
      }
      style={{ marginBottom: 12 }}
    >
      {conflicts.length > 0 && (
        <Alert
          type="error"
          showIcon
          closable
          onClose={() => setConflicts([])}
          style={{ marginBottom: 10, fontSize: 12 }}
          message="Schedule Conflict Detected"
          description={
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {conflicts.map((c, i) => (
                <li key={i}>
                  <strong>{c.type === 'teacher' ? 'Teacher' : c.type === 'room' ? 'Room' : 'Time'} conflict</strong> on{' '}
                  <strong>{c.day}</strong> {c.startTime}–{c.endTime} with{' '}
                  <em>
                    {c.conflictingEntry.subjectCode} ({c.conflictingEntry.assignedTeacherName || 'Unassigned'},{' '}
                    {c.conflictingEntry.room})
                  </em>
                </li>
              ))}
            </ul>
          }
        />
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        size="small"
        onValuesChange={(_changed, allValues) => updateStoreFormState(allValues)}
      >
        <Row gutter={10}>
          <Col span={12}>
            <Form.Item
              name="subjectCode"
              label="Subject Code"
              rules={[{ required: true, message: 'Required' }]}
            >
              <AutoComplete
                options={toOptions(suggestions.subjectCodes)}
                placeholder="e.g. CS101"
                onSelect={handleSubjectCodeSelect}
                filterOption={(input, option) =>
                  (option?.value as string)?.toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="offerCode"
              label="Offer Code"
              rules={[{ required: true, message: 'Required' }]}
            >
              <AutoComplete
                options={toOptions(suggestions.offerCodes)}
                placeholder="e.g. OFF-2024A"
                filterOption={(input, option) =>
                  (option?.value as string)?.toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="subjectDescription"
          label="Subject Description"
          rules={[{ required: true, message: 'Required' }]}
        >
          <AutoComplete
            options={toOptions(suggestions.subjectDescriptions || [])}
            placeholder="e.g. Introduction to Computer Science"
            filterOption={(input, option) =>
              (option?.value as string)?.toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>

        <Row gutter={10}>
          <Col span={12}>
            <Form.Item
              name="department"
              label="Department"
              rules={[{ required: true, message: 'Required' }]}
            >
              <Select
                placeholder="Select Department"
                options={dynamicData.filter((d) => d.dataType === 'department').map((d) => ({ label: d.displayAs || d.value, value: d.value }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="program"
              label="Program"
              rules={[{ required: true, message: 'Required' }]}
            >
              <Select
                placeholder="Select Program"
                options={dynamicData.filter((d) => d.dataType === 'program').map((d) => ({ label: d.displayAs || d.value, value: d.value }))}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={10}>
          <Col span={12}>
            <Form.Item
              name="year"
              label="Year"
              rules={[{ required: true, message: 'Required' }]}
            >
              <Select
                placeholder="Select Year"
                options={dynamicData.filter((d) => d.dataType === 'year').map((d) => ({ label: d.displayAs, value: d.value }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="section"
              label="Section"
              rules={[{ required: true, message: 'Required' }]}
            >
              <Select
                placeholder="Select Section"
                options={dynamicData.filter((d) => d.dataType === 'section').map((d) => ({ label: d.displayAs, value: d.value }))}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={10}>
          <Col span={12}>
            <Form.Item
              name="colorRandom"
              valuePropName="checked"
              initialValue={true}
              style={{ marginTop: 24, marginBottom: 10 }}
            >
              <Checkbox>Auto-generate (random) color</Checkbox>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="color"
              label="Subject Color"
            >
              <Select disabled={colorRandom} placeholder="Select a color preset">
                {COLOR_PRESETS.map((c) => (
                  <Select.Option key={c.value} value={c.value}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: c.value, border: '1px solid rgba(0,0,0,0.1)' }} />
                      <span>{c.label}</span>
                    </div>
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          {editingEntry && (
            <Button size="small" icon={<CloseOutlined />} onClick={handleCancel}>
              Cancel
            </Button>
          )}
          <Button type="primary" htmlType="submit" size="small" icon={<SaveOutlined />}>
            {editingEntry ? 'Update' : 'Add Blueprint'}
          </Button>
        </Space>
      </Form>
    </Card>
  );
}
