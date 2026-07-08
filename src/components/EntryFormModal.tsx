import { Modal } from 'antd';
import { useState, useRef, useEffect } from 'react';
import type { SubjectEntry, FormState, ConflictInfo } from '../types';
import { SubjectForm } from './SubjectForm';
import type { DynamicData } from '../hooks/useTimetableStore';

interface EntryFormModalProps {
  open: boolean;
  onCancel: () => void;
  suggestions: {
    assignedTeacherNames: string[];
    subjectCodes: string[];
    offerCodes: string[];
    rooms: string[];
    subjectDescriptions?: string[];
  };
  entries: SubjectEntry[];
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
  formState: FormState;
  onFormStateChange: (state: FormState) => void;
  dynamicData: DynamicData[];
}

export function EntryFormModal({
  open,
  onCancel,
  suggestions,
  entries,
  templates,
  onSubmit,
  editingEntry,
  formState,
  onFormStateChange,
  dynamicData,
}: EntryFormModalProps) {
  const [position, setPosition] = useState({ x: 200, y: 120 });
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const modalPosRef = useRef({ x: 200, y: 120 });

  useEffect(() => {
    // Reset position if opened
    if (open) {
      setPosition({ x: window.innerWidth / 2 - 260, y: 80 });
      modalPosRef.current = { x: window.innerWidth / 2 - 260, y: 80 };
    }
  }, [open]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only allow dragging via the header
    const target = e.target as HTMLElement;
    if (target.closest('.ant-modal-header') || target.closest('.modal-drag-handle')) {
      draggingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      
      const nextX = modalPosRef.current.x + dx;
      const nextY = Math.max(0, modalPosRef.current.y + dy);

      setPosition({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      if (draggingRef.current) {
        draggingRef.current = false;
        modalPosRef.current = { x: position.x, y: position.y };
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [position]);

  return (
    <Modal
      open={open}
      footer={null}
      closable={true}
      onCancel={onCancel}
      mask={false}
      maskClosable={false}
      width={520}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        margin: 0,
        padding: 0,
        pointerEvents: 'auto',
        boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
        borderRadius: 8,
      }}
      wrapClassName="no-pointer-events-wrap"
      title={
        <div 
          className="modal-drag-handle"
          style={{ 
            cursor: 'move', 
            width: '100%', 
            paddingBlock: 4,
            userSelect: 'none'
          }}
          onMouseDown={handleMouseDown}
        >
          {editingEntry ? '✏️ Edit Subject Entry' : '📝 Add Subject Entry'}
        </div>
      }
      destroyOnClose
    >
      <div onMouseDown={(e) => e.stopPropagation()}>
        <SubjectForm
          suggestions={suggestions}
          entries={entries}
          templates={templates}
          onSubmit={(entry) => {
            const conflicts = onSubmit(entry);
            if (conflicts.length === 0) {
              onCancel(); // close modal if no conflicts
            }
            return conflicts;
          }}
          editingEntry={editingEntry}
          onCancelEdit={onCancel}
          formState={formState}
          onFormStateChange={onFormStateChange}
          dynamicData={dynamicData}
        />
      </div>
    </Modal>
  );
}
