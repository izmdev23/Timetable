import { Form, Input, Select, Button, TimePicker, Divider, Typography, Space, Modal } from 'antd';
import { SaveOutlined, CloseOutlined, DeleteOutlined } from '@ant-design/icons';
import { useEffect } from 'react';
import dayjs from 'dayjs';
import type { SubjectEntry, Schedule, DayOfWeek } from '../types';
import { DAY_ORDER } from '../types';

const { Text } = Typography;

interface SchedulePropertiesPanelProps {
  entry: SubjectEntry;
  schedule: Schedule;
  dynamicData: Array<{ id: string; dataType: string; value: string; displayAs: string }>;
  onSave: (updatedEntry: SubjectEntry) => void;
  onCancel: () => void;
  onDeleteSchedule: (entryId: string, scheduleId: string) => void;
}

interface FormValues {
  subjectCode: string;
  offerCode: string;
  subjectDescription: string;
  assignedTeacherName: string;
  department: string;
  program: string;
  year: string;
  section: string;
  days: DayOfWeek[];
  timeRange: [dayjs.Dayjs, dayjs.Dayjs] | null;
  rooms: string[];
}

export function SchedulePropertiesPanel({
  entry,
  schedule,
  dynamicData,
  onSave,
  onCancel,
  onDeleteSchedule,
}: SchedulePropertiesPanelProps) {
  const [form] = Form.useForm<FormValues>();

  useEffect(() => {
    form.setFieldsValue({
      subjectCode: entry.subjectCode,
      offerCode: entry.offerCode,
      subjectDescription: entry.subjectDescription,
      assignedTeacherName: schedule.assignedTeacherName || entry.assignedTeacherName || '',
      department: entry.department || '',
      program: entry.program || '',
      year: String(entry.year),
      section: entry.section || '',
      days: schedule.days,
      timeRange: schedule.startTime && schedule.endTime 
      ? [dayjs(schedule.startTime, 'HH:mm'), dayjs(schedule.endTime, 'HH:mm')]
      : null,
      rooms: schedule.rooms || [],
    });
  }, [entry, schedule, form]);

  const handleFinish = (values: FormValues) => {
    if (!values.rooms || values.rooms.length === 0) {
      Modal.error({
        title: 'Validation Error',
        content: 'At least one room must be assigned to this schedule slot.',
      });
      return;
    }

    const updatedSchedule: Schedule = {
      ...schedule,
      days: values.days,
      startTime: values.timeRange ? values.timeRange[0].format('HH:mm') : '',
      endTime: values.timeRange ? values.timeRange[1].format('HH:mm') : '',
      rooms: values.rooms,
      assignedTeacherName: values.assignedTeacherName,
    };

    const updatedSchedules = entry.schedules.map((s) =>
      s.id === schedule.id ? updatedSchedule : s
    );

    const updatedRooms = Array.from(
      new Set(updatedSchedules.flatMap((s) => s.rooms))
    ).join(', ');

    const updatedEntry: SubjectEntry = {
      ...entry,
      subjectCode: values.subjectCode.trim(),
      offerCode: values.offerCode.trim(),
      subjectDescription: values.subjectDescription.trim(),
      assignedTeacherName: entry.assignedTeacherName,
      department: values.department,
      program: values.program,
      year: Number(values.year),
      section: values.section,
      schedules: updatedSchedules,
      room: updatedRooms,
    };

    onSave(updatedEntry);
  };

  const instructors = dynamicData
    .filter((d) => d.dataType === 'instructor')
    .map((d) => {
      // value is saved as "LastName, FirstName, MiddleName"
      const parts = d.value.split(', ');
      const label = `${parts[0]}, ${parts[1]}${parts[2] ? ' ' + parts[2] : ''}`;
      return { label, value: d.value };
    });

  const roomsOptions = dynamicData
    .filter((d) => d.dataType === 'room')
    .map((d) => {
      const parts = d.displayAs.split('|');
      const label = `${parts[0]} (${parts[1] || 'No Building'})`;
      return { label, value: d.value };
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
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #E4E9F0', background: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text strong style={{ fontSize: 13, color: '#1E3560' }}>
          Schedule Properties
        </Text>
        <Space size={4}>
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => onDeleteSchedule(entry.id, schedule.id)}
          />
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={onCancel}
          />
        </Space>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          size="small"
        >
          <Typography.Paragraph strong style={{ fontSize: 11, marginBottom: 8, color: '#4A5B78' }}>
            SUBJECT DETAILS
          </Typography.Paragraph>

          <Form.Item name="subjectCode" label="Subject Code" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Form.Item name="offerCode" label="Offer Code" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Form.Item name="subjectDescription" label="Description" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Form.Item name="assignedTeacherName" label="Instructor">
            <Select
              allowClear
              placeholder="Unassigned"
              options={instructors}
            />
          </Form.Item>

          <Form.Item name="department" label="Department" rules={[{ required: true }]}>
            <Select
              placeholder="Select Department"
              options={dynamicData
                .filter((d) => d.dataType === 'department')
                .map((d) => ({ label: d.displayAs || d.value, value: d.value }))}
            />
          </Form.Item>

          <Form.Item name="program" label="Program" rules={[{ required: true }]}>
            <Select
              placeholder="Select Program"
              options={dynamicData
                .filter((d) => d.dataType === 'program')
                .map((d) => ({ label: d.displayAs || d.value, value: d.value }))}
            />
          </Form.Item>

          <div style={{ display: 'flex', gap: 8 }}>
            <Form.Item name="year" label="Year" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select
                placeholder="Year"
                options={dynamicData
                  .filter((d) => d.dataType === 'year')
                  .map((d) => ({ label: d.displayAs || d.value, value: d.value }))}
              />
            </Form.Item>
            <Form.Item name="section" label="Section" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select
                placeholder="Section"
                options={dynamicData
                  .filter((d) => d.dataType === 'section')
                  .map((d) => ({ label: d.displayAs || d.value, value: d.value }))}
              />
            </Form.Item>
          </div>

          <Divider style={{ margin: '12px 0' }} />

          <Typography.Paragraph strong style={{ fontSize: 11, marginBottom: 8, color: '#4A5B78' }}>
            SCHEDULE SLOT DETAILS
          </Typography.Paragraph>

          <Form.Item name="days" label="Days" rules={[{ required: true }]}>
            <Select
              mode="multiple"
              placeholder="Select days"
              options={DAY_ORDER.map((d) => ({ label: d, value: d }))}
              maxTagCount={3}
            />
          </Form.Item>

          <Form.Item name="timeRange" label="Time Range" rules={[{ required: true }]}>
            <TimePicker.RangePicker
              format="hh:mm A"
              use12Hours
              minuteStep={5}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item name="rooms" label="Rooms" rules={[{ required: true }]}>
            <Select
              mode="multiple"
              placeholder="Select rooms"
              options={roomsOptions}
            />
          </Form.Item>

          <Form.Item style={{ marginTop: 16 }}>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} block>
              Save Properties
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
