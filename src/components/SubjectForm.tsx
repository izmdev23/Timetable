import {
  Form,
  Select,
  AutoComplete,
  Button,
  TimePicker,
  Space,
  Alert,
  Divider,
  Typography,
  Card,
  Row,
  Col,
  Checkbox,
  Modal,
} from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import type { SubjectEntry, Schedule, ConflictInfo, DayOfWeek, FormState } from '../types';
import { DAY_ORDER } from '../types';
import { parseTeacherName } from '../utils/teacherName';
import { formatTimeTo12Hr } from '../utils/time';

const { Text } = Typography;

interface SubjectFormProps {
  /** Suggestions derived from existing entries for autocomplete */
  suggestions: {
    assignedTeacherNames: string[];
    subjectCodes: string[];
    offerCodes: string[];
    rooms: string[];
    subjectDescriptions?: string[];
  };
  /** Full list of existing entries — used to derive program/section suggestions */
  entries: SubjectEntry[];
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
  /** Called with the new/updated entry; returns any conflicts */
  onSubmit: (entry: SubjectEntry) => ConflictInfo[];
  /** Populated when editing an existing entry */
  editingEntry?: SubjectEntry | null;
  /** Called when the edit is cancelled */
  onCancelEdit?: () => void;
  formState: FormState;
  onFormStateChange: (state: FormState) => void;
}

