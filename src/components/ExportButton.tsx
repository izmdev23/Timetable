import { Button } from 'antd';
import { FileExcelOutlined } from '@ant-design/icons';
import { exportToXlsx } from '../utils/exportXlsx';
import type { SubjectEntry } from '../types';

interface ExportButtonProps {
  entries: SubjectEntry[];
  /** Optional filename (without extension). Defaults to "timetable". */
  filename?: string;
}

/**
 * Button that exports the timetable entries to a styled .xlsx file.
 * Delegates all export logic to the shared `exportToXlsx` utility.
 */
export function ExportButton({ entries, filename = 'timetable' }: ExportButtonProps) {
  async function handleExport(): Promise<void> {
    await exportToXlsx(entries, `${filename}.xlsx`);
  }

  return (
    <Button
      type="primary"
      icon={<FileExcelOutlined />}
      onClick={handleExport}
      disabled={entries.length === 0}
      size="small"
      style={{ background: '#3D6B50', borderColor: '#3D6B50' }}
    >
      Export Excel
    </Button>
  );
}
