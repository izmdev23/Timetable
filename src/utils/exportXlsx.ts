import ExcelJS from 'exceljs';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import type { SubjectEntry, DayOfWeek } from '../types';
import { DAY_ORDER } from '../types';
import { colorForSubject, getThemeColors } from '../theme';
import { parseTeacherName } from '../utils/teacherName';
import { minutesTo12Hr } from './time';

const SLOT_INTERVAL = 30; // minutes

/** Presentation options controlling how the exported workbook looks. */
export interface ExportPresentationOptions {
  /** Font size (pt) of the header cells; data cells use fontSize - 1 */
  fontSize: number;
  /** Default height (pt) of the grid rows */
  rowHeight: number;
  /** Width (Excel column units) of the day columns */
  columnWidth: number;
  /** Vertical alignment of cell content: 'top', 'middle', 'bottom' */
  verticalAlignment: 'top' | 'middle' | 'bottom';
  /** Horizontal alignment of cell content: 'left', 'center', 'right' */
  horizontalAlignment: 'left' | 'center' | 'right';
}

export const DEFAULT_EXPORT_PRESENTATION: ExportPresentationOptions = {
  fontSize: 10,
  rowHeight: 34,
  columnWidth: 26,
  verticalAlignment: 'middle',
  horizontalAlignment: 'center',
};

