export interface ParsedTeacherName {
  lastName: string;
  firstName: string;
  middleName: string;
}

/**
 * Parses teacher name, supporting both legacy (single comma) and double-comma formatted strings.
 * This ensures that a multi-word First Name (like "Maria Clara") is correctly processed without
 * its second word being mistakenly treated as the middle name.
 */
export function parseTeacherName(fullName: string): ParsedTeacherName {
  let lastName = '';
  let firstName = '';
  let middleName = '';
  const trimmed = fullName.trim();
  
  const commas = trimmed.split(',').length - 1;
  if (commas >= 2) {
    // Double-comma format: LastName, FirstName, MiddleName
    const parts = trimmed.split(',');
    lastName = parts[0].trim();
    firstName = parts[1].trim();
    middleName = parts[2]?.trim() ?? '';
  } else if (commas === 1) {
    // Legacy format: LastName, FirstName MiddleName
    const commaIdx = trimmed.indexOf(',');
    lastName = trimmed.substring(0, commaIdx).trim();
    const rest = trimmed.substring(commaIdx + 1).trim();
    const spaceIdx = rest.lastIndexOf(' ');
    if (spaceIdx !== -1) {
      firstName = rest.substring(0, spaceIdx).trim();
      middleName = rest.substring(spaceIdx + 1).trim();
    } else {
      firstName = rest;
    }
  } else {
    // Space separated fallback: FirstName LastName
    const spaceIdx = trimmed.lastIndexOf(' ');
    if (spaceIdx !== -1) {
      firstName = trimmed.substring(0, spaceIdx).trim();
      lastName = trimmed.substring(spaceIdx + 1).trim();
    } else {
      lastName = trimmed;
    }
  }
  return { lastName, firstName, middleName };
}

/** Formats parsed teacher name back to space-separated string for presentation. */
export function formatTeacherForDisplay(fullName: string): string {
  if (!fullName) return '';
  const { lastName, firstName, middleName } = parseTeacherName(fullName);
  if (!lastName) return '';
  if (!firstName) return lastName;
  return middleName ? `${lastName}, ${firstName} ${middleName}` : `${lastName}, ${firstName}`;
}
