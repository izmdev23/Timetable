import type { Cell, Worksheet } from 'exceljs';

export const BLUEPRINT_HEADERS: Record<string, string> = {
  subject_code: 'subjectCode',
  offer_code: 'offerCode',
  subject_description: 'subjectDescription',
  department: 'department',
  program: 'program',
  year: 'year',
  section: 'section',
  room: 'room',
  building: 'building',
};

export const SCHEDULE_HEADERS: Record<string, string> = {
  mon_in: 'monIn',
  mon_out: 'monOut',
  monday_in: 'monIn',
  monday_out: 'monOut',
  tue_in: 'tueIn',
  tue_out: 'tueOut',
  tuesday_in: 'tueIn',
  tuesday_out: 'tueOut',
  wed_in: 'wedIn',
  wed_out: 'wedOut',
  wednesday_in: 'wedIn',
  wednesday_out: 'wedOut',
  thu_in: 'thuIn',
  thu_out: 'thuOut',
  thursday_in: 'thuIn',
  thursday_out: 'thuOut',
  fri_in: 'friIn',
  fri_out: 'friOut',
  friday_in: 'friIn',
  friday_out: 'friOut',
  sat_in: 'satIn',
  sat_out: 'satOut',
  saturday_in: 'satIn',
  saturday_out: 'satOut',
  sun_in: 'sunIn',
  sun_out: 'sunOut',
  sunday_in: 'sunIn',
  sunday_out: 'sunOut',
  instructor_ln: 'lastName',
  instructor_fn: 'firstName',
  instructor_mn: 'middleName',
  room: 'room',
  last_name: 'lastName',
  first_name: 'firstName',
  middle_name: 'middleName',
  time_in: 'monIn',
  time_out: 'monOut',
  start_time: 'monIn',
  end_time: 'monOut',
};

function generateAliases(key: string): string[] {
  const aliases = [key];
  const withoutUnderscore = key.replace(/_/g, '');
  if (withoutUnderscore !== key) aliases.push(withoutUnderscore);
  const withHyphen = key.replace(/_/g, '-');
  if (withHyphen !== key) aliases.push(withHyphen);
  return aliases;
}

function fuzzyScore(a: string, b: string): number {
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.85;

  const getBigrams = (str: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.slice(i, i + 2));
    }
    return bigrams;
  };

  const bigramsA = getBigrams(a);
  const bigramsB = getBigrams(b);

  if (bigramsA.size === 0 || bigramsB.size === 0) return 0;

  let intersection = 0;
  for (const bigram of bigramsA) {
    if (bigramsB.has(bigram)) {
      intersection++;
    }
  }

  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

export function colNumberToLetters(n: number): string {
  let letters = '';
  while (n > 0) {
    n--;
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26);
  }
  return letters;
}

function buildAliasLookup(
  headerMap: Record<string, string>,
): Map<string, string> {
  const lookup = new Map<string, string>();

  for (const [key, field] of Object.entries(headerMap)) {
    for (const alias of generateAliases(key)) {
      lookup.set(alias, field);
    }
  }

  const manualAliases: Record<string, string> = {
    subj_code: 'subjectCode',
    subjcode: 'subjectCode',
    subjectcode: 'subjectCode',
    subj: 'subjectCode',
    desc: 'subjectDescription',
    description: 'subjectDescription',
    subjectdesc: 'subjectDescription',
    subject_desc: 'subjectDescription',
    dept: 'department',
    fname: 'firstName',
    firstname: 'firstName',
    given: 'firstName',
    lname: 'lastName',
    lastname: 'lastName',
    surname: 'lastName',
    mname: 'middleName',
    middlename: 'middleName',
    rm: 'room',
    room_name: 'room',
    roomname: 'room',
    bldg: 'building',
    building_name: 'building',
    buildingname: 'building',
  };
  for (const [alias, field] of Object.entries(manualAliases)) {
    if (!lookup.has(alias)) lookup.set(alias, field);
  }

  return lookup;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[\s\-]+/g, '_').replace(/[^a-z0-9_]/g, '');
}

const blueprintLookup = buildAliasLookup(BLUEPRINT_HEADERS);
const scheduleLookup = buildAliasLookup(SCHEDULE_HEADERS);

function detectHeaders(
  worksheet: Worksheet,
  lookup: Map<string, string>,
  headerMap: Record<string, string>,
): Record<string, string> {
  const mapping: Record<string, string> = {};
  const headerRow = worksheet.getRow(1);
  const candidates: string[] = Object.keys(headerMap);

  headerRow.eachCell({ includeEmpty: false }, (cell: Cell, colNumber: number) => {
    const raw = cell.value;
    if (!raw) return;
    const normalized = normalize(String(raw));
    if (!normalized) return;
    const letter = colNumberToLetters(colNumber);

    let fieldKey = lookup.get(normalized);
    if (!fieldKey) {
      let bestScore = 0;
      let bestField = '';
      for (const key of lookup.keys()) {
        const score = fuzzyScore(normalized, key);
        if (score > bestScore) {
          bestScore = score;
          bestField = lookup.get(key)!;
        }
      }
      if (bestScore >= 0.6 && bestField) {
        for (const c of candidates) {
          if (headerMap[c] === bestField) {
            fieldKey = bestField;
            break;
          }
        }
      }
    }

    if (fieldKey && !mapping[fieldKey]) {
      mapping[fieldKey] = letter;
    }
  });

  return mapping;
}

export function detectBlueprintColumns(worksheet: Worksheet): Record<string, string> {
  return detectHeaders(worksheet, blueprintLookup, BLUEPRINT_HEADERS);
}

export function detectScheduleColumns(worksheet: Worksheet): Record<string, string> {
  return detectHeaders(worksheet, scheduleLookup, SCHEDULE_HEADERS);
}