/** Converts "HH:mm" to minutes */
function toMin(time: string): number {
  const parts = time.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

/** Converts minutes to display string "hh:mm AM/PM" */
function toTime(min: number): string {
  return minutesTo12Hr(min);
}





interface SlotDetail {
  entry: SubjectEntry;
  sched: any;
}

function slotsEqual(a: SlotDetail[], b: SlotDetail[]): boolean {
  if (a.length !== b.length) return false;
  const idsA = a.map((x) => x.entry.id).sort();
  const idsB = b.map((x) => x.entry.id).sort();
  for (let i = 0; i < idsA.length; i++) {
    if (idsA[i] !== idsB[i]) return false;
  }
  return true;
}

function addSheetToWorkbook(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  entries: SubjectEntry[],
  activeDays: DayOfWeek[],
  startMin: number,
  endMin: number,
  rowCount: number,
  theme: string = 'blue',
  bandedRows: boolean = true,
  presentation: ExportPresentationOptions = DEFAULT_EXPORT_PRESENTATION,
): void {
  const { fontSize, rowHeight, columnWidth, verticalAlignment, horizontalAlignment } = presentation;
  const dataFontSize = Math.max(6, fontSize - 1);
  const colors = getThemeColors(theme);
  const headerArgb = colors.headerBg.replace('#', 'FF');
  const primaryArgb = colors.primary.replace('#', 'FF');

  const worksheet = workbook.addWorksheet(sheetName);
  worksheet.properties.defaultRowHeight = rowHeight;

  const columns = [
    { header: 'Time', key: 'time', width: 12 }
  ];
  for (const day of activeDays) {
    columns.push({ header: day, key: day.toLowerCase(), width: columnWidth });
  }
  worksheet.columns = columns;

  const headerRow = worksheet.getRow(1);
  headerRow.height = Math.max(16, rowHeight - 10);
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: headerArgb }
    };
    cell.font = {
      name: 'Calibri',
      size: fontSize,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD0D7E3' } },
      bottom: { style: 'medium', color: { argb: primaryArgb } },
      left: { style: 'thin', color: { argb: 'FFD0D7E3' } },
      right: { style: 'thin', color: { argb: 'FFD0D7E3' } }
    };
  });

  // Pre-set all row heights to ensure consistent sizing for both empty and filled cells
  for (let r = 0; r < rowCount; r++) {
    const rowNumber = r + 2;
    const row = worksheet.getRow(rowNumber);
    row.height = rowHeight;
    row.getCell(1).value = toTime(startMin + r * SLOT_INTERVAL);
    const timeCell = row.getCell(1);
    timeCell.font = { name: 'Calibri', size: dataFontSize, color: { argb: 'FF7A8BA8' } };
    timeCell.alignment = { horizontal: 'right', vertical: 'middle' };

    for (let colNumber = 1; colNumber <= columns.length; colNumber++) {
      const cell = row.getCell(colNumber);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD0D7E3' } },
        bottom: { style: 'thin', color: { argb: 'FFD0D7E3' } },
        left: { style: 'thin', color: { argb: 'FFD0D7E3' } },
        right: { style: 'thin', color: { argb: 'FFD0D7E3' } }
      };
      if (colNumber > 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: bandedRows ? (r % 2 === 0 ? 'FFFAFBFC' : 'FFEEF1F6') : 'FFFFFFFF' }
        };
      }
    }
  }

  const bottomRowNumber = rowCount + 2;
  const bottomRow = worksheet.getRow(bottomRowNumber);
  bottomRow.height = Math.max(14, rowHeight - 12);
  bottomRow.getCell(1).value = toTime(endMin);
  const bottomTimeCell = bottomRow.getCell(1);
  bottomTimeCell.font = { name: 'Calibri', size: dataFontSize, bold: true, color: { argb: 'FF7A8BA8' } };
  bottomTimeCell.alignment = { horizontal: 'right', vertical: 'middle' };

  for (let colNumber = 1; colNumber <= columns.length; colNumber++) {
    const cell = bottomRow.getCell(colNumber);
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD0D7E3' } },
      bottom: { style: 'thin', color: { argb: 'FFD0D7E3' } },
      left: { style: 'thin', color: { argb: 'FFD0D7E3' } },
      right: { style: 'thin', color: { argb: 'FFD0D7E3' } }
    };
  }

  const daySlots: SlotDetail[][][] = Array.from(
    { length: activeDays.length },
    () => Array.from({ length: rowCount }, () => [])
  );

  for (const entry of entries) {
    for (const sched of entry.schedules) {
      for (const day of sched.days) {
        const colIdx = activeDays.indexOf(day);
        if (colIdx === -1) continue;

        const s = toMin(sched.startTime);
        const e = toMin(sched.endTime);

        if (s >= endMin || e <= startMin) continue;

        const clampedStart = Math.max(startMin, s);
        const clampedEnd = Math.min(endMin, e);

        if (clampedEnd <= clampedStart) continue;

        const startSlot = Math.floor((clampedStart - startMin) / SLOT_INTERVAL);
        const endSlot = Math.floor((clampedEnd - startMin) / SLOT_INTERVAL) - 1;

        for (let slot = startSlot; slot <= endSlot; slot++) {
          if (slot >= 0 && slot < rowCount) {
            daySlots[colIdx][slot].push({ entry, sched });
          }
        }
      }
    }
  }

  for (let colIdx = 0; colIdx < activeDays.length; colIdx++) {
    const colNumber = colIdx + 2;
    let slotIdx = 0;

    while (slotIdx < rowCount) {
      const currentSlotEntries = daySlots[colIdx][slotIdx];
      if (currentSlotEntries.length === 0) {
        slotIdx++;
        continue;
      }

      let runEnd = slotIdx;
      while (
        runEnd + 1 < rowCount &&
        slotsEqual(currentSlotEntries, daySlots[colIdx][runEnd + 1])
      ) {
        runEnd++;
      }

      const startRow = slotIdx + 2;
      const endRow = runEnd + 2;

      let cellText = '';
      let fillArgb = 'FFFFFF';
      let fontColor = '000000';

      if (currentSlotEntries.length === 1) {
        const { entry } = currentSlotEntries[0];
        const { lastName, firstName } = parseTeacherName(entry.assignedTeacherName);
        const formattedTeacher = firstName ? `${firstName.charAt(0).toUpperCase()}. ${lastName}` : lastName;

        cellText =
          `${entry.subjectDescription}\n` +
          `${entry.program} - ${entry.year}${entry.section}\n` +
          `${formattedTeacher}`;

        const hexColor = colorForSubject(entry.subjectCode, entry.color).replace('#', '');
        fillArgb = 'FF' + hexColor;
        fontColor = 'FFFFFFFF';
      } else {
        cellText = 'CONFLICT:\n' + currentSlotEntries.map(({ entry }) => {
          const { lastName, firstName } = parseTeacherName(entry.assignedTeacherName);
          const formattedTeacher = firstName ? `${firstName.charAt(0).toUpperCase()}. ${lastName}` : lastName;
          return `${entry.subjectDescription} (${entry.program}-${entry.year}${entry.section}, ${formattedTeacher})`;
        }).join('\n---\n');

        fillArgb = 'FFFFD6D6';
        fontColor = 'FF8B0000';
      }

      const startCell = worksheet.getCell(startRow, colNumber);
      startCell.value = cellText;

      for (let r = startRow; r <= endRow; r++) {
        const cell = worksheet.getCell(r, colNumber);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: fillArgb }
        };
        cell.font = {
          name: 'Calibri',
          size: dataFontSize,
          bold: true,
          color: { argb: fontColor }
        };
        cell.alignment = { 
          horizontal: horizontalAlignment, 
          vertical: verticalAlignment, 
          wrapText: true 
        };
        // Ensure merged rows also have the correct height
        const row = worksheet.getRow(r);
        row.height = rowHeight;
      }

      if (endRow > startRow) {
        worksheet.mergeCells(startRow, colNumber, endRow, colNumber);
      }

      slotIdx = runEnd + 1;
    }
  }
}

