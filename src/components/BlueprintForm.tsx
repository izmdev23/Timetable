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
  Popover,
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

const MATERIAL_PALETTE: Record<string, string[]> = {
  red: ['#FFEBEE', '#FFCDD2', '#EF9A9A', '#E57373', '#EF5350', '#F44336', '#E53935', '#D32F2F', '#C62828', '#B71C1C'],
  pink: ['#FCE4EC', '#F8BBD0', '#F48FB1', '#F06292', '#EC407A', '#E91E63', '#D81B60', '#C2185B', '#AD1457', '#880E4F'],
  purple: ['#F3E5F5', '#E1BEE7', '#CE93D8', '#BA68C8', '#AB47BC', '#9C27B0', '#8E24AA', '#7B1FA2', '#6A1B9A', '#4A148C'],
  deepPurple: ['#EDE7F6', '#D1C4E9', '#B39DDB', '#9575CD', '#7E57C2', '#673AB7', '#5E35B1', '#512DA8', '#4527A0', '#311B92'],
  indigo: ['#E8EAF6', '#C5CAE9', '#9FA8DA', '#7986CB', '#5C6BC0', '#3F51B5', '#3949AB', '#303F9F', '#283593', '#1A237E'],
  blue: ['#E3F2FD', '#BBDEFB', '#90CAF9', '#64B5F6', '#42A5F5', '#2196F3', '#1E88E5', '#1976D2', '#1565C0', '#0D47A1'],
  lightBlue: ['#E1F5FE', '#B3E5FC', '#81D4FA', '#4FC3F7', '#29B6F6', '#03A9F4', '#039BE5', '#0288D1', '#0277BD', '#01579B'],
  cyan: ['#E0F7FA', '#B2EBF2', '#80DEEA', '#4DD0E1', '#26C6DA', '#00BCD4', '#00ACC1', '#0097A7', '#00838F', '#006064'],
  teal: ['#E0F2F1', '#B2DFDB', '#80CBC4', '#4DB6AC', '#26A69A', '#009688', '#00897B', '#00796B', '#00695C', '#004D40'],
  green: ['#E8F5E9', '#C8E6C9', '#A5D6A7', '#81C784', '#66BB6A', '#4CAF50', '#43A047', '#388E3C', '#2E7D32', '#1B5E20'],
  lightGreen: ['#F1F8E9', '#DCEDC8', '#C5E1A5', '#AED581', '#9CCC65', '#8BC34A', '#7CB342', '#689F38', '#558B2F', '#33691E'],
  yellow: ['#FFFDE7', '#FFF9C4', '#FFF59D', '#FFF176', '#FFEE58', '#FFEB3B', '#FDD835', '#FBC02D', '#F9A825', '#F57F17'],
  amber: ['#FFF8E1', '#FFECB3', '#FFE082', '#FFD54F', '#FFCA28', '#FFC107', '#FFB300', '#FFA000', '#FF8F00', '#FF6F00'],
  orange: ['#FFF3E0', '#FFE0B2', '#FFCC80', '#FFB74D', '#FFA726', '#FF9800', '#FB8C00', '#F57C00', '#EF6C00', '#E65100'],
  deepOrange: ['#FBE9E7', '#FFCCBC', '#FFAB91', '#FF8A65', '#FF7043', '#FF5722', '#F4511E', '#E64A19', '#D84315', '#BF360C'],
  brown: ['#EFEBE9', '#D7CCC8', '#BCAAA4', '#A1887F', '#8D6E63', '#795548', '#6D4C41', '#5D4037', '#4E342E', '#3E2723'],
  grey: ['#FAFAFA', '#F5F5F5', '#EEEEEE', '#E0E0E0', '#BDBDBD', '#9E9E9E', '#757575', '#616161', '#424242', '#212121'],
  blueGrey: ['#ECEFF1', '#CFD8DC', '#B0BEC5', '#90A4AE', '#78909C', '#607D8B', '#546E7A', '#455A64', '#37474F', '#263238'],
};

function getRandomMaterialColor(): string {
  const names = Object.keys(MATERIAL_PALETTE);
  const name = names[Math.floor(Math.random() * names.length)];
  const shades = MATERIAL_PALETTE[name];
  return shades[Math.floor(Math.random() * shades.length)];
}

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
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const colorRandom = Form.useWatch('colorRandom', form) ?? true;
  const selectedColor = Form.useWatch('color', form) ?? '#2196F3';

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
    const color = values.colorRandom ? getRandomMaterialColor() : values.color;
    const entry: SubjectEntry = {
      id: editingEntry?.id ?? uid(),
      subjectCode: values.subjectCode.trim(),
      offerCode: values.offerCode.trim(),
      subjectDescription: values.subjectDescription.trim(),
      assignedTeacherName: '',
      room: '',
      color,
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
          async onOk() {
            const result = onSubmit(entry);
            setConflicts([]);
            if (result.length === 0) {
              resetPreservingColor();
            }
          },
        });
        return;
      }
    }

    const result = onSubmit(entry);
    setConflicts([]);
    if (!editingEntry && result.length === 0) {
      resetPreservingColor();
    }
  }

  function resetPreservingColor() {
    const currentColorRandom = form.getFieldValue('colorRandom');
    const currentColor = form.getFieldValue('color');
    form.resetFields();
    form.setFieldsValue({ colorRandom: currentColorRandom, color: currentColor });
    setTimeout(() => {
      const el = document.getElementById('subjectCode');
      if (el) {
        el.focus();
        if (el instanceof HTMLInputElement) {
          el.select();
        }
      }
    }, 50);
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
      color: allValues.color || '#2196F3',
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

  const colorGrid = (
    <div style={{ width: 260, maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {Object.entries(MATERIAL_PALETTE).map(([name, shades]) => (
        <div key={name} style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {shades.map((hex) => (
            <div
              key={hex}
              onClick={() => {
                form.setFieldsValue({ color: hex });
                updateStoreFormState({ ...form.getFieldsValue(), color: hex });
                setColorPickerOpen(false);
              }}
              style={{
                width: 20,
                height: 20,
                background: hex,
                borderRadius: 3,
                cursor: 'pointer',
                border: selectedColor === hex ? '2px solid #333' : '1px solid rgba(0,0,0,0.1)',
                flexShrink: 0,
              }}
              title={hex}
            />
          ))}
        </div>
      ))}
    </div>
  );

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
                id="subjectCode"
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
              <Checkbox>Randomize Color</Checkbox>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="color"
              label="Subject Color"
            >
              <Popover
                content={colorGrid}
                trigger="click"
                open={!colorRandom && colorPickerOpen}
                onOpenChange={setColorPickerOpen}
                placement="bottomRight"
              >
                <Button
                  disabled={colorRandom}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    textAlign: 'left',
                  }}
                >
                  <div style={{ width: 16, height: 16, borderRadius: 3, background: selectedColor, border: '1px solid rgba(0,0,0,0.15)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: colorRandom ? '#bbb' : '#333' }}>
                    {selectedColor}
                  </span>
                </Button>
              </Popover>
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
