import { Tag, Button, Popconfirm, Empty, Input } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, EyeInvisibleOutlined, SortAscendingOutlined, SortDescendingOutlined } from '@ant-design/icons';
import { useRef, memo, useState, useMemo } from 'react';
import type { SubjectEntry } from '../types';
import { colorForSubject } from '../theme';

interface BlueprintListProps {
  blueprints: SubjectEntry[];
  onEdit: (entry: SubjectEntry) => void;
  onDelete: (id: string) => void;
  hiddenEntryIds: string[];
  onToggleHide: (id: string) => void;
  editingEntryId?: string | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchResults: SubjectEntry[] | null;
  onDragStartCustom?: (entryId: string, clientX: number, clientY: number) => void;
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query || !query.trim()) return <>{text}</>;
  const normalizedQuery = query.toLowerCase();
  const parts = text.split(new RegExp(`(${normalizedQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === normalizedQuery ? (
          <mark key={i} style={{ backgroundColor: '#FFE066', padding: '0 2px', borderRadius: 2 }}>{part}</mark>
        ) : (
          part
        )
      )}
    </>
  );
}

export const BlueprintList = memo(function BlueprintList({
  blueprints,
  onEdit,
  onDelete,
  hiddenEntryIds,
  onToggleHide,
  editingEntryId,
  searchQuery,
  onSearchChange,
  searchResults,
  onDragStartCustom,
}: BlueprintListProps) {
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [sortOrder, setSortOrder] = useState<'az' | 'za' | 'none'>('none');

  const processedEntries = useMemo(() => {
    let list = (searchQuery.trim() !== '' && searchResults !== null) ? searchResults : blueprints;

    if (sortOrder === 'az') {
      list = [...list].sort((a, b) => a.subjectCode.localeCompare(b.subjectCode));
    } else if (sortOrder === 'za') {
      list = [...list].sort((a, b) => b.subjectCode.localeCompare(a.subjectCode));
    }

    return list;
  }, [blueprints, searchResults, searchQuery, sortOrder]);

  const toggleSort = () => {
    setSortOrder((prev) => (prev === 'az' ? 'za' : prev === 'za' ? 'none' : 'az'));
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#FFFFFF',
      }}
    >
      <div style={{ padding: '12px 16px 4px 16px', fontWeight: 600, fontSize: '14px', color: '#1E293B' }}>
        Blueprint List
      </div>

      <div style={{ padding: '8px 12px', borderBottom: '1px solid #E4E9F0', display: 'flex', gap: 6, alignItems: 'center' }}>
        <Input
          placeholder="Search blueprints..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          size="small"
          allowClear
          style={{ flex: 1 }}
        />
        <Button
          size="small"
          onClick={toggleSort}
          icon={sortOrder === 'za' ? <SortDescendingOutlined /> : <SortAscendingOutlined />}
          type={sortOrder !== 'none' ? 'primary' : 'default'}
          title="Sort by Subject Code"
        >
          {sortOrder === 'none' ? 'Sort' : sortOrder === 'az' ? 'A-Z' : 'Z-A'}
        </Button>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 10,
          background: '#F8FAFC',
          overflowY: 'auto',
          flex: 1,
        }}
      >
        {processedEntries.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <Empty description="No blueprints found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        ) : (
          processedEntries.map((entry) => {
            const color = colorForSubject(entry.subjectCode, entry.color);
            const isHidden = hiddenEntryIds.includes(entry.id);
            const isEditing = editingEntryId === entry.id;

            return (
              <div
                id={`subject-card-${entry.id}`}
                key={entry.id}
                ref={(el) => { cardRefs.current[entry.id] = el; }}
                className="subject-card-item"
                tabIndex={0}
                onMouseDown={(e) => {
                  if (e.button !== 0) return;
                  const target = e.target as HTMLElement;
                  if (target.closest('.action-btn-hover') || target.closest('button')) {
                    return;
                  }
                  onDragStartCustom?.(entry.id, e.clientX, e.clientY);
                }}
                style={{
                  background: isHidden ? '#F1F5F9' : '#FFFFFF',
                  border: isEditing ? '2px solid #3B82F6' : '1px solid #D0D7E3',
                  borderRadius: 6,
                  padding: isEditing ? '9px 11px' : '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  position: 'relative',
                  boxShadow: isEditing
                    ? '0 0 0 3px rgba(59, 130, 246, 0.35), 0 4px 12px rgba(0, 0, 0, 0.1)'
                    : '0 1px 2px rgba(0,0,0,0.05)',
                  opacity: isHidden ? 0.6 : 1,
                  cursor: 'grab',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Tag
                      color={color}
                      style={{
                        fontWeight: 700,
                        letterSpacing: 0.3,
                        fontSize: 10,
                        margin: 0,
                        borderRadius: 4,
                      }}
                    >
                      <HighlightedText text={entry.subjectCode} query={searchQuery} />
                    </Tag>
                    <span style={{ fontSize: 11, color: '#7A8BA8', fontWeight: 600 }}>
                      <HighlightedText text={entry.offerCode} query={searchQuery} />
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                    <Button
                      type="text"
                      size="small"
                      icon={isHidden ? <EyeInvisibleOutlined style={{ fontSize: 13 }} /> : <EyeOutlined style={{ fontSize: 13 }} />}
                      className="action-btn-hover"
                      onClick={() => onToggleHide(entry.id)}
                      style={{ color: isHidden ? '#8c8c8c' : '#2B4C7E', width: 24, height: 24, padding: 0 }}
                    />
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined style={{ fontSize: 13 }} />}
                      className="action-btn-hover"
                      onClick={() => onEdit(entry)}
                      style={{ color: '#2B4C7E', width: 24, height: 24, padding: 0 }}
                    />
                    <Popconfirm
                      title="Delete this blueprint?"
                      okText="Delete"
                      okButtonProps={{ danger: true, size: 'small' }}
                      cancelButtonProps={{ size: 'small' }}
                      onConfirm={() => onDelete(entry.id)}
                    >
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined style={{ fontSize: 13 }} />}
                        className="action-btn-hover"
                        style={{ color: '#9B2335', width: 24, height: 24, padding: 0 }}
                      />
                    </Popconfirm>
                  </div>
                </div>

                <div style={{ fontSize: 12, fontWeight: 600, color: '#1E3560', lineHeight: 1.25 }}>
                  <HighlightedText text={entry.subjectDescription} query={searchQuery} />
                </div>

                {entry.department && (
                  <div style={{ fontSize: 11, color: '#4A5B78' }}>
                    <span style={{ color: '#7A8BA8', marginRight: 4 }}>Dept:</span>
                    <span style={{ fontWeight: 500 }}>
                      <HighlightedText text={entry.department} query={searchQuery} />
                    </span>
                  </div>
                )}

                <div style={{ fontSize: 10, color: '#7A8BA8', display: 'flex', gap: 8 }}>
                  <span>Prog: <HighlightedText text={entry.program} query={searchQuery} /></span>
                  <span>Yr: <HighlightedText text={String(entry.year)} query={searchQuery} /></span>
                  <span>Sec: <HighlightedText text={entry.section} query={searchQuery} /></span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});
