import { useState, useEffect, useRef } from 'react';
import { HomePage } from './pages/HomePage';
import { TimetablePage } from './pages/TimetablePage';
import { PreferencesPage } from './pages/PreferencesPage';
import { TitleBar } from './components/TitleBar';
import { PreferencesProvider } from './context/PreferencesContext';
import { CollectionProvider, useCollection } from './hooks/useCollectionContext';
import type { TimetableMeta } from './types';
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
        onImportMerge={() => setImportMergeTrigger((n) => n + 1)}
        onImportExcel={() => setImportExcelTrigger((n) => n + 1)}
        onOpenPreferences={() => setPage('preferences')}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => window.dispatchEvent(new CustomEvent('titlebar:undo'))}
        onRedo={() => window.dispatchEvent(new CustomEvent('titlebar:redo'))}
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