async function saveWorkbook(workbook: ExcelJS.Workbook, filename: string, targetPath?: string): Promise<void> {
  try {
    const resolvedPath = targetPath || await invoke<string>('resolve_default_path', { filename });
    const filePath = targetPath || await save({
      title: 'Save Timetable Excel',
      defaultPath: resolvedPath,
      filters: [{
        name: 'Excel Workbook',
        extensions: ['xlsx']
      }]
    });

    if (!filePath) return;

    const buffer = await workbook.xlsx.writeBuffer();
    const bytes = Array.from(new Uint8Array(buffer));
    await invoke('save_file_bytes', { path: filePath, bytes });
  } catch (err) {
    console.error('Failed to save file:', err);
    throw err;
  }
}

/**
 * Exports the timetable entries to an xlsx workbook using exceljs.
 * Correctly applies text and fill formatting matching the web interface.
 * Prompts user to select destination file via native save dialog.
 */
export async function exportToXlsx(
  entries: SubjectEntry[],
  filename = 'timetable.xlsx',
  hiddenDays: DayOfWeek[] = [],
  excludeHiddenDays = true,
  viewStart = 7 * 60,
  viewEnd = 21 * 60,
  excludeTimeWindow = true,
  targetPath?: string,
  theme: string = 'blue',
  bandedRows: boolean = true,
  presentation: ExportPresentationOptions = DEFAULT_EXPORT_PRESENTATION,
): Promise<void> {
  const activeDays = excludeHiddenDays
    ? DAY_ORDER.filter((d) => !hiddenDays.includes(d))
    : DAY_ORDER;

  const startMin = excludeTimeWindow ? viewStart : 0;
  const endMin = excludeTimeWindow ? viewEnd : 24 * 60;
  const rowCount = (endMin - startMin) / SLOT_INTERVAL;

  const workbook = new ExcelJS.Workbook();
  addSheetToWorkbook(workbook, 'Timetable', entries, activeDays, startMin, endMin, rowCount, theme, bandedRows, presentation);
  await saveWorkbook(workbook, filename, targetPath);
}

/**
 * Exports timetable entries for multiple rooms into a single xlsx file,
 * with each room on a separate sheet tab.
 */
export async function exportToXlsxBatch(
  entriesByRoom: Record<string, SubjectEntry[]>,
  filename = 'timetable.xlsx',
  hiddenDays: DayOfWeek[] = [],
  excludeHiddenDays = true,
  viewStart = 7 * 60,
  viewEnd = 21 * 60,
  excludeTimeWindow = true,
  targetPath?: string,
  theme: string = 'blue',
  bandedRows: boolean = true,
  presentation: ExportPresentationOptions = DEFAULT_EXPORT_PRESENTATION,
): Promise<void> {
  const activeDays = excludeHiddenDays
    ? DAY_ORDER.filter((d) => !hiddenDays.includes(d))
    : DAY_ORDER;

  const startMin = excludeTimeWindow ? viewStart : 0;
  const endMin = excludeTimeWindow ? viewEnd : 24 * 60;
  const rowCount = (endMin - startMin) / SLOT_INTERVAL;

  const workbook = new ExcelJS.Workbook();

  for (const [roomKey, entries] of Object.entries(entriesByRoom)) {
    const sheetName = roomKey.replace(/[\\\/\?\*\[\]]/g, '_').replace(/\|/g, ' - ').substring(0, 31);
    addSheetToWorkbook(workbook, sheetName, entries, activeDays, startMin, endMin, rowCount, theme, bandedRows, presentation);
  }

  await saveWorkbook(workbook, filename, targetPath);
}
