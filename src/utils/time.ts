/**
 * Converts a 24-hour "HH:mm" time string into a 12-hour "hh:mm AM/PM" format.
 * Example: "13:30" -> "01:30 PM", "08:15" -> "08:15 AM"
 */
export function formatTimeTo12Hr(timeStr: string): string {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let h = parseInt(parts[0], 10);
  const m = parts[1].trim();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  const hStr = h.toString().padStart(2, '0');
  return `${hStr}:${m} ${ampm}`;
}

/**
 * Converts minutes past midnight into a 12-hour "hh:mm AM/PM" format.
 * Example: 480 -> "08:00 AM", 810 -> "01:30 PM"
 */
export function minutesTo12Hr(min: number): string {
  const totalMin = min % (24 * 60);
  let h = Math.floor(totalMin / 60);
  const m = (totalMin % 60).toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  const hStr = h.toString().padStart(2, '0');
  return `${hStr}:${m} ${ampm}`;
}
