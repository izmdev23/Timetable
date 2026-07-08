import { Tag, Button, Popconfirm, Empty, Input, Radio, Tooltip } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, EyeInvisibleOutlined, SortAscendingOutlined, SortDescendingOutlined, TableOutlined } from '@ant-design/icons';
import { useRef, memo, useState, useMemo } from 'react';
import type { SubjectEntry } from '../types';
import { colorForSubject } from '../theme';
import { formatTeacherForDisplay } from '../utils/teacherName';

interface SubjectTableProps {
  entries: SubjectEntry[];
  onEdit: (entry: SubjectEntry) => void;
  onDelete: (id: string) => void;
  hiddenEntryIds: string[];
  onToggleHide: (id: string) => void;
  editingEntryId?: string | null;

  // Search & Drag-and-drop & Tab/Sort additions
  assignedEntryIds: Set<string>;
  currentEntryIds: Set<string>;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchResults: SubjectEntry[] | null;
}

// Subcomponent to highlight matching text
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

export const SubjectTable = memo(function SubjectTable({
  entries,
  onEdit,
  onDelete,
  hiddenEntryIds,
  onToggleHide,
  editingEntryId,
  assignedEntryIds,
  currentEntryIds,
  searchQuery,
  onSearchChange,
  searchResults,
}: SubjectTableProps) {
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [activeTab, setActiveTab] = useState<'all' | 'unassigned' | 'assigned' | 'current'>('all');
  const [sortOrder, setSortOrder] = useState<'az' | 'za' | 'none'>('none');

  // Let's filter entries based on search & active tab & sorting
  const processedEntries = useMemo(() => {
    // 1. Search filter (if search results are active, use them)
    let list = searchResults !== null ? searchResults : entries;

    // 2. Tab filter
    if (activeTab === 'unassigned') {
      list = list.filter((e) => !assignedEntryIds.has(e.id));
    } else if (activeTab === 'assigned') {
      list = list.filter((e) => assignedEntryIds.has(e.id));
    } else if (activeTab === 'current') {
      list = list.filter((e) => currentEntryIds.has(e.id));
    }

    // 3. Sorting (by Subject Code)
    if (sortOrder === 'az') {
      list = [...list].sort((a, b) => a.subjectCode.localeCompare(b.subjectCode));
    } else if (sortOrder === 'za') {
      list = [...list].sort((a, b) => b.subjectCode.localeCompare(a.subjectCode));
    }

    return list;
  }, [entries, searchResults, activeTab, assignedEntryIds, currentEntryIds, sortOrder]);

  const handleDragStart = (e: React.DragEvent, entryId: string) => {
    e.dataTransfer.setData('text/plain', entryId);
    e.dataTransfer.effectAllowed = 'move';
  };

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
      {/* Search and Sort controls */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #E4E9F0', display: 'flex', gap: 6, alignItems: 'center' }}>
        <Input
          placeholder="Search subjects..."
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

      {/* Tabs */}
      <div style={{ padding: '4px 12px', borderBottom: '1px solid #E4E9F0', background: '#F8FAFC', display: 'flex', gap: 6, alignItems: 'center' }}>
        <Radio.Group
          value={activeTab === 'current' ? 'all' : activeTab}
          onChange={(e) => setActiveTab(e.target.value as any)}
          size="small"
          buttonStyle="solid"
          style={{ flex: 1, display: 'flex' }}
        >
          <Radio.Button value="all" style={{ flex: 1, textAlign: 'center', fontSize: 11 }}>All</Radio.Button>
          <Radio.Button value="unassigned" style={{ flex: 1, textAlign: 'center', fontSize: 11 }}>Unassigned</Radio.Button>
          <Radio.Button value="assigned" style={{ flex: 1, textAlign: 'center', fontSize: 11 }}>Assigned</Radio.Button>
        </Radio.Group>
        <Tooltip title="Show Current (entries placed in the active timetable view)">
          <Button
            size="small"
            type={activeTab === 'current' ? 'primary' : 'default'}
            icon={<TableOutlined />}
            onClick={() => setActiveTab(activeTab === 'current' ? 'all' : 'current')}
          />
        </Tooltip>
      </div>

      {/* List content */}
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
            <Empty description="No entries found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
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
                draggable={true}
                onDragStart={(e) => handleDragStart(e, entry.id)}
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
                }}
              >
                {/* Top row: Subject Code, Offer Code, Actions */}
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

                  {/* Actions (Always clickable/enabled) */}
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
                      title="Delete this entry?"
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

                {/* Description */}
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1E3560', lineHeight: 1.25 }}>
                  <HighlightedText text={entry.subjectDescription} query={searchQuery} />
                </div>

                {/* Teacher & Department */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#4A5B78' }}>
                  <div>
                    <span style={{ color: '#7A8BA8', marginRight: 4 }}>Teacher:</span>
                    <span style={{ fontWeight: 500 }}>
                      <HighlightedText text={formatTeacherForDisplay(entry.assignedTeacherName)} query={searchQuery} />
                    </span>
                  </div>
                  {entry.department && (
                    <div>
                      <span style={{ color: '#7A8BA8', marginRight: 4 }}>Dept:</span>
                      <span style={{ fontWeight: 500 }}>
                        <HighlightedText text={entry.department} query={searchQuery} />
                      </span>
                    </div>
                  )}
                </div>

                {/* Program/Year/Section */}
                <div style={{ fontSize: 10, color: '#7A8BA8', display: 'flex', gap: 8 }}>
                  <span>Prog: <HighlightedText text={entry.programShorthand} query={searchQuery} /></span>
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
