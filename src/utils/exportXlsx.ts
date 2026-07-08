import ExcelJS from 'exceljs';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import type { SubjectEntry, DayOfWeek } from '../types';
import { DAY_ORDER } from '../types';
import { colorForSubject } from '../theme';
import { parseTeacherName } from '../utils/teacherName';
import { minutesTo12Hr } from './time';

const SLOT_INTERVAL = 30; // minutes

/** Converts "HH:mm" to minutes */
function toMin(time: string): number {
  const parts = time.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

/** Converts minutes to display string "hh:mm AM/PM" */
function toTime(min: number): string {
  return minutesTo12Hr(min);
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
): Promise<void> {
  const activeDays = excludeHiddenDays
    ? DAY_ORDER.filter((d) => !hiddenDays.includes(d))
    : DAY_ORDER;

  const startMin = excludeTimeWindow ? viewStart : 0;
  const endMin = excludeTimeWindow ? viewEnd : 24 * 60;
  const rowCount = (endMin - startMin) / SLOT_INTERVAL;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Timetable');

  worksheet.properties.defaultRowHeight = 28;

  // Configure column keys, headers and widths
  const columns = [
    { header: 'Time', key: 'time', width: 10 }
  ];
  for (const day of activeDays) {
    columns.push({ header: day, key: day.toLowerCase(), width: 22 });
  }
  worksheet.columns = columns;

  // Style header row (Row 1)
  const headerRow = worksheet.getRow(1);
  headerRow.height = 20;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3560' }
    };
    cell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD0D7E3' } },
      bottom: { style: 'medium', color: { argb: 'FF2B4C7E' } },
      left: { style: 'thin', color: { argb: 'FFD0D7E3' } },
      right: { style: 'thin', color: { argb: 'FFD0D7E3' } }
    };
  });

  // Populate time labels in column 1 and style background rows
  for (let r = 0; r < rowCount; r++) {
    const rowNumber = r + 2;
    const row = worksheet.getRow(rowNumber);
    row.getCell(1).value = toTime(startMin + r * SLOT_INTERVAL);
    
    // Style time cells (column 1)
    const timeCell = row.getCell(1);
    timeCell.font = { name: 'Calibri', size: 9, color: { argb: 'FF7A8BA8' } };
    timeCell.alignment = { horizontal: 'right', vertical: 'middle' };
    
    // Style all cells in the row with default borders and backgrounds
    for (let colNumber = 1; colNumber <= columns.length; colNumber++) {
      const cell = row.getCell(colNumber);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD0D7E3' } },
        bottom: { style: 'thin', color: { argb: 'FFD0D7E3' } },
        left: { style: 'thin', color: { argb: 'FFD0D7E3' } },
        right: { style: 'thin', color: { argb: 'FFD0D7E3' } }
      };
      if (colNumber > 1) {
        // Zebra striping for days columns
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: r % 2 === 0 ? 'FFFAFBFC' : 'FFEEF1F6' }
        };
      }
    }
  }

  // Bottom row for the final end time label
  const bottomRowNumber = rowCount + 2;
  const bottomRow = worksheet.getRow(bottomRowNumber);
  bottomRow.height = 18;
  bottomRow.getCell(1).value = toTime(endMin);
  const bottomTimeCell = bottomRow.getCell(1);
  bottomTimeCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF7A8BA8' } };
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

  // Populate subject entries and merge spans by first building a grid of slots to detect overlaps
  interface SlotDetail {
    entry: SubjectEntry;
    sched: any;
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

  function slotsEqual(a: SlotDetail[], b: SlotDetail[]): boolean {
    if (a.length !== b.length) return false;
    const idsA = a.map((x) => x.entry.id).sort();
    const idsB = b.map((x) => x.entry.id).sort();
    for (let i = 0; i < idsA.length; i++) {
      if (idsA[i] !== idsB[i]) return false;
    }
    return true;
  }

  // Iterate columns and merge run-length segments of equal slots
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
          `${entry.subjectCode}\n` +
          `${entry.programShorthand} - ${entry.year}${entry.section}\n` +
          `${formattedTeacher}`;

        const hexColor = colorForSubject(entry.subjectCode, entry.color).replace('#', '');
        fillArgb = 'FF' + hexColor;
        fontColor = 'FFFFFFFF';
      } else {
        // Conflict styling
        cellText = 'CONFLICT:\n' + currentSlotEntries.map(({ entry }) => {
          const { lastName, firstName } = parseTeacherName(entry.assignedTeacherName);
          const formattedTeacher = firstName ? `${firstName.charAt(0).toUpperCase()}. ${lastName}` : lastName;
          return `${entry.subjectCode} (${entry.programShorthand}-${entry.year}${entry.section}, ${formattedTeacher})`;
        }).join('\n---\n');

        fillArgb = 'FFFFD6D6';
        fontColor = 'FF8B0000';
      }

      const startCell = worksheet.getCell(startRow, colNumber);
      startCell.value = cellText;

      // Style cells in the range
      for (let r = startRow; r <= endRow; r++) {
        const cell = worksheet.getCell(r, colNumber);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: fillArgb }
        };
        cell.font = {
          name: 'Calibri',
          size: 9,
          bold: true,
          color: { argb: fontColor }
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      }

      // Merge cells if the entry spans multiple slots
      if (endRow > startRow) {
        worksheet.mergeCells(startRow, colNumber, endRow, colNumber);
      }

      slotIdx = runEnd + 1;
    }
  }

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

    if (!filePath) return; // User cancelled

    const buffer = await workbook.xlsx.writeBuffer();
    const bytes = Array.from(new Uint8Array(buffer));
    await invoke('save_file_bytes', { path: filePath, bytes });
  } catch (err) {
    console.error('Failed to save file:', err);
    throw err;
  }
}
