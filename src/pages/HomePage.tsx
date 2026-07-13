import { useState } from 'react';
import {
  Layout,
  Typography,
  Button,
  Modal,
  Input,
  Card,
  Row,
  Col,
  Dropdown,
  Popconfirm,
  Empty,
  Spin,
  Tag,
  Space,
  message,
  Checkbox,
  Select,
  AutoComplete,
} from 'antd';
import {
  PlusOutlined,
  FolderOpenOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  EditOutlined,
  CalendarOutlined,
  CloseOutlined,
  FileAddOutlined,
} from '@ant-design/icons';
import Database from '@tauri-apps/plugin-sql';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { useTimetableList } from '../hooks/useTimetableList';
import { useCollection } from '../hooks/useCollectionContext';
import { exportToXlsx } from '../utils/exportXlsx';
import type { TimetableMeta, SubjectEntry, DayOfWeek } from '../types';

const { Content } = Layout;
const { Title, Text } = Typography;

function toMin(time: string): number {
  const parts = time.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function toTime(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, '0');
  const m = (min % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

const TIME_OPTIONS = Array.from({ length: 49 }, (_, i) => {
  const min = i * 30;
  const h = Math.floor(min / 60).toString().padStart(2, '0');
  const m = (min % 60).toString().padStart(2, '0');
  return { label: `${h}:${m}`, value: min };
});

function filterEntriesForExport(
  entries: SubjectEntry[],
  hiddenDays: DayOfWeek[],
  excludeHiddenDays: boolean,
  viewStart: number,
  viewEnd: number,
  excludeTimeWindow: boolean,
): SubjectEntry[] {
  return entries
    .map((entry) => {
      const schedules = entry.schedules
        .map((sched) => {
          const days = excludeHiddenDays
            ? sched.days.filter((d) => !hiddenDays.includes(d))
            : sched.days;
          if (days.length === 0) return null;
          const s = toMin(sched.startTime);
          const e = toMin(sched.endTime);
          if (excludeTimeWindow && (s >= viewEnd || e <= viewStart)) return null;
          const clampedStart = excludeTimeWindow ? Math.max(s, viewStart) : s;
          const clampedEnd = excludeTimeWindow ? Math.min(e, viewEnd) : e;
          return { ...sched, days, startTime: toTime(clampedStart), endTime: toTime(clampedEnd) };
        })
        .filter((s): s is Exclude<typeof s, null> => s !== null);
      return { ...entry, schedules };
    })
    .filter((entry) => {
      const original = entries.find((e) => e.id === entry.id);
      const originalHadSchedules = original ? original.schedules.length > 0 : false;
      if (originalHadSchedules && entry.schedules.length === 0) return false;
      return true;
    });
}

interface HomePageProps {
  onOpen: (timetable: TimetableMeta) => void;
}

export function HomePage({ onOpen }: HomePageProps) {
  const list = useTimetableList();
  const collection = useCollection();
  const [messageApi, contextHolder] = message.useMessage();

  // ── Create Collection modal ────────────────────────────────────────────
  const [createCollectionModalOpen, setCreateCollectionModalOpen] = useState(false);
  const [createCollectionName, setCreateCollectionName] = useState('');
  const [creatingCollection, setCreatingCollection] = useState(false);

  async function handleCreateCollection(): Promise<void> {
    const trimmed = createCollectionName.trim();
    if (!trimmed) return;
    setCreatingCollection(true);
    try {
      const resolvedPath = await invoke<string>('resolve_default_path', { filename: `${trimmed}.ttcl` });
      const selectedPath = await saveDialog({
        title: 'Save New Collection',
        defaultPath: resolvedPath,
        filters: [{ name: 'Timetable Collection', extensions: ['ttcl'] }],
      });
      if (!selectedPath) { setCreatingCollection(false); return; }

      const timetables = await collection.createCollection(selectedPath, trimmed);
      setCreateCollectionModalOpen(false);
      setCreateCollectionName('');

      if (timetables.length > 0) {
        onOpen(timetables[0]);
      } else {
        await list.refresh();
      }
    } catch (e: unknown) {
      messageApi.error(`Failed to create collection: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCreatingCollection(false);
    }
  }

  // ── Open Collection ────────────────────────────────────────────────────
  async function handleOpenCollection(): Promise<void> {
    try {
      const filePath = await openDialog({
        title: 'Open Timetable Collection',
        filters: [{ name: 'Timetable Collection', extensions: ['ttcl'] }],
        multiple: false,
        directory: false,
      });
      if (!filePath || typeof filePath !== 'string') return;

      const timetables = await collection.openCollection(filePath);
      if (timetables.length > 0) {
        onOpen(timetables[0]);
      } else {
        await list.refresh();
      }
    } catch (e: unknown) {
      messageApi.error(`Failed to open collection: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── Open recent collection ─────────────────────────────────────────────
  async function handleOpenRecent(path: string): Promise<void> {
    try {
      const timetables = await collection.openCollection(path);
      if (timetables.length > 0) {
        onOpen(timetables[0]);
      } else {
        await list.refresh();
      }
    } catch (e: unknown) {
      messageApi.error(`Failed to open collection: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── Close Collection ────────────────────────────────────────────────────
  async function handleCloseCollection(): Promise<void> {
    await collection.closeCollection();
    await list.refresh();
  }

  // ── New Timetable (within collection) ──────────────────────────────────
  const [newTimetableModalOpen, setNewTimetableModalOpen] = useState(false);
  const [newTimetableName, setNewTimetableName] = useState('');
  const [creatingTimetable, setCreatingTimetable] = useState(false);

  async function handleCreateTimetable(): Promise<void> {
    const trimmed = newTimetableName.trim();
    if (!trimmed) return;
    setCreatingTimetable(true);
    try {
      const meta = await list.createTimetable(trimmed);
      setNewTimetableModalOpen(false);
      setNewTimetableName('');
      onOpen(meta);
    } catch (e: unknown) {
      messageApi.error(`Failed to create timetable: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCreatingTimetable(false);
    }
  }

  // ── Rename modal ──────────────────────────────────────────────────────────
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<TimetableMeta | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renaming, setRenaming] = useState(false);

  // ── Export configuration states ───────────────────────────────────────────
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportTarget, setExportTarget] = useState<TimetableMeta | null>(null);
  const [exportFormat, setExportFormat] = useState<'json' | 'xlsx'>('xlsx');
  const [excludeHiddenDays, setExcludeHiddenDays] = useState(true);
  const [excludeTimeWindow, setExcludeTimeWindow] = useState(true);
  const [viewStart, setViewStart] = useState<number>(7 * 60);
  const [viewEnd, setViewEnd] = useState<number>(21 * 60);
  const [exportFilterType, setExportFilterType] = useState<'all' | 'room'>('all');
  const [exportSelectedRoom, setExportSelectedRoom] = useState<string>('');
  const [exportExactMatch, setExportExactMatch] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<string[]>([]);

  function openRenameModal(t: TimetableMeta): void {
    setRenameTarget(t);
    setRenameName(t.name);
    setRenameModalOpen(true);
  }

  async function handleRename(): Promise<void> {
    if (!renameTarget) return;
    const trimmed = renameName.trim();
    if (!trimmed) return;
    setRenaming(true);
    try {
      await list.renameTimetable(renameTarget.id, trimmed);
      setRenameModalOpen(false);
    } catch (e: unknown) {
      messageApi.error(`Failed to rename: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRenaming(false);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    try {
      await list.deleteTimetable(id);
      messageApi.success('Timetable deleted');
    } catch (e: unknown) {
      messageApi.error(`Failed to delete: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function startExport(t: TimetableMeta, format: 'json' | 'xlsx'): Promise<void> {
    setExportTarget(t);
    setExportFormat(format);
    setExcludeHiddenDays(true);
    setExcludeTimeWindow(true);
    setViewStart(7 * 60);
    setViewEnd(21 * 60);
    setExportFilterType('all');
    setExportSelectedRoom('');
    setExportExactMatch(false);
    setAvailableRooms([]);

    try {
      const db = await Database.load('sqlite:timetable.db');
      const rows = await db.select<{ entries_json: string }[]>(
        'SELECT entries_json FROM timetables WHERE id = $1', [t.id],
      );
      const entries: SubjectEntry[] = JSON.parse(rows[0]?.entries_json ?? '[]');
      const roomsSet = new Set<string>();
      for (const entry of entries) {
        if (entry.room) {
          entry.room.split(',').forEach((r) => {
            const trimmed = r.trim();
            if (trimmed) roomsSet.add(trimmed);
          });
        }
      }
      setAvailableRooms(Array.from(roomsSet).sort());
    } catch { /* ignore */ }

    setExportModalOpen(true);
  }

  async function executeExport(): Promise<void> {
    if (!exportTarget) return;
    setExportModalOpen(false);
    try {
      const db = await Database.load('sqlite:timetable.db');
      const rows = await db.select<{ entries_json: string; theme?: string }[]>(
        'SELECT entries_json, theme FROM timetables WHERE id = $1', [exportTarget.id],
      );
      const entries: SubjectEntry[] = JSON.parse(rows[0]?.entries_json ?? '[]');
      const exportTheme: string = rows[0]?.theme || 'blue';

      let entriesToProcess = entries;
      if (exportFilterType === 'room' && exportSelectedRoom) {
        const targetRoom = exportSelectedRoom.trim().toLowerCase();
        entriesToProcess = entries.filter((e) => {
          if (!e.room) return false;
          const entryRoom = e.room.trim().toLowerCase();
          if (exportExactMatch) return entryRoom === targetRoom;
          return entryRoom.includes(targetRoom);
        });
      }

      if (exportFormat === 'json') {
        const entriesToExport = filterEntriesForExport(
          entriesToProcess, exportTarget.hiddenDays,
          excludeHiddenDays, viewStart, viewEnd, excludeTimeWindow,
        );
        const blob = new Blob([JSON.stringify(entriesToExport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${exportTarget.name}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        await exportToXlsx(
          entriesToProcess, `${exportTarget.name}.xlsx`,
          exportTarget.hiddenDays, excludeHiddenDays, viewStart, viewEnd, excludeTimeWindow,
          undefined, exportTheme,
        );
      }
    } catch (e: unknown) {
      messageApi.error(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function formatDate(iso: string): string {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return iso;
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function formatTimeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return formatDate(iso);
  }

  const exportItems = (t: TimetableMeta) => [
    { key: 'xlsx', label: 'Export as Excel (.xlsx)', icon: <FileExcelOutlined />, onClick: () => startExport(t, 'xlsx') },
    { key: 'json', label: 'Export as JSON', icon: <FileTextOutlined />, onClick: () => startExport(t, 'json') },
  ];

  const showTimetableGrid = collection.isCollectionOpen && list.timetables.length > 0;
  const showEmptyTimetables = collection.isCollectionOpen && list.timetables.length === 0 && !list.isLoading;

  return (
    <Layout style={{ minHeight: '100%', background: 'linear-gradient(135deg, #0f1f3d 0%, #1a3260 50%, #0f1f3d 100%)' }}>
      {contextHolder}

      <Content style={{ padding: '24px 28px 16px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          {/* ── Collection Header ──────────────────────────────────────── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <Title level={3} style={{ color: '#FFFFFF', margin: '0 0 4px', fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px' }}>
                  {collection.isCollectionOpen ? collection.collectionName : 'Timetable Collections'}
                </Title>
                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
                  {collection.isCollectionOpen
                    ? `Collection: ${collection.collectionPath?.split(/[/\\]/).pop()}`
                    : 'Create or open a collection to get started.'}
                </Text>
              </div>
              {collection.isCollectionOpen && (
                <Button
                  icon={<CloseOutlined />}
                  size="small"
                  onClick={handleCloseCollection}
                  style={{ color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.2)' }}
                >
                  Close Collection
                </Button>
              )}
            </div>

            {/* ── Action Buttons ─────────────────────────────────────── */}
            <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {!collection.isCollectionOpen && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  size="middle"
                  onClick={() => { setCreateCollectionName(''); setCreateCollectionModalOpen(true); }}
                  style={{
                    background: 'linear-gradient(135deg, #3B82F6, #1E3560)',
                    border: 'none', height: 34, paddingInline: 18,
                    fontWeight: 600, fontSize: 13,
                    boxShadow: '0 3px 10px rgba(59,130,246,0.4)',
                  }}
                >
                  Create Collection
                </Button>
              )}
              <Button
                icon={<FolderOpenOutlined />}
                size="middle"
                onClick={handleOpenCollection}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  color: '#FFFFFF', height: 34, paddingInline: 18,
                  fontWeight: 600, fontSize: 13,
                }}
              >
                Open Collection
              </Button>
              {collection.isCollectionOpen && (
                <Button
                  icon={<FileAddOutlined />}
                  size="middle"
                  onClick={() => { setNewTimetableName(''); setNewTimetableModalOpen(true); }}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    color: '#FFFFFF', height: 34, paddingInline: 18,
                    fontWeight: 600, fontSize: 13,
                  }}
                >
                  New Timetable
                </Button>
              )}
            </div>
          </div>

          {/* ── Recent Collections ──────────────────────────────────────── */}
          {collection.recentCollections.length > 0 && (
            <>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 12 }}>
                Recent Collections
              </Text>
              <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
                {collection.recentCollections.map((r) => (
                  <Col key={r.path} xs={24} sm={12} lg={8}>
                    <Card
                      hoverable
                      className="timetable-card"
                      onClick={() => void handleOpenRecent(r.path)}
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 12, cursor: 'pointer',
                      }}
                      styles={{ body: { padding: '12px 16px' } }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: 8,
                          background: 'linear-gradient(135deg, #3B82F6, #1E3560)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <CalendarOutlined style={{ fontSize: 14, color: '#FFF' }} />
                        </div>
                      </div>
                      <Title level={5} style={{ color: '#FFFFFF', margin: '0 0 3px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.name}>
                        {r.name}
                      </Title>
                      <div style={{ marginBottom: 4 }}>
                        <Tag color="blue" style={{ fontSize: 11, borderRadius: 6 }}>
                          {r.timetableCount} timetable{r.timetableCount !== 1 ? 's' : ''}
                        </Tag>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ClockCircleOutlined style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }} />
                        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                          {formatTimeAgo(r.lastOpened)}
                        </Text>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            </>
          )}

          {/* ── Timetable Grid (within current collection) ───────────── */}
          {list.isLoading ? (
            <div style={{ textAlign: 'center', paddingTop: 40 }}>
              <Spin size="large" />
            </div>
          ) : showTimetableGrid ? (
            <>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 16 }}>
                Timetables
              </Text>
              <Row gutter={[12, 12]}>
                {list.timetables.map((t) => (
                  <Col key={t.id} xs={24} sm={12} lg={8}>
                    <Card
                      hoverable
                      className="timetable-card"
                      onClick={() => onOpen(t)}
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 12, cursor: 'pointer',
                      }}
                      styles={{ body: { padding: '12px 16px' } }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: 8,
                          background: 'linear-gradient(135deg, #3B82F6, #1E3560)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <CalendarOutlined style={{ fontSize: 14, color: '#FFF' }} />
                        </div>
                        <Space size={4} onClick={(e) => e.stopPropagation()}>
                          <Button type="text" icon={<EditOutlined />} size="small" title="Rename"
                            className="action-btn-hover" style={{ color: 'rgba(255,255,255,0.45)' }}
                            onClick={() => openRenameModal(t)} />
                          <Dropdown menu={{ items: exportItems(t) }} trigger={['click']}>
                            <Button type="text" icon={<DownloadOutlined />} size="small" title="Export"
                              className="action-btn-hover" disabled={t.entryCount === 0}
                              style={{ color: 'rgba(255,255,255,0.45)' }} />
                          </Dropdown>
                          <Popconfirm title="Delete this timetable?" description="This action cannot be undone."
                            onConfirm={() => handleDelete(t.id)} okText="Delete" okButtonProps={{ danger: true }}>
                            <Button type="text" icon={<DeleteOutlined />} size="small" danger title="Delete"
                              className="action-btn-hover" style={{ color: 'rgba(255,100,100,0.6)' }} />
                          </Popconfirm>
                        </Space>
                      </div>
                      <Title level={5} style={{ color: '#FFFFFF', margin: '0 0 3px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={t.name}>
                        {t.name}
                      </Title>
                      <div style={{ marginBottom: 8 }}>
                        <Tag color={t.entryCount > 0 ? 'blue' : 'default'} style={{ fontSize: 11, borderRadius: 6 }}>
                          {t.entryCount} subject{t.entryCount !== 1 ? 's' : ''}
                        </Tag>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ClockCircleOutlined style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }} />
                        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                          Updated {formatDate(t.updatedAt)}
                        </Text>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            </>
          ) : showEmptyTimetables ? (
            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.15)',
              borderRadius: 12, padding: '40px 24px', textAlign: 'center',
            }}>
              <Empty
                description={<Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>No timetables in this collection yet.</Text>}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
              <Button
                type="primary" icon={<PlusOutlined />}
                onClick={() => { setNewTimetableName(''); setNewTimetableModalOpen(true); }}
                style={{ marginTop: 12 }}
              >
                New Timetable
              </Button>
            </div>
          ) : !collection.isCollectionOpen && (
            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.15)',
              borderRadius: 12, padding: '60px 24px', textAlign: 'center',
            }}>
              <Empty
                description={<Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
                  Open a collection or create a new one to get started.
                </Text>}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </div>
          )}
        </div>
      </Content>

      {/* ── Create Collection Modal ───────────────────────────────────── */}
      <Modal
        title="Create Collection"
        open={createCollectionModalOpen}
        onOk={handleCreateCollection}
        onCancel={() => setCreateCollectionModalOpen(false)}
        confirmLoading={creatingCollection}
        okText="Create"
        okButtonProps={{ disabled: !createCollectionName.trim() }}
        destroyOnHidden
      >
        <div style={{ paddingTop: 8 }}>
          <Text style={{ display: 'block', marginBottom: 8, color: '#555' }}>
            Give your collection a name (e.g. "Semester 1 – 2025")
          </Text>
          <Input
            placeholder="Collection name"
            value={createCollectionName}
            onChange={(e) => setCreateCollectionName(e.target.value)}
            onPressEnter={handleCreateCollection}
            maxLength={80}
            autoFocus
          />
        </div>
      </Modal>

      {/* ── New Timetable Modal ──────────────────────────────────────────── */}
      <Modal
        title="New Timetable"
        open={newTimetableModalOpen}
        onOk={handleCreateTimetable}
        onCancel={() => setNewTimetableModalOpen(false)}
        confirmLoading={creatingTimetable}
        okText="Create"
        okButtonProps={{ disabled: !newTimetableName.trim() }}
        destroyOnHidden
      >
        <div style={{ paddingTop: 8 }}>
          <Text style={{ display: 'block', marginBottom: 8, color: '#555' }}>
            Give your timetable a name (e.g. "BSCS 1A Schedule")
          </Text>
          <Input
            placeholder="Timetable name"
            value={newTimetableName}
            onChange={(e) => setNewTimetableName(e.target.value)}
            onPressEnter={handleCreateTimetable}
            maxLength={80}
            autoFocus
          />
        </div>
      </Modal>

      {/* ── Rename Modal ─────────────────────────────────────────────────── */}
      <Modal
        title="Rename Timetable"
        open={renameModalOpen}
        onOk={handleRename}
        onCancel={() => setRenameModalOpen(false)}
        confirmLoading={renaming}
        okText="Save"
        okButtonProps={{ disabled: !renameName.trim() }}
        destroyOnHidden
      >
        <div style={{ paddingTop: 8 }}>
          <Input
            placeholder="New name"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onPressEnter={handleRename}
            maxLength={80}
            autoFocus
          />
        </div>
      </Modal>

      {/* ── Export Options Modal ─────────────────────────────────────────── */}
      <Modal
        title="Export Timetable Options"
        open={exportModalOpen}
        onOk={executeExport}
        onCancel={() => setExportModalOpen(false)}
        okText="Export"
        destroyOnClose
      >
        <div style={{ paddingBlock: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Text style={{ display: 'block', margin: 0, color: '#333' }}>
            Choose settings for exporting <strong>{exportTarget?.name}</strong> ({exportFormat === 'json' ? 'JSON' : 'Excel .xlsx'}).
          </Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <Checkbox checked={excludeHiddenDays} onChange={(e) => setExcludeHiddenDays(e.target.checked)}>
                Exclude hidden days from the exported file
              </Checkbox>
              {exportTarget && exportTarget.hiddenDays && exportTarget.hiddenDays.length > 0 ? (
                <Text type="secondary" style={{ display: 'block', fontSize: 11, paddingLeft: 24, marginTop: 4 }}>
                  Currently hidden days: {exportTarget.hiddenDays.join(', ')}
                </Text>
              ) : (
                <Text type="secondary" style={{ display: 'block', fontSize: 11, paddingLeft: 24, marginTop: 4, fontStyle: 'italic' }}>
                  No days are currently hidden in this timetable.
                </Text>
              )}
            </div>
            <div>
              <Checkbox checked={excludeTimeWindow} onChange={(e) => setExcludeTimeWindow(e.target.checked)}>
                Exclude time outside the time window
              </Checkbox>
              <div style={{ paddingLeft: 24, marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 12 }}>Time Window:</Text>
                <Select size="small" style={{ width: 80 }} value={viewStart}
                  onChange={(val) => { setViewStart(val); if (val >= viewEnd) setViewEnd(Math.min(val + 30, 24 * 60)); }}
                  options={TIME_OPTIONS.slice(0, -1)} />
                <Text style={{ fontSize: 12 }}>to</Text>
                <Select size="small" style={{ width: 80 }} value={viewEnd}
                  onChange={(val) => { setViewEnd(val); if (val <= viewStart) setViewStart(Math.max(0, val - 30)); }}
                  options={TIME_OPTIONS.filter((opt) => opt.value > viewStart)} />
              </div>
            </div>
            <div style={{ borderTop: '1px solid #F0F0F0', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, width: 100 }}>Filter Option:</span>
                <Select size="small" value={exportFilterType} onChange={(val) => setExportFilterType(val)}
                  style={{ width: 180 }}
                  options={[{ label: 'All Schedules', value: 'all' }, { label: 'Filter by Room', value: 'room' }]} />
              </div>
              {exportFilterType === 'room' && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, width: 100 }}>Room:</span>
                    <AutoComplete size="small" value={exportSelectedRoom}
                      onChange={(val) => setExportSelectedRoom(val)} style={{ width: 180 }}
                      placeholder="Select or type room"
                      options={availableRooms.map((r) => ({ value: r }))}
                      filterOption={(input, option) => (option?.value ?? '').toLowerCase().includes(input.toLowerCase())} />
                  </div>
                  <div style={{ paddingLeft: 108 }}>
                    <Checkbox checked={exportExactMatch} onChange={(e) => setExportExactMatch(e.target.checked)}>
                      Exact Match
                    </Checkbox>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
