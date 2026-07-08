// searchWorker.ts
import type { SubjectEntry } from '../types';

interface SearchMessage {
  entries: SubjectEntry[];
  query: string;
}

self.onmessage = (e: MessageEvent<SearchMessage>) => {
  const { entries, query } = e.data;
  if (!query || query.trim() === '') {
    self.postMessage([]);
    return;
  }

  const normalizedQuery = query.trim().toLowerCase();
  
  const results = entries
    .map((entry) => {
      let score = 0;
      const matchedFields: string[] = [];

      const checkField = (val: string | number, fieldName: string, weight = 1) => {
        const strVal = String(val).toLowerCase();
        if (strVal === normalizedQuery) {
          score += 100 * weight;
          matchedFields.push(fieldName);
        } else if (strVal.startsWith(normalizedQuery)) {
          score += 80 * weight;
          matchedFields.push(fieldName);
        } else if (strVal.includes(normalizedQuery)) {
          score += 50 * weight;
          matchedFields.push(fieldName);
        } else {
          const words = strVal.split(/[\s,\-_]+/);
          if (words.some(word => word.startsWith(normalizedQuery) || normalizedQuery.includes(word))) {
            score += 20 * weight;
            matchedFields.push(fieldName);
          }
        }
      };

      checkField(entry.subjectCode, 'subjectCode', 2.0);
      checkField(entry.offerCode, 'offerCode', 2.0);
      checkField(entry.subjectDescription, 'subjectDescription', 1.5);
      checkField(entry.assignedTeacherName, 'assignedTeacherName', 1.2);
      checkField(entry.room || '', 'room', 1.2);
      checkField(entry.program, 'program', 1.0);
      checkField(entry.programShorthand, 'programShorthand', 1.0);
      checkField(entry.year, 'year', 1.0);
      checkField(entry.section, 'section', 1.0);
      checkField(entry.department || '', 'department', 1.0);

      entry.schedules.forEach((s) => {
        s.days.forEach((day) => checkField(day, 'day', 0.8));
        checkField(s.startTime, 'startTime', 0.8);
        checkField(s.endTime, 'endTime', 0.8);
      });

      return {
        entry,
        score,
        matchedFields
      };
    })
    .filter((res) => res.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((res) => res.entry);

  self.postMessage(results);
};
