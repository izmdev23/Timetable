import { Button, Divider, Select, Space, Tooltip } from 'antd';
import { Minus, Plus } from 'lucide-react';
import { AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, AlignStartVertical, AlignEndVertical, AlignCenterVertical } from 'lucide-react';
import type { ExportPresentationOptions } from '../utils/exportXlsx';
import { DEFAULT_EXPORT_PRESENTATION } from '../utils/exportXlsx';

const STORAGE_KEY = 'timetable_export_presentation';

const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 14;
const MIN_COLUMN_WIDTH = 16;
const MAX_COLUMN_WIDTH = 40;
const MIN_ROW_HEIGHT = 20;
const MAX_ROW_HEIGHT = 60;

const FONT_SIZE_OPTIONS = Array.from(
  { length: MAX_FONT_SIZE - MIN_FONT_SIZE + 1 },
  (_, i) => {
    const v = MIN_FONT_SIZE + i;
    return { label: `${v} pt`, value: v };
  },
);

const COLUMN_WIDTH_OPTIONS = Array.from(
  { length: (MAX_COLUMN_WIDTH - MIN_COLUMN_WIDTH) / 2 + 1 },
  (_, i) => ({ label: `${MIN_COLUMN_WIDTH + i * 2}`, value: MIN_COLUMN_WIDTH + i * 2 }),
);

const ROW_HEIGHT_OPTIONS = Array.from(
  { length: (MAX_ROW_HEIGHT - MIN_ROW_HEIGHT) / 2 + 1 },
  (_, i) => ({ label: `${MIN_ROW_HEIGHT + i * 2}`, value: MIN_ROW_HEIGHT + i * 2 }),
);

const VERTICAL_ALIGN_OPTIONS = [
  { value: 'top' as const, icon: <AlignStartHorizontal />, title: 'Top' },
  { value: 'middle' as const, icon: <AlignCenterHorizontal />, title: 'Middle' },
  { value: 'bottom' as const, icon: <AlignEndHorizontal />, title: 'Bottom' },
];

const HORIZONTAL_ALIGN_OPTIONS = [
  { value: 'left' as const, icon: <AlignStartVertical />, title: 'Left' },
  { value: 'center' as const, icon: <AlignCenterVertical />, title: 'Center' },
  { value: 'right' as const, icon: <AlignEndVertical />, title: 'Right' },
];

function clamp(v: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
}

/** Loads the shared export presentation settings from localStorage (falls back to defaults). */
export function loadExportPresentation(): ExportPresentationOptions {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { ...DEFAULT_EXPORT_PRESENTATION };
    const parsed = JSON.parse(saved) as Record<string, unknown>;
    return {
      fontSize: clamp(Number(parsed.fontSize), MIN_FONT_SIZE, MAX_FONT_SIZE, DEFAULT_EXPORT_PRESENTATION.fontSize),
      columnWidth: clamp(Number(parsed.columnWidth), MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH, DEFAULT_EXPORT_PRESENTATION.columnWidth),
      rowHeight: clamp(Number(parsed.rowHeight), MIN_ROW_HEIGHT, MAX_ROW_HEIGHT, DEFAULT_EXPORT_PRESENTATION.rowHeight),
      verticalAlignment: (parsed.verticalAlignment as 'top' | 'middle' | 'bottom') ?? DEFAULT_EXPORT_PRESENTATION.verticalAlignment,
      horizontalAlignment: (parsed.horizontalAlignment as 'left' | 'center' | 'right') ?? DEFAULT_EXPORT_PRESENTATION.horizontalAlignment,
    };
  } catch {
    return { ...DEFAULT_EXPORT_PRESENTATION };
  }
}

/** Persists the shared export presentation settings to localStorage. */
export function saveExportPresentation(opts: ExportPresentationOptions): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(opts));
}

const STEP_BTN_STYLE = { width: 24, padding: 0 } as const;
const ALIGN_BTN_STYLE = { width: 28, height: 28, padding: 0 } as const;

interface ExportPresentationSettingsProps {
  value: ExportPresentationOptions;
  onChange: (value: ExportPresentationOptions) => void;
}

/**
 * Font size / column width / row height / alignment controls used by the Excel export modals.
 * Rendered below a horizontal divider; font size has +/- stepped square buttons.
 */
export function ExportPresentationSettings({ value, onChange }: ExportPresentationSettingsProps) {
  const { fontSize, columnWidth, rowHeight, verticalAlignment, horizontalAlignment } = value;

  return (
    <>
      <Divider style={{ margin: '4px 0' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, width: 100 }}>Font Size:</span>
          <Select
            size="small"
            style={{ width: 80 }}
            value={fontSize}
            onChange={(val) => onChange({ ...value, fontSize: val })}
            options={FONT_SIZE_OPTIONS}
          />
<Button
              size="small"
              style={STEP_BTN_STYLE}
              icon={<Minus />}
              disabled={fontSize <= MIN_FONT_SIZE}
              onClick={() => onChange({ ...value, fontSize: fontSize - 1 })}
            />
            <Button
              size="small"
              style={STEP_BTN_STYLE}
              icon={<Plus />}
              disabled={fontSize >= MAX_FONT_SIZE}
              onClick={() => onChange({ ...value, fontSize: fontSize + 1 })}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, width: 100 }}>Column:</span>
          <Select
            size="small"
            style={{ width: 80 }}
            value={columnWidth}
            onChange={(val) => onChange({ ...value, columnWidth: val })}
            options={COLUMN_WIDTH_OPTIONS}
          />
          <span style={{ fontSize: 12, marginLeft: 12 }}>Row:</span>
          <Select
            size="small"
            style={{ width: 80 }}
            value={rowHeight}
            onChange={(val) => onChange({ ...value, rowHeight: val })}
            options={ROW_HEIGHT_OPTIONS}
          />
        </div>
        <Divider style={{ margin: '4px 0' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, width: 100 }}>Vertical:</span>
            <Space size={0}>
              {VERTICAL_ALIGN_OPTIONS.map((opt) => (
                <Tooltip key={opt.value} title={opt.title}>
                  <Button
                    size="small"
                    style={{
                      ...ALIGN_BTN_STYLE,
                      background: verticalAlignment === opt.value ? '#E6F0FA' : undefined,
                      borderColor: verticalAlignment === opt.value ? '#3B82F6' : undefined,
                      color: verticalAlignment === opt.value ? '#3B82F6' : undefined,
                    }}
                    onClick={() => onChange({ ...value, verticalAlignment: opt.value })}
                  >
                    {opt.icon}
                  </Button>
                </Tooltip>
              ))}
            </Space>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, width: 100 }}>Horizontal:</span>
            <Space size={0}>
              {HORIZONTAL_ALIGN_OPTIONS.map((opt) => (
                <Tooltip key={opt.value} title={opt.title}>
                  <Button
                    size="small"
                    style={{
                      ...ALIGN_BTN_STYLE,
                      background: horizontalAlignment === opt.value ? '#E6F0FA' : undefined,
                      borderColor: horizontalAlignment === opt.value ? '#3B82F6' : undefined,
                      color: horizontalAlignment === opt.value ? '#3B82F6' : undefined,
                    }}
                    onClick={() => onChange({ ...value, horizontalAlignment: opt.value })}
                  >
                    {opt.icon}
                  </Button>
                </Tooltip>
              ))}
            </Space>
          </div>
        </div>
      </div>
    </>
  );
}
