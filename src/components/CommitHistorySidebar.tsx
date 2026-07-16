import { useMemo, useState } from 'react';
import { Typography, Input, Select, Empty, Tag } from 'antd';
import {
  PlusCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  UndoOutlined,
  SwapOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { CommitRecord } from '../types';

const { Text } = Typography;

interface CommitHistorySidebarProps {
  commits: CommitRecord[];
  myAuthorId?: string;
  isLoading?: boolean;
  noBorder?: boolean;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return new Date(ts).toLocaleDateString();
}

function getDateGroupKey(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function actionIcon(type: string, isUndo: boolean) {
  if (isUndo) return <UndoOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />;
  switch (type) {
    case 'addBlueprint':
    case 'addInstance':
    case 'addInstances':
    case 'addBlueprints':
    case 'addBlueprintsAndInstances':
    case 'addDynamicData':
    case 'addLinksBatched':
      return <PlusCircleOutlined style={{ color: '#52c41a', fontSize: 12 }} />;
    case 'updateInstance':
    case 'updateDynamicData':
    case 'updateTheme':
    case 'updateBandedRows':
    case 'setHiddenDays':
      return <EditOutlined style={{ color: '#1890ff', fontSize: 12 }} />;
    case 'deleteBlueprint':
    case 'deleteBlueprints':
    case 'deleteInstance':
    case 'deleteDynamicData':
      return <DeleteOutlined style={{ color: '#ff4d4f', fontSize: 12 }} />;
    case 'mergeEntries':
    case 'mergeBlueprints':
      return <SwapOutlined style={{ color: '#722ed1', fontSize: 12 }} />;
    default:
      return <EyeOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />;
  }
}

export function CommitHistorySidebar({ commits, isLoading }: CommitHistorySidebarProps) {
  const [search, setSearch] = useState('');
  const [authorFilter, setAuthorFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const authors = useMemo(() => {
    const set = new Set(commits.map((c) => c.author));
    return Array.from(set).sort();
  }, [commits]);

  const actionTypes = useMemo(() => {
    const set = new Set(commits.map((c) => c.actionType));
    return Array.from(set).sort();
  }, [commits]);

  const filtered = useMemo(() => {
    let result = commits;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) => c.description.toLowerCase().includes(q) || c.author.toLowerCase().includes(q));
    }
    if (authorFilter) {
      result = result.filter((c) => c.author === authorFilter);
    }
    if (typeFilter) {
      result = result.filter((c) => c.actionType === typeFilter);
    }
    return result;
  }, [commits, search, authorFilter, typeFilter]);

  const grouped = useMemo(() => {
    const groups: Record<string, CommitRecord[]> = {};
    for (const commit of filtered) {
      const key = getDateGroupKey(commit.timestamp);
      if (!groups[key]) groups[key] = [];
      groups[key].push(commit);
    }
    return groups;
  }, [filtered]);

  return (
    <div style={{ width: '100%', height: '100%', background: '#FFFFFF', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #f0f0f0' }}>
        <Text strong style={{ fontSize: 13, color: '#1A2640' }}>Commit History</Text>
        <Text style={{ fontSize: 11, color: '#8c8c8c', marginLeft: 6 }}>{commits.length}</Text>
      </div>

      {/* Filters */}
      <div style={{ padding: '6px 8px', borderBottom: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Input
          size="small"
          placeholder="Search commits..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ fontSize: 11 }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          <Select
            size="small"
            placeholder="Author"
            value={authorFilter}
            onChange={setAuthorFilter}
            allowClear
            style={{ flex: 1, fontSize: 11 }}
            options={authors.map((a) => ({ label: a, value: a }))}
          />
          <Select
            size="small"
            placeholder="Type"
            value={typeFilter}
            onChange={setTypeFilter}
            allowClear
            style={{ flex: 1, fontSize: 11 }}
            options={actionTypes.map((t) => ({ label: t, value: t }))}
          />
        </div>
      </div>

      {/* Commit list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '32px 12px' }}>
            <Empty description={isLoading ? 'Loading...' : 'No commits yet'} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        ) : (
          Object.entries(grouped).map(([dateGroup, groupCommits]) => (
            <div key={dateGroup}>
              <div style={{ padding: '6px 12px 3px', fontSize: 10, fontWeight: 600, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {dateGroup}
              </div>
              {groupCommits.map((commit) => (
                <div key={commit.id}>
                  <div
                    onClick={() => setExpandedId(expandedId === commit.id ? null : commit.id)}
                    style={{
                      padding: '5px 12px',
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                      opacity: commit.isUndo ? 0.6 : 1,
                      textDecoration: commit.isUndo ? 'line-through' : 'none',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <div style={{ marginTop: 2, flexShrink: 0 }}>
                        {actionIcon(commit.actionType, commit.isUndo)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, lineHeight: 1.3, color: commit.isUndo ? '#8c8c8c' : '#262626', wordBreak: 'break-word' }}>
                          {commit.description}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <Tag style={{ fontSize: 9, lineHeight: '14px', padding: '0 4px', margin: 0 }}>{commit.author}</Tag>
                          <Text style={{ fontSize: 10, color: '#8c8c8c' }}>{formatRelativeTime(commit.timestamp)}</Text>
                          {commit.isUndo && (
                            <Text style={{ fontSize: 10, color: '#8c8c8c', fontStyle: 'italic' }}>undone</Text>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  {expandedId === commit.id && (
                    <div style={{ padding: '2px 12px 6px 30px' }}>
                      <pre style={{ fontSize: 9, color: '#595959', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#fafafa', padding: '4px 6px', borderRadius: 3 }}>
                        {JSON.stringify(JSON.parse(commit.actionJson || '{}'), null, 1)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
