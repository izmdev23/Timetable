import { Button, Tooltip } from 'antd';
import {
  AlignStartHorizontal,
  AlignEndHorizontal,
  AlignCenterHorizontal,
  AlignStartVertical,
  AlignEndVertical,
  AlignCenterVertical,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface AlignmentControlsProps {
  verticalAlignment: 'top' | 'middle' | 'bottom';
  horizontalAlignment: 'left' | 'center' | 'right';
  onVerticalAlignmentChange: (value: 'top' | 'middle' | 'bottom') => void;
  onHorizontalAlignmentChange: (value: 'left' | 'center' | 'right') => void;
  compact?: boolean;
}

interface VerticalAlignOption {
  value: 'top' | 'middle' | 'bottom';
  Icon: LucideIcon;
  title: string;
}

interface HorizontalAlignOption {
  value: 'left' | 'center' | 'right';
  Icon: LucideIcon;
  title: string;
}

const VERTICAL_ALIGN_OPTIONS: VerticalAlignOption[] = [
  { value: 'top', Icon: AlignStartHorizontal, title: 'Align Top' },
  { value: 'middle', Icon: AlignCenterHorizontal, title: 'Align Middle' },
  { value: 'bottom', Icon: AlignEndHorizontal, title: 'Align Bottom' },
];

const HORIZONTAL_ALIGN_OPTIONS: HorizontalAlignOption[] = [
  { value: 'left', Icon: AlignStartVertical, title: 'Align Left' },
  { value: 'center', Icon: AlignCenterVertical, title: 'Align Center' },
  { value: 'right', Icon: AlignEndVertical, title: 'Align Right' },
];

const ICON_COLOR = '#9AA7B8';
const ICON_COLOR_ACTIVE = '#3B82F6';

/**
 * Alignment controls with icon buttons for vertical and horizontal alignment.
 * Each group is a row (label + buttons); the groups are stacked in a column.
 */
export function AlignmentControls({
  verticalAlignment,
  horizontalAlignment,
  onVerticalAlignmentChange,
  onHorizontalAlignmentChange,
  compact = false,
}: AlignmentControlsProps) {
  const iconSize = compact ? 12 : 14;
  const buttonSize = compact ? 22 : 24;
  const rowStyle = {
    display: 'flex',
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 4,
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: compact ? 2 : 4,
      }}
    >
      {/* Vertical Alignment row */}
      <div style={rowStyle}>
        <span style={{ fontSize: 9, color: ICON_COLOR, fontWeight: 600, letterSpacing: 0.2, width: 56 }}>
          Vertical
        </span>
        {VERTICAL_ALIGN_OPTIONS.map(({ value, Icon, title }) => {
          const active = verticalAlignment === value;
          return (
            <Tooltip key={value} title={title}>
              <Button
                size="small"
                style={{
                  width: buttonSize,
                  height: buttonSize,
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: active ? '#EAF2FE' : 'transparent',
                  borderColor: active ? '#BBD4F7' : 'transparent',
                }}
                onClick={() => onVerticalAlignmentChange(value)}
              >
                <Icon size={iconSize} style={{ color: active ? ICON_COLOR_ACTIVE : ICON_COLOR }} />
              </Button>
            </Tooltip>
          );
        })}
      </div>

      {/* Horizontal Alignment row */}
      <div style={rowStyle}>
        <span style={{ fontSize: 9, color: ICON_COLOR, fontWeight: 600, letterSpacing: 0.2, width: 56 }}>
          Horizontal
        </span>
        {HORIZONTAL_ALIGN_OPTIONS.map(({ value, Icon, title }) => {
          const active = horizontalAlignment === value;
          return (
            <Tooltip key={value} title={title}>
              <Button
                size="small"
                style={{
                  width: buttonSize,
                  height: buttonSize,
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: active ? '#EAF2FE' : 'transparent',
                  borderColor: active ? '#BBD4F7' : 'transparent',
                }}
                onClick={() => onHorizontalAlignmentChange(value)}
              >
                <Icon size={iconSize} style={{ color: active ? ICON_COLOR_ACTIVE : ICON_COLOR }} />
              </Button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
