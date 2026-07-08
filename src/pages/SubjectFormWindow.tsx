import { useState, useEffect } from 'react';
import { Layout, ConfigProvider, Alert } from 'antd';
import { listen, emit } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { SubjectEntry, FormState, ConflictInfo } from '../types';
import { SubjectForm } from '../components/SubjectForm';
import { getThemeConfig } from '../theme';

const { Content } = Layout;

export function SubjectFormWindow() {
  const [initData, setInitData] = useState<{
    suggestions: any;
    entries: SubjectEntry[];
    templates: any[];
    editingEntry: SubjectEntry | null;
    formState: FormState;
    theme: string;
    dynamicData: any[];
  } | null>(null);

  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);

  useEffect(() => {
    // 1. Tell main window that this form window is ready
    emit('subject-form:ready');

    // 2. Listen for initialization data from the main window
    const unlistenInit = listen<any>('subject-form:init', (event) => {
      setInitData(event.payload);
    });

    // 3. Listen for conflict reports from main window
    const unlistenConflict = listen<ConflictInfo[]>('subject-form:conflict', (event) => {
      setConflicts(event.payload);
    });

    // 4. Listen for success confirmation to close window
    const unlistenSuccess = listen('subject-form:success', () => {
      getCurrentWindow().close();
    });

    return () => {
      emit('subject-form:closed');
      unlistenInit.then((fn) => fn());
      unlistenConflict.then((fn) => fn());
      unlistenSuccess.then((fn) => fn());
    };
  }, []);

  const suggestions = initData?.suggestions || { assignedTeacherNames: [], subjectCodes: [], offerCodes: [], rooms: [], subjectDescriptions: [] };
  const entries = initData?.entries || [];
  const templates = initData?.templates || [];
  const editingEntry = initData?.editingEntry || null;
  const formState = initData?.formState || {
    subjectCode: '',
    offerCode: '',
    subjectDescription: '',
    teacherLastName: '',
    teacherFirstName: '',
    teacherMiddleName: '',
    room: [],
    colorRandom: true,
    color: '#2B4C7E',
    schedules: [],
    program: '',
    programShorthand: '',
    year: '',
    section: '',
    department: '',
  };
  const theme = initData?.theme || 'blue';
  const dynamicData = initData?.dynamicData || [];

  const handleFormSubmit = (entry: SubjectEntry) => {
    // Send form data back to main window for validation, conflict detection, and database storage
    emit('subject-form:submit', entry);
    // Return empty conflicts array locally since main window handles validation and alerts via events
    return [];
  };

  const handleCancel = () => {
    getCurrentWindow().close();
  };

  return (
    <ConfigProvider theme={getThemeConfig(theme)}>
      <Layout style={{ height: '100vh', background: '#F5F7FA', overflowY: 'auto' }}>
        <Content style={{ padding: 16 }}>
          {conflicts.length > 0 && (
            <Alert
              type="error"
              showIcon
              closable
              onClose={() => setConflicts([])}
              style={{ marginBottom: 12, fontSize: 12 }}
              message="Schedule Conflict Detected"
              description={
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {conflicts.map((c, i) => (
                    <li key={i}>
                      <strong>{c.type === 'teacher' ? 'Teacher' : c.type === 'room' ? 'Room' : 'Time'} conflict</strong> on{' '}
                      <strong>{c.day}</strong> {c.startTime}–{c.endTime} with{' '}
                      <em>{c.conflictingEntry.subjectCode}</em>
                    </li>
                  ))}
                </ul>
              }
            />
          )}

          <SubjectForm
            suggestions={suggestions}
            entries={entries}
            templates={templates}
            onSubmit={handleFormSubmit}
            editingEntry={editingEntry}
            onCancelEdit={handleCancel}
            formState={formState}
            onFormStateChange={(state) => emit('subject-form:state-change', state)}
            dynamicData={dynamicData}
          />
        </Content>
      </Layout>
    </ConfigProvider>
  );
}
