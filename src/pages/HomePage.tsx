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
} from '@ant-design/icons';
import Database from '@tauri-apps/plugin-sql';
import { useTimetableList } from '../hooks/useTimetableList';
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

/** Helper to filter out schedules on hidden days and/or outside the visible time window */
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
          // Filter out hidden days if requested
          const days = excludeHiddenDays
            ? sched.days.filter((d) => !hiddenDays.includes(d))
            : sched.days;

          if (days.length === 0) return null;

          const s = toMin(sched.startTime);
          const e = toMin(sched.endTime);

          // Filter out if no overlap with time window
          if (excludeTimeWindow && (s >= viewEnd || e <= viewStart)) {
            return null;
          }

          // Clamp times to window if excludeTimeWindow is true
          const clampedStart = excludeTimeWindow ? Math.max(s, viewStart) : s;
          const clampedEnd = excludeTimeWindow ? Math.min(e, viewEnd) : e;

          return {
            ...sched,
            days,
            startTime: toTime(clampedStart),
            endTime: toTime(clampedEnd),
          };
        })
        .filter((s): s is Exclude<typeof s, null> => s !== null);

      return {
        ...entry,
        schedules,
      };
    })
    .filter((entry) => entry.schedules.length > 0);
}

interface HomePageProps {
  /** Called when the user opens a timetable for editing */
  onOpen: (timetable: TimetableMeta) => void;
}

/**
 * Home page showing New/Open Timetable CTAs and a recent timetables grid.
 */
