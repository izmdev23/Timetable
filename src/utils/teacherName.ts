export interface ParsedTeacherName {
  lastName: string;
  firstName: string;
  middleName: string;
}

export function parseTeacherName(fullName: string): ParsedTeacherName {
  let lastName = '';
  let firstName = '';
  let middleName = '';
  const trimmed = fullName.trim();

  const commas = trimmed.split(',').length - 1;
  if (commas >= 2) {
    const parts = trimmed.split(',');
    lastName = parts[0].trim();
    firstName = parts[1].trim();
    middleName = parts[2]?.trim() ?? '';
  } else if (commas === 1) {
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

export function formatInstructorValue(firstName: string, middleName: string, lastName: string): string {
  return JSON.stringify({
    firstName: firstName.trim(),
    middleName: middleName.trim(),
    lastName: lastName.trim(),
  });
}

export function parseInstructorValue(value: string): ParsedTeacherName {
  if (!value) return { lastName: '', firstName: '', middleName: '' };
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') {
      return {
        firstName: typeof parsed.firstName === 'string' ? parsed.firstName : '',
        middleName: typeof parsed.middleName === 'string' ? parsed.middleName : '',
        lastName: typeof parsed.lastName === 'string' ? parsed.lastName : '',
      };
    }
  } catch {
    // fall through to legacy parsing
  }
  return parseTeacherName(value);
}

export function formatInstructorDisplay(firstName: string, middleName: string, lastName: string): string {
  if (!lastName) return '';
  if (!firstName) return lastName;
  const middle = middleName ? ` ${middleName.charAt(0).toUpperCase()}.` : '';
  return `${lastName}, ${firstName}${middle}`;
}

export function formatTeacherForDisplay(fullName: string): string {
  if (!fullName) return '';
  const parsed = fullName.startsWith('{') ? parseInstructorValue(fullName) : parseTeacherName(fullName);
  return formatInstructorDisplay(parsed.firstName, parsed.middleName, parsed.lastName);
}
