import { useState, useEffect, useRef } from 'react';
import { Modal, List, Button } from 'antd';
import { HomePage } from './pages/HomePage';
import { TimetablePage } from './pages/TimetablePage';
import { PreferencesPage } from './pages/PreferencesPage';
import { TitleBar } from './components/TitleBar';
import { PreferencesProvider } from './context/PreferencesContext';
import { CollectionProvider, useCollection } from './hooks/useCollectionContext';
import type { TimetableMeta, CollabUser, ConnectionQuality, PermissionSet } from './types';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

type Page = 'home' | 'timetable' | 'preferences';

/**
 * Root application router.
 * Uses simple state-based navigation — no external router library required.
 */
function AppInner() {
  const [page, setPage] = useState<Page>('home');
  const [activeTimetable, setActiveTimetable] = useState<TimetableMeta | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const collection = useCollection();

  useEffect(() => {
    const unlistenReady = listen('subject-form:ready', () => {
      setIsFormOpen(true);
    });
    const unlistenClosed = listen('subject-form:closed', () => {
      setIsFormOpen(false);
    });
    const unlistenSuccess = listen('subject-form:success', () => {
      setIsFormOpen(false);
    });

    return () => {
      unlistenReady.then((fn) => fn());
      unlistenClosed.then((fn) => fn());
      unlistenSuccess.then((fn) => fn());
    };
  }, []);

  // Check for a .ttcl file passed via CLI args (double-click association)
  useEffect(() => {
    async function checkOpenedFile() {
      try {
        const filePath = await invoke<string | null>('get_opened_file');
        if (filePath && typeof filePath === 'string') {
          const timetables = await collection.openCollection(filePath);
          if (timetables.length > 0) {
            setActiveTimetable(timetables[0]);
            setPage('timetable');
          }
        }
      } catch {
        // not running in Tauri or command not available
      }
    }
    void checkOpenedFile();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Triggers for TitleBar → page communication (incremented to fire actions)
  const [exportTrigger, setExportTrigger] = useState(0);
  const [saveTrigger, setSaveTrigger] = useState(0);
  const [importMergeTrigger, setImportMergeTrigger] = useState(0);
  const [exportJsonTrigger, setExportJsonTrigger] = useState(0);
  const [exportExcelRoomTrigger, setExportExcelRoomTrigger] = useState(0);
  const [importExcelTrigger, setImportExcelTrigger] = useState(0);

  // DOCX template state and QoL recent template lists
  const [docxTemplate, setDocxTemplate] = useState<{ name: string; path: string; bytes: Uint8Array } | null>(null);
  const [exportDocxModalOpen, setExportDocxModalOpen] = useState(false);
  const [recentTemplates, setRecentTemplates] = useState<{ name: string; path: string }[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('recent_docx_templates');
      if (saved) {
        setRecentTemplates(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load recent templates', e);
    }
  }, [exportDocxModalOpen]);

  async function loadTemplateFromPath(path: string) {
    try {
      const bytes = await invoke<number[]>('read_file_bytes', { path });
      const name = path.split(/[\\/]/).pop() || 'template.docx';
      
      const newTemplate = { name, path, bytes: new Uint8Array(bytes) };
      setDocxTemplate(newTemplate);
      setExportDocxModalOpen(false);

      // Add to recent templates in localStorage
      let updated = [{ name, path }, ...recentTemplates.filter(t => t.path !== path)];
      updated = updated.slice(0, 3);
      localStorage.setItem('recent_docx_templates', JSON.stringify(updated));
      setRecentTemplates(updated);
    } catch (err: unknown) {
      const { message: showMessage } = await import('@tauri-apps/plugin-dialog');
      await showMessage(`Failed to read template: ${err instanceof Error ? err.message : String(err)}`, { title: 'Error', kind: 'error' });
    }
  }

  async function handleBrowseTemplate() {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        title: 'Select Word Template',
        filters: [{ name: 'Word Documents', extensions: ['docx'] }],
        multiple: false,
        directory: false,
      });
      if (selected && typeof selected === 'string') {
        await loadTemplateFromPath(selected);
      }
    } catch (err: unknown) {
      const { message: showMessage } = await import('@tauri-apps/plugin-dialog');
      await showMessage(`Error choosing template: ${err instanceof Error ? err.message : String(err)}`, { title: 'Error', kind: 'error' });
    }
  }

  // Stable refs so the keydown handler doesn't close over stale state
  const pageRef = useRef(page);
  const openTimetableRef = useRef<((meta: TimetableMeta) => void) | null>(null);
  const closeTimetableRef = useRef<(() => void) | null>(null);
  const isDirtyRef = useRef(false);
  useEffect(() => { pageRef.current = page; }, [page]);

  function openTimetable(meta: TimetableMeta): void {
    setActiveTimetable(meta);
    setPage('timetable');
  }
  openTimetableRef.current = openTimetable;

  async function closeTimetable(): Promise<void> {
    if (isDirtyRef.current) {
      const { ask } = await import('@tauri-apps/plugin-dialog');
      const confirmed = await ask(
        'You have unsaved changes. Are you sure you want to close?',
        { title: 'Unsaved Changes', kind: 'warning', okLabel: 'Close Anyway', cancelLabel: 'Cancel' }
      );
      if (!confirmed) return;
    }
    setActiveTimetable(null);
    setPage('home');
  }
  closeTimetableRef.current = closeTimetable;

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    const handleHistoryChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ canUndo: boolean; canRedo: boolean; isDirty?: boolean }>;
      setCanUndo(customEvent.detail.canUndo);
      setCanRedo(customEvent.detail.canRedo);
      if (customEvent.detail.isDirty !== undefined) {
        isDirtyRef.current = customEvent.detail.isDirty;
      }
    };
    const handleDirtyChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ isDirty: boolean }>;
      isDirtyRef.current = customEvent.detail.isDirty;
    };
    window.addEventListener('store:history-change', handleHistoryChange);
    window.addEventListener('store:dirty-change', handleDirtyChange);
    return () => {
      window.removeEventListener('store:history-change', handleHistoryChange);
      window.removeEventListener('store:dirty-change', handleDirtyChange);
    };
  }, []);

  // ── Collaboration State (from TimetablePage events) ──

  const [collabConnected, setCollabConnected] = useState(false);
  const [collabUsers, setCollabUsers] = useState<CollabUser[]>([]);
  const [collabQuality, setCollabQuality] = useState<ConnectionQuality>('disconnected');
  const [collabLatency, setCollabLatency] = useState(0);
  const [collabMyName, setCollabMyName] = useState('');
  const [collabMyColor, setCollabMyColor] = useState('#61AFEF');
  const [collabSessionInfo, setCollabSessionInfo] = useState<{ ip: string; port: number } | null>(null);
  const [collabShareHistory, setCollabShareHistory] = useState(false);
  const [collabIsHost, setCollabIsHost] = useState(false);

  const collabCallbacksRef = useRef<{
    onSetPermission: (clientId: string, perms: PermissionSet) => void;
    onLeaveSession: () => void;
    onShareFullHistoryChange: (v: boolean) => void;
  }>({ onSetPermission: () => {}, onLeaveSession: () => {}, onShareFullHistoryChange: () => {} });

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      setCollabConnected(detail.isConnected);
      setCollabUsers(detail.connectedUsers || []);
      setCollabQuality(detail.connectionQuality || 'disconnected');
      setCollabLatency(detail.latency || 0);
      setCollabMyName(detail.myUserName || '');
      setCollabMyColor(detail.myColor || '#61AFEF');
      setCollabSessionInfo(detail.sessionInfo || null);
      setCollabShareHistory(detail.shareFullHistory || false);
      setCollabIsHost(detail.isHost || false);
      if (detail.onSetPermission) collabCallbacksRef.current.onSetPermission = detail.onSetPermission;
      if (detail.onLeaveSession) collabCallbacksRef.current.onLeaveSession = detail.onLeaveSession;
      if (detail.onShareFullHistoryChange) collabCallbacksRef.current.onShareFullHistoryChange = detail.onShareFullHistoryChange;
    };
    window.addEventListener('collab:state-change', handler);
    return () => window.removeEventListener('collab:state-change', handler);
  }, []);

  // Listen for window close request from TitleBar (red X button)
  useEffect(() => {
    async function onBeforeClose() {
      if (isDirtyRef.current) {
        const { ask } = await import('@tauri-apps/plugin-dialog');
        const confirmed = await ask(
          'You have unsaved changes. Are you sure you want to close?',
          { title: 'Unsaved Changes', kind: 'warning', okLabel: 'Close Anyway', cancelLabel: 'Cancel' }
        );
        if (!confirmed) return;
      }
      window.dispatchEvent(new CustomEvent('titlebar:confirm-close'));
    }
    window.addEventListener('titlebar:before-close', onBeforeClose);
    return () => window.removeEventListener('titlebar:before-close', onBeforeClose);
  }, []);

  // Listen for collection-related events from TitleBar
  useEffect(() => {
    function onOpenCollection(e: Event) {
      const detail = (e as CustomEvent<{ path: string }>).detail;
      if (detail?.path) {
        collection.openCollection(detail.path).then((timetables) => {
          if (timetables.length > 0 && pageRef.current !== 'timetable') {
            setActiveTimetable(timetables[0]);
            setPage('timetable');
          }
        }).catch((err) => {
          console.error('Failed to open collection:', err);
        });
      }
    }

    window.addEventListener('titlebar:open-collection', onOpenCollection);
    return () => {
      window.removeEventListener('titlebar:open-collection', onOpenCollection);
    };
  }, [collection]);

  // Global keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (!e.ctrlKey && !e.metaKey) return;
      // Don't intercept when typing inside an input/textarea
      const tag = (document.activeElement?.tagName ?? '').toLowerCase();
      const key = e.key.toLowerCase();
      const isUndoRedoOrSave = key === 'z' || key === 'y' || key === 's';
      if ((tag === 'input' || tag === 'textarea') && !isUndoRedoOrSave) return;

      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('titlebar:new'));
          break;
        case 'o':
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('titlebar:open'));
          break;
        case 'q':
          e.preventDefault();
          if (pageRef.current === 'timetable') closeTimetableRef.current?.();
          break;
        case 's':
          e.preventDefault();
          if (pageRef.current === 'timetable') {
            if (e.shiftKey) setExportTrigger((n) => n + 1);
            else setSaveTrigger((n) => n + 1);
          }
          break;
        case 'z':
          e.preventDefault();
          if (e.shiftKey) {
            window.dispatchEvent(new CustomEvent('titlebar:redo'));
          } else {
            window.dispatchEvent(new CustomEvent('titlebar:undo'));
          }
          break;
        case 'r':
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('titlebar:redo'));
          break;
        default:
          break;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TitleBar
        page={page}
        timetableName={activeTimetable?.name}
        onOpenTimetable={openTimetable}
        onOpenCollection={() => {}}
        onCloseTimetable={closeTimetable}
        onSaveAs={() => setExportTrigger((n) => n + 1)}
        onSave={() => setSaveTrigger((n) => n + 1)}
        onExportJson={() => setExportJsonTrigger((n) => n + 1)}
        onExportExcelRoom={() => setExportExcelRoomTrigger((n) => n + 1)}
        onExportDocx={() => setExportDocxModalOpen(true)}
        onImportMerge={() => setImportMergeTrigger((n) => n + 1)}
        onImportExcel={() => setImportExcelTrigger((n) => n + 1)}
        onOpenPreferences={() => setPage('preferences')}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => window.dispatchEvent(new CustomEvent('titlebar:undo'))}
        onRedo={() => window.dispatchEvent(new CustomEvent('titlebar:redo'))}

        collabConnected={collabConnected}
        collabUsers={collabUsers}
        collabQuality={collabQuality}
        collabLatency={collabLatency}
        collabMyName={collabMyName}
        collabMyColor={collabMyColor}
        collabSessionInfo={collabSessionInfo}
        collabShareHistory={collabShareHistory}
        collabIsHost={collabIsHost}
        onCollabSetPermission={collabCallbacksRef.current.onSetPermission}
        onCollabLeaveSession={collabCallbacksRef.current.onLeaveSession}
        onCollabShareHistoryChange={collabCallbacksRef.current.onShareFullHistoryChange}
      />

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {page === 'home' && (
          <HomePage onOpen={openTimetable} />
        )}
        {page === 'timetable' && activeTimetable && (
          <TimetablePage
            timetableId={activeTimetable.id}
            timetableName={activeTimetable.name}
            onBack={closeTimetable}
            exportTrigger={exportTrigger}
            saveTrigger={saveTrigger}
            importMergeTrigger={importMergeTrigger}
            exportJsonTrigger={exportJsonTrigger}
            exportExcelRoomTrigger={exportExcelRoomTrigger}
            importExcelTrigger={importExcelTrigger}
            docxTemplate={docxTemplate}
            onClearDocxTemplate={() => setDocxTemplate(null)}
          />
        )}
        {page === 'preferences' && (
          <PreferencesPage onBack={() => setPage(activeTimetable ? 'timetable' : 'home')} />
        )}
      </div>

      {isFormOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.15)',
            zIndex: 999999,
            cursor: 'not-allowed',
          }}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        />
      )}

      {/* ── Export DOCX Template Selector Modal ── */}
      <Modal
        title="Export Timetable using Word (DOCX) Template"
        open={exportDocxModalOpen}
        onCancel={() => setExportDocxModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setExportDocxModalOpen(false)}>
            Cancel
          </Button>,
          <Button
            key="browse"
            type="primary"
            onClick={handleBrowseTemplate}
            style={{ background: '#3D6B50', borderColor: '#3D6B50' }}
          >
            Use Template (Browse)...
          </Button>
        ]}
        width={500}
      >
        <div style={{ marginBottom: 16, fontSize: 13, color: '#555' }}>
          Select an existing Word document (.docx) template. You can visually select a position on any page to paste the timetable image.
        </div>
        {recentTemplates.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: '#3D6B50', fontSize: 12 }}>
              Recent Templates:
            </div>
            <List
              dataSource={recentTemplates}
              size="small"
              bordered
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button
                      type="link"
                      onClick={() => loadTemplateFromPath(item.path)}
                      style={{ color: '#3D6B50', padding: 0 }}
                    >
                      Use Template
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    title={<span style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</span>}
                    description={<span style={{ fontSize: 11, color: '#888', wordBreak: 'break-all' }}>{item.path}</span>}
                  />
                </List.Item>
              )}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

import { getCurrentWindow } from '@tauri-apps/api/window';
import { BlueprintFormWindow } from './pages/BlueprintFormWindow';

let initialIsFormWindow = false;
try {
  initialIsFormWindow = getCurrentWindow().label === 'subject-form';
} catch (e) {
  // browser fallback
}

function App() {
  if (initialIsFormWindow) {
    return <BlueprintFormWindow />;
  }

  return (
    <PreferencesProvider>
      <CollectionProvider>
        <AppInner />
      </CollectionProvider>
    </PreferencesProvider>
  );
}

export default App;