interface FormValues {
  subjectCode: string;
  offerCode: string;
  subjectDescription: string;
  teacherLastName: string;
  teacherFirstName: string;
  teacherMiddleName: string;
  room: string | string[];
  colorRandom: boolean;
  color: string;
  schedules: Array<{
    days: DayOfWeek[];
    timeRange: [dayjs.Dayjs, dayjs.Dayjs] | null;
  }>;
  program: string;
  programShorthand: string;
  year: string;
  section: string;
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

/** Generates a simple unique id string */
function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Converts a string array to AutoComplete options */
function toOptions(values: string[]): { value: string }[] {
  return values.map((v) => ({ value: v }));
}

/**
 * Data entry form for creating and editing subject timetable entries.
 * Supports autocomplete from previous entries and shows inline conflict alerts.
 */
export function SubjectForm({
  suggestions,
  entries,
  templates,
  onSubmit,
  editingEntry,
  onCancelEdit,
  formState,
  onFormStateChange,
}: SubjectFormProps) {
  const [form] = Form.useForm<FormValues>();
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const colorRandom = Form.useWatch('colorRandom', form) ?? true;

  // Parse teacher names to suggestions
  const parsedTeachers = useMemo(() => {
    return suggestions.assignedTeacherNames.map(parseTeacherName);
  }, [suggestions.assignedTeacherNames]);

  const lastNameSuggestions = useMemo(() => {
    return Array.from(new Set(parsedTeachers.map((t) => t.lastName).filter(Boolean))).sort();
  }, [parsedTeachers]);

  const firstNameSuggestions = useMemo(() => {
    return Array.from(new Set(parsedTeachers.map((t) => t.firstName).filter(Boolean))).sort();
  }, [parsedTeachers]);

  const middleNameSuggestions = useMemo(() => {
    return Array.from(new Set(parsedTeachers.map((t) => t.middleName).filter(Boolean))).sort();
  }, [parsedTeachers]);

  // Derive unique program combos from existing entries for cross-fill autocomplete
  const programCombos = useMemo(() => {
    const seen = new Map<string, { program: string; programShorthand: string }>();
    for (const e of entries) {
      if (e.program && e.programShorthand) {
        const key = e.programShorthand.trim().toLowerCase();
        if (!seen.has(key)) {
          seen.set(key, { program: e.program.trim(), programShorthand: e.programShorthand.trim() });
        }
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.program.localeCompare(b.program));
  }, [entries]);

  const programSuggestions = useMemo(
    () => Array.from(new Set(programCombos.map((p) => p.program))).sort(),
    [programCombos]
  );

  const programShorthandSuggestions = useMemo(
    () => Array.from(new Set(programCombos.map((p) => p.programShorthand))).sort(),
    [programCombos]
  );

  const yearSuggestions = useMemo(() => {
    return Array.from(new Set(entries.map((e) => String(e.year)).filter(Boolean))).sort();
  }, [entries]);

  const sectionSuggestions = useMemo(() => {
    return Array.from(new Set(entries.map((e) => e.section).filter(Boolean))).sort();
  }, [entries]);

  // Populate form when formState from store changes
  useEffect(() => {
    const values: FormValues = {
      subjectCode: formState.subjectCode,
      offerCode: formState.offerCode,
      subjectDescription: formState.subjectDescription,
      teacherLastName: formState.teacherLastName,
      teacherFirstName: formState.teacherFirstName,
      teacherMiddleName: formState.teacherMiddleName,
      room: formState.room,
      colorRandom: formState.colorRandom,
      color: formState.color,
      schedules: formState.schedules.map((s) => ({
        days: s.days,
        timeRange: s.timeRange ? [dayjs(s.timeRange[0], 'HH:mm'), dayjs(s.timeRange[1], 'HH:mm')] : null,
      })),
      program: formState.program,
      programShorthand: formState.programShorthand,
      year: formState.year,
      section: formState.section,
    };
    form.setFieldsValue(values);
    setConflicts([]);
  }, [formState, form]);

  // Listen for undo/redo focus events to highlight the changed input fields
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
        'teacherLastName',
        'teacherFirstName',
        'teacherMiddleName',
        'room',
        'program',
        'programShorthand',
        'year',
        'section',
        'colorRandom',
        'color',
      ];

      for (const key of keys) {
        const oldVal = oldState.formState[key];
        const newVal = newState.formState[key];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          // Changed input! Focus the Ant Design Form field by ID
          setTimeout(() => {
            const inputId = key;
            const el = document.getElementById(inputId);
            if (el) {
              el.focus();
              if (el instanceof HTMLInputElement) {
                el.select();
              }
              // Add pulse highlight style
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
    const schedules: Schedule[] = (values.schedules || [])
      .filter((s) => s && s.days && s.days.length > 0 && s.timeRange)
      .map((s) => ({
        id: uid(),
        days: s.days,
        startTime: s.timeRange ? s.timeRange[0].format('HH:mm') : '',
        endTime: s.timeRange ? s.timeRange[1].format('HH:mm') : '',
      }));

    const lName = values.teacherLastName.trim();
    const fName = values.teacherFirstName.trim();
    const mName = values.teacherMiddleName?.trim() ?? '';
    const combinedTeacherName = `${lName}, ${fName}, ${mName}`;

    const entry: SubjectEntry = {
      id: editingEntry?.id ?? uid(),
      subjectCode: values.subjectCode.trim(),
      offerCode: values.offerCode.trim(),
      subjectDescription: values.subjectDescription.trim(),
      assignedTeacherName: combinedTeacherName,
      room: Array.isArray(values.room)
        ? values.room.map((r) => r.trim()).filter(Boolean).join(', ')
        : typeof values.room === 'string'
        ? values.room.trim()
        : '',
      color: values.colorRandom ? undefined : values.color,
      schedules,
      program: values.program.trim(),
      programShorthand: values.programShorthand.trim(),
      year: Number(values.year),
      section: values.section.trim(),
    };

    if (!entry.room) {
      const proceed = window.confirm('Warning: This subject entry has no rooms assigned. Are you sure you want to proceed?');
      if (!proceed) return;
    }

    if (!editingEntry) {
      const isDuplicate = entries.some((existing) => {
        const fieldsMatch =
          existing.subjectCode.trim().toLowerCase() === entry.subjectCode.toLowerCase() &&
          existing.offerCode.trim().toLowerCase() === entry.offerCode.toLowerCase() &&
          existing.subjectDescription.trim().toLowerCase() === entry.subjectDescription.toLowerCase() &&
          existing.assignedTeacherName.trim().toLowerCase() === entry.assignedTeacherName.toLowerCase() &&
          existing.room.trim().toLowerCase() === entry.room.toLowerCase() &&
          existing.program.trim().toLowerCase() === entry.program.toLowerCase() &&
          existing.programShorthand.trim().toLowerCase() === entry.programShorthand.toLowerCase() &&
          existing.year === entry.year &&
          existing.section.trim().toLowerCase() === entry.section.toLowerCase();

        if (!fieldsMatch) return false;
        if (existing.schedules.length !== entry.schedules.length) return false;

        return entry.schedules.every((s) =>
          existing.schedules.some(
            (es) =>
              es.startTime === s.startTime &&
              es.endTime === s.endTime &&
              es.days.length === s.days.length &&
              es.days.every((d) => s.days.includes(d))
          )
        );
      });

      if (isDuplicate) {
        Modal.confirm({
          title: 'Duplicate Entry Warning',
          content: 'A subject entry with the exact same data already exists. Do you want to proceed and add this duplicate entry?',
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
      teacherLastName: allValues.teacherLastName || '',
      teacherFirstName: allValues.teacherFirstName || '',
      teacherMiddleName: allValues.teacherMiddleName || '',
      room: Array.isArray(allValues.room) ? allValues.room : [],
      colorRandom: allValues.colorRandom ?? true,
      color: allValues.color || '#2B4C7E',
      schedules: (allValues.schedules || []).map((s) => ({
        days: s.days || [],
        timeRange: s.timeRange
          ? [s.timeRange[0].format('HH:mm'), s.timeRange[1].format('HH:mm')] as [string, string]
          : null,
      })),
      program: allValues.program || '',
      programShorthand: allValues.programShorthand || '',
      year: allValues.year || '1',
      section: allValues.section || '',
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
        programShorthand: match.programShorthand || '',
        year: match.year !== undefined ? String(match.year) : '1',
        section: match.section || '',
      };
      updateStoreFormState(updated);
    }
  }

  function handleLastNameSelect(value: string) {
    const match = parsedTeachers.find((t) => t.lastName === value);
    if (match) {
      const current = form.getFieldsValue();
      const updated = {
        ...current,
        teacherLastName: value,
        teacherFirstName: match.firstName,
        teacherMiddleName: match.middleName,
      };
      updateStoreFormState(updated);
    }
  }

  function handleFirstNameSelect(value: string) {
    const match = parsedTeachers.find((t) => t.firstName === value);
    if (match) {
      const current = form.getFieldsValue();
      const updated = {
        ...current,
        teacherFirstName: value,
        teacherLastName: match.lastName,
        teacherMiddleName: match.middleName,
      };
      updateStoreFormState(updated);
    }
  }

  function handleMiddleNameSelect(value: string) {
    const match = parsedTeachers.find((t) => t.middleName === value);
    if (match) {
      const current = form.getFieldsValue();
      const updated = {
        ...current,
        teacherMiddleName: value,
        teacherLastName: match.lastName,
        teacherFirstName: match.firstName,
      };
      updateStoreFormState(updated);
    }
  }

  function handleProgramSelect(value: string) {
    const match = programCombos.find((p) => p.program === value);
    if (match) {
      const current = form.getFieldsValue();
      const updated = {
        ...current,
        program: value,
        programShorthand: match.programShorthand,
      };
      updateStoreFormState(updated);
    }
  }

  function handleProgramShorthandSelect(value: string) {
    const match = programCombos.find((p) => p.programShorthand === value);
    if (match) {
      const current = form.getFieldsValue();
      const updated = {
        ...current,
        programShorthand: value,
        program: match.program,
      };
      updateStoreFormState(updated);
    }
  }

  return (
    <Card
      size="small"
      title={
        <Text strong style={{ fontSize: 13 }}>
          {editingEntry ? 'Edit Subject Entry' : 'Add Subject Entry'}
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
                  <strong>{c.day}</strong> {formatTimeTo12Hr(c.startTime)}–{formatTimeTo12Hr(c.endTime)} with{' '}
                  <em>
                    {c.conflictingEntry.subjectCode} ({c.conflictingEntry.assignedTeacherName},{' '}
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
          <Col span={9}>
            <Form.Item
              name="teacherLastName"
              label="Last Name"
              rules={[{ required: true, message: 'Required' }]}
            >
              <AutoComplete
                options={toOptions(lastNameSuggestions)}
                placeholder="e.g. Santos"
                onSelect={handleLastNameSelect}
                filterOption={(input, option) =>
                  (option?.value as string)?.toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
          </Col>
          <Col span={9}>
            <Form.Item
              name="teacherFirstName"
              label="First Name"
              rules={[{ required: true, message: 'Required' }]}
            >
              <AutoComplete
                options={toOptions(firstNameSuggestions)}
                placeholder="e.g. Maria"
                onSelect={handleFirstNameSelect}
                filterOption={(input, option) =>
                  (option?.value as string)?.toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              name="teacherMiddleName"
              label={
                <span>
                  Middle Name{' '}
                  <span style={{ fontStyle: 'italic', opacity: 0.6, fontWeight: 'normal' }}>
                    (optional)
                  </span>
                </span>
              }
            >
              <AutoComplete
                options={toOptions(middleNameSuggestions)}
                placeholder="e.g. Clara"
                onSelect={handleMiddleNameSelect}
                filterOption={(input, option) =>
                  (option?.value as string)?.toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={10}>
          <Col span={8}>
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
          <Col span={8}>
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
          <Col span={8}>
            <Form.Item
              name="room"
              label="Room (optional)"
              rules={[]}
            >
              <Select
                mode="tags"
                tokenSeparators={[',']}
                style={{ width: '100%' }}
                placeholder="e.g. Room 301, Room 302"
                options={suggestions.rooms.map((r) => ({ label: r, value: r }))}
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
              name="program"
              label="Program"
              rules={[{ required: true, message: 'Required' }]}
            >
              <AutoComplete
                options={toOptions(programSuggestions)}
                placeholder="e.g. Computer Science"
                onSelect={handleProgramSelect}
                filterOption={(input, option) =>
                  (option?.value as string)?.toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="programShorthand"
              label="Program Shorthand"
              rules={[{ required: true, message: 'Required' }]}
            >
              <AutoComplete
                options={toOptions(programShorthandSuggestions)}
                placeholder="e.g. BSCS"
                onSelect={handleProgramShorthandSelect}
                filterOption={(input, option) =>
                  (option?.value as string)?.toLowerCase().includes(input.toLowerCase())
                }
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
              <AutoComplete
                options={toOptions(yearSuggestions)}
                placeholder="e.g. 1"
                filterOption={(input, option) =>
                  (option?.value as string)?.toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="section"
              label="Section"
              rules={[{ required: true, message: 'Required' }]}
            >
              <AutoComplete
                options={toOptions(sectionSuggestions)}
                placeholder="e.g. A"
                filterOption={(input, option) =>
                  (option?.value as string)?.toLowerCase().includes(input.toLowerCase())
                }
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

        {/* Schedules list */}
        <Divider style={{ margin: '8px 0', fontSize: 12 }}>Schedules</Divider>

        <Form.List
          name="schedules"
          initialValue={[]}
        >
          {(fields, { add, remove }, { errors }) => (
            <>
              {fields.map(({ key, name }) => (
                <Space key={key} align="end" style={{ display: 'flex', marginBottom: 6 }}>
                  <Form.Item
                    name={[name, 'days']}
                    label="Days"
                    rules={[{ required: true, message: 'Select at least one day' }]}
                    style={{ marginBottom: 0, minWidth: 220 }}
                  >
                    <Select
                      mode="multiple"
                      placeholder="Select days"
                      options={DAY_ORDER.map((d) => ({ label: d, value: d }))}
                      maxTagCount={4}
                    />
                  </Form.Item>

                  <Form.Item
                    name={[name, 'timeRange']}
                    label="Start – End"
                    rules={[{ required: true, message: 'Set time range' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <TimePicker.RangePicker
                      format="hh:mm A"
                      use12Hours
                      minuteStep={5}
                      style={{ width: 185 }}
                    />
                  </Form.Item>

                  {fields.length > 1 && (
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => remove(name)}
                      style={{ marginBottom: 0 }}
                    />
                  )}
                </Space>
              ))}

              <Form.ErrorList errors={errors} />

              <Button
                type="dashed"
                onClick={() => add({ days: [], timeRange: null })}
                icon={<PlusOutlined />}
                size="small"
                style={{ marginTop: 2, marginBottom: 8 }}
              >
                Add Schedule
              </Button>
            </>
          )}
        </Form.List>

        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          {editingEntry && (
            <Button size="small" icon={<CloseOutlined />} onClick={handleCancel}>
              Cancel
            </Button>
          )}
          <Button type="primary" htmlType="submit" size="small" icon={<SaveOutlined />}>
            {editingEntry ? 'Update' : 'Add Entry'}
          </Button>
        </Space>
      </Form>
    </Card>
  );
}