export function HomePage({ onOpen }: HomePageProps) {
  const list = useTimetableList();
  const [messageApi, contextHolder] = message.useMessage();

  // ── New Timetable modal ────────────────────────────────────────────────────
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleCreate(): Promise<void> {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const meta = await list.createTimetable(trimmed);
      setNewModalOpen(false);
      setNewName('');
      onOpen(meta);
    } catch (e: unknown) {
      messageApi.error(`Failed to create timetable: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCreating(false);
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
  const [excludeHiddenDays, setExcludeHiddenDays] = useState(true); // default to true
  const [excludeTimeWindow, setExcludeTimeWindow] = useState(true); // default to true
  const [viewStart, setViewStart] = useState<number>(7 * 60); // 420 min (7:00)
  const [viewEnd, setViewEnd] = useState<number>(21 * 60); // 1260 min (9:00)
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

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete(id: string): Promise<void> {
    try {
      await list.deleteTimetable(id);
      messageApi.success('Timetable deleted');
    } catch (e: unknown) {
      messageApi.error(`Failed to delete: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── Export from home page ──────────────────────────────────────────────────
  async function startExport(t: TimetableMeta, format: 'json' | 'xlsx'): Promise<void> {
    setExportTarget(t);
    setExportFormat(format);
    setExcludeHiddenDays(true); // Checked by default
    setExcludeTimeWindow(true); // Checked by default
    setViewStart(7 * 60);
    setViewEnd(21 * 60);
    setExportFilterType('all');
    setExportSelectedRoom('');
    setExportExactMatch(false);
    setAvailableRooms([]);

    try {
      const db = await Database.load('sqlite:timetable.db');
      const rows = await db.select<{ entries_json: string }[]>(
        'SELECT entries_json FROM timetables WHERE id = $1',
        [t.id],
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
    } catch (e) {
      console.error('Failed to pre-load rooms for export filtering:', e);
    }

    setExportModalOpen(true);
  }

  async function executeExport(): Promise<void> {
    if (!exportTarget) return;
    setExportModalOpen(false);
    try {
      const db = await Database.load('sqlite:timetable.db');
      const rows = await db.select<{ entries_json: string }[]>(
        'SELECT entries_json FROM timetables WHERE id = $1',
        [exportTarget.id],
      );
      const entries: SubjectEntry[] = JSON.parse(rows[0]?.entries_json ?? '[]');

      // Apply the room filter if selected
      let entriesToProcess = entries;
      if (exportFilterType === 'room' && exportSelectedRoom) {
        const targetRoom = exportSelectedRoom.trim().toLowerCase();
        entriesToProcess = entries.filter((e) => {
          if (!e.room) return false;
          const entryRoom = e.room.trim().toLowerCase();
          if (exportExactMatch) {
            return entryRoom === targetRoom;
          } else {
            return entryRoom.includes(targetRoom);
          }
        });
      }

      if (exportFormat === 'json') {
        const entriesToExport = filterEntriesForExport(
          entriesToProcess,
          exportTarget.hiddenDays,
          excludeHiddenDays,
          viewStart,
          viewEnd,
          excludeTimeWindow,
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
          entriesToProcess,
          `${exportTarget.name}.xlsx`,
          exportTarget.hiddenDays,
          excludeHiddenDays,
          viewStart,
          viewEnd,
          excludeTimeWindow,
        );
      }
    } catch (e: unknown) {
      messageApi.error(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /** Formats an ISO timestamp to a human-readable relative string. */
  function formatDate(iso: string): string {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return iso;
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  const exportItems = (t: TimetableMeta) => [
    {
      key: 'xlsx',
      label: 'Export as Excel (.xlsx)',
      icon: <FileExcelOutlined />,
      onClick: () => startExport(t, 'xlsx'),
    },
    {
      key: 'json',
      label: 'Export as JSON',
      icon: <FileTextOutlined />,
      onClick: () => startExport(t, 'json'),
    },
  ];

  return (
    <Layout style={{ minHeight: '100%', background: 'linear-gradient(135deg, #0f1f3d 0%, #1a3260 50%, #0f1f3d 100%)' }}>
      {contextHolder}

      {/* ── Hero CTAs ───────────────────────────────────────────────────────── */}
      <Content style={{ padding: '24px 28px 16px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>

          {/* Title + action buttons */}
          <div style={{ marginBottom: 20 }}>
            <Title
              level={3}
              style={{
                color: '#FFFFFF',
                margin: '0 0 4px',
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: '-0.3px',
              }}
            >
              Your Timetables
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
              Manage your weekly schedules. All data is stored locally.
            </Text>

            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                size="middle"
                onClick={() => { setNewName(''); setNewModalOpen(true); }}
                style={{
                  background: 'linear-gradient(135deg, #3B82F6, #1E3560)',
                  border: 'none',
                  height: 34,
                  paddingInline: 18,
                  fontWeight: 600,
                  fontSize: 13,
                  boxShadow: '0 3px 10px rgba(59,130,246,0.4)',
                }}
              >
                New Timetable
              </Button>

              <Button
                icon={<FolderOpenOutlined />}
                size="middle"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.json';
                  input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (!file) return;
                    
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                      try {
                        const content = event.target?.result as string;
                        const parsed = JSON.parse(content);
                        if (!Array.isArray(parsed)) {
                          throw new Error('JSON root must be an array of timetable entries.');
                        }
                        
                        // Validate structural elements
                        for (const item of parsed) {
                          if (
                            typeof item !== 'object' ||
                            item === null ||
                            !item.id ||
                            !item.subjectCode ||
                            !Array.isArray(item.schedules)
                          ) {
                            throw new Error('Invalid structure. Entries must contain id, subjectCode, and schedules.');
                          }
                        }

                        // Create a new timetable name based on filename or import label
                        const baseName = file.name.replace(/\.json$/i, '');
                        const importedName = `Imported: ${baseName}`;
                        
                        // Create the timetable row first
                        const meta = await list.createTimetable(importedName);

                        // Save the entries into the new timetable
                        const db = await Database.load('sqlite:timetable.db');
                        const now = new Date().toISOString();
                        await db.execute(
                          'UPDATE timetables SET entries_json = $1, entry_count = $2, updated_at = $3 WHERE id = $4',
                          [JSON.stringify(parsed), parsed.length, now, meta.id],
                        );

                        // Navigate to it
                        onOpen({
                          ...meta,
                          entryCount: parsed.length,
                          updatedAt: now,
                        });
                        messageApi.success('Timetable imported successfully.');
                      } catch (err: unknown) {
                        messageApi.error(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
                      }
                    };
                    reader.readAsText(file);
                  };
                  input.click();
                }}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  color: '#FFFFFF',
                  height: 34,
                  paddingInline: 18,
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Import JSON
              </Button>
            </div>
          </div>

          {/* ── Recent Timetables Grid ─────────────────────────────────────── */}
          {list.isLoading ? (
            <div style={{ textAlign: 'center', paddingTop: 60 }}>
              <Spin size="large" />
            </div>
          ) : list.timetables.length === 0 ? (
            <div
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px dashed rgba(255,255,255,0.15)',
                borderRadius: 12,
                padding: '60px 24px',
                textAlign: 'center',
              }}
            >
              <Empty
                description={
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
                    No timetables yet. Create your first one above.
                  </Text>
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </div>
          ) : (
            <>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 16 }}>
                Recent
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
                        borderRadius: 12,
                        cursor: 'pointer',
                      }}
                      styles={{
                        body: { padding: '12px 16px' },
                      }}
                    >
                      {/* Card header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 8,
                            background: 'linear-gradient(135deg, #3B82F6, #1E3560)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <CalendarOutlined style={{ fontSize: 14, color: '#FFF' }} />
                        </div>

                        {/* Action buttons — stop propagation so card click doesn't fire */}
                        <Space size={4} onClick={(e) => e.stopPropagation()}>
                          <Button
                            type="text"
                            icon={<EditOutlined />}
                            size="small"
                            title="Rename"
                            className="action-btn-hover"
                            style={{ color: 'rgba(255,255,255,0.45)' }}
                            onClick={() => openRenameModal(t)}
                          />
                          <Dropdown menu={{ items: exportItems(t) }} trigger={['click']}>
                            <Button
                              type="text"
                              icon={<DownloadOutlined />}
                              size="small"
                              title="Export"
                              className="action-btn-hover"
                              disabled={t.entryCount === 0}
                              style={{ color: 'rgba(255,255,255,0.45)' }}
                            />
                          </Dropdown>
                          <Popconfirm
                            title="Delete this timetable?"
                            description="This action cannot be undone."
                            onConfirm={() => handleDelete(t.id)}
                            okText="Delete"
                            okButtonProps={{ danger: true }}
                          >
                            <Button
                              type="text"
                              icon={<DeleteOutlined />}
                              size="small"
                              danger
                              title="Delete"
                              className="action-btn-hover"
                              style={{ color: 'rgba(255,100,100,0.6)' }}
                            />
                          </Popconfirm>
                        </Space>
                      </div>

                      {/* Timetable name */}
                      <Title
                        level={5}
                        style={{
                          color: '#FFFFFF',
                          margin: '0 0 3px',
                          fontSize: 13,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={t.name}
                      >
                        {t.name}
                      </Title>

                      {/* Entry count tag */}
                      <div style={{ marginBottom: 8 }}>
                        <Tag
                          color={t.entryCount > 0 ? 'blue' : 'default'}
                          style={{ fontSize: 11, borderRadius: 6 }}
                        >
                          {t.entryCount} subject{t.entryCount !== 1 ? 's' : ''}
                        </Tag>
                      </div>

                      {/* Dates */}
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
          )}
        </div>
      </Content>

      {/* ── New Timetable Modal ──────────────────────────────────────────────── */}
      <Modal
        title="New Timetable"
        open={newModalOpen}
        onOk={handleCreate}
        onCancel={() => setNewModalOpen(false)}
        confirmLoading={creating}
        okText="Create"
        okButtonProps={{ disabled: !newName.trim() }}
        destroyOnHidden
      >
        <div style={{ paddingTop: 8 }}>
          <Text style={{ display: 'block', marginBottom: 8, color: '#555' }}>
            Give your timetable a name (e.g. "Semester 1 – 2025")
          </Text>
          <Input
            id="new-timetable-name"
            placeholder="Timetable name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onPressEnter={handleCreate}
            maxLength={80}
            autoFocus
          />
        </div>
      </Modal>

      {/* ── Rename Modal ─────────────────────────────────────────────────────── */}
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
            id="rename-timetable-name"
            placeholder="New name"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onPressEnter={handleRename}
            maxLength={80}
            autoFocus
          />
        </div>
      </Modal>

      {/* ── Export Options Modal ─────────────────────────────────────────────── */}
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
            {/* Exclude hidden days */}
            <div>
              <Checkbox
                checked={excludeHiddenDays}
                onChange={(e) => setExcludeHiddenDays(e.target.checked)}
              >
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

            {/* Exclude time outside window */}
            <div>
              <Checkbox
                checked={excludeTimeWindow}
                onChange={(e) => setExcludeTimeWindow(e.target.checked)}
              >
                Exclude time outside the time window
              </Checkbox>
              <div style={{ paddingLeft: 24, marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 12 }}>Time Window:</Text>
                <Select
                  size="small"
                  style={{ width: 80 }}
                  value={viewStart}
                  onChange={(val) => {
                    setViewStart(val);
                    if (val >= viewEnd) {
                      setViewEnd(Math.min(val + 30, 24 * 60));
                    }
                  }}
                  options={TIME_OPTIONS.slice(0, -1)}
                />
                <Text style={{ fontSize: 12 }}>to</Text>
                <Select
                  size="small"
                  style={{ width: 80 }}
                  value={viewEnd}
                  onChange={(val) => {
                    setViewEnd(val);
                    if (val <= viewStart) {
                      setViewStart(Math.max(0, val - 30));
                    }
                  }}
                  options={TIME_OPTIONS.filter((opt) => opt.value > viewStart)}
                />
              </div>
            </div>

            {/* Room Export Filter */}
            <div style={{ borderTop: '1px solid #F0F0F0', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, width: 100 }}>Filter Option:</span>
                <Select
                  size="small"
                  value={exportFilterType}
                  onChange={(val) => setExportFilterType(val)}
                  style={{ width: 180 }}
                  options={[
                    { label: 'All Schedules', value: 'all' },
                    { label: 'Filter by Room', value: 'room' },
                  ]}
                />
              </div>

              {exportFilterType === 'room' && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, width: 100 }}>Room:</span>
                    <AutoComplete
                      size="small"
                      value={exportSelectedRoom}
                      onChange={(val) => setExportSelectedRoom(val)}
                      style={{ width: 180 }}
                      placeholder="Select or type room"
                      options={availableRooms.map((r) => ({ value: r }))}
                      filterOption={(input, option) =>
                        (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                    />
                  </div>

                  <div style={{ paddingLeft: 108 }}>
                    <Checkbox
                      checked={exportExactMatch}
                      onChange={(e) => setExportExactMatch(e.target.checked)}
                    >
                      Exact Match
                    </Checkbox>
                    <div style={{ fontSize: 11, color: '#7A8BA8', marginTop: 4 }}>
                      When enabled, only schedules with this exact room will be exported.
                    </div>
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
