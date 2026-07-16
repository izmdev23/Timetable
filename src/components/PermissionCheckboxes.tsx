import { Checkbox, Select, Space } from 'antd';
import type { PermissionSet } from '../types';

interface PermissionCheckboxesProps {
  value: PermissionSet;
  onChange: (perms: PermissionSet) => void;
  disabled?: boolean;
  label?: string;
}

const PRESETS: { label: string; value: PermissionSet }[] = [
  { label: 'Admin',  value: { all: true, write: true, delete: true, create: true } },
  { label: 'Editor', value: { all: false, write: true, delete: false, create: true } },
  { label: 'Viewer', value: { all: false, write: false, delete: false, create: false } },
];

function presetLabel(value: PermissionSet): string {
  if (value.all) return 'Admin';
  if (value.write && !value.delete && value.create) return 'Editor';
  if (!value.write && !value.delete && !value.create) return 'Viewer';
  return 'Custom';
}

export function PermissionCheckboxes({ value, onChange, disabled = false, label }: PermissionCheckboxesProps) {
  const handleCheck = (field: keyof PermissionSet, checked: boolean) => {
    if (field === 'all') {
      onChange({ all: checked, write: checked, delete: checked, create: checked });
    } else {
      const next = { ...value, [field]: checked };
      if (next.write && next.delete && next.create && !next.all) {
        next.all = true;
      } else if (next.all && !checked) {
        next.all = false;
      }
      onChange(next);
    }
  };

  const handlePreset = (presetValue: PermissionSet) => {
    onChange(presetValue);
  };

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      {label && <div style={{ fontSize: 12, fontWeight: 600, color: '#595959' }}>{label}</div>}
      {!disabled && (
        <Select
          value={presetLabel(value)}
          onChange={(v) => {
            const preset = PRESETS.find((p) => p.label === v);
            if (preset) handlePreset(preset.value);
          }}
          style={{ width: '100%' }}
          size="small"
          options={PRESETS.map((p) => ({ label: p.label, value: p.label }))}
        />
      )}
      <Checkbox
        checked={value.all}
        onChange={(e) => handleCheck('all', e.target.checked)}
        disabled={disabled}
      >
        All
      </Checkbox>
      <Checkbox
        checked={value.write}
        onChange={(e) => handleCheck('write', e.target.checked)}
        disabled={disabled || value.all}
      >
        Write
      </Checkbox>
      <Checkbox
        checked={value.delete}
        onChange={(e) => handleCheck('delete', e.target.checked)}
        disabled={disabled || value.all}
      >
        Delete
      </Checkbox>
      <Checkbox
        checked={value.create}
        onChange={(e) => handleCheck('create', e.target.checked)}
        disabled={disabled || value.all}
      >
        Create
      </Checkbox>
    </Space>
  );
}
