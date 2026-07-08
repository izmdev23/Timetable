/** Days of the week available for scheduling */
export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export const DAY_ORDER: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** A single time-slot entry within a subject's schedule */
export interface Schedule {
  id: string;
  /** Selected days for this time slot */
  days: DayOfWeek[];
  /** "HH:mm" 24-hour format */
  startTime: string;
  /** "HH:mm" 24-hour format */
  endTime: string;
  /** Rooms assigned specifically for this schedule slot */
  rooms: string[];
  assignedTeacherName?: string;
}

/** A complete subject entry with one or more schedules */
export interface SubjectEntry {
  id: string;
  subjectCode: string;
  offerCode: string;
  subjectDescription: string;
  /** Teacher assigned to conduct the class */
  assignedTeacherName: string;
  room?: string;
  schedules: Schedule[];
  color?: string;
  program: string;
  year: number;
  section: string;
  department?: string;
}

/** Describes a detected conflict between two scheduled entries */
export interface ConflictInfo {
  type: 'teacher' | 'room' | 'time';
  conflictingEntry: SubjectEntry;
  day: DayOfWeek;
  startTime: string;
  endTime: string;
}

/** Flat cell data used by TimetableGrid for rendering */
export interface TimetableCell {
  entry: SubjectEntry;
  schedule: Schedule;
  day: DayOfWeek;
}

/** Metadata for a saved timetable, returned by the Tauri backend */
export interface TimetableMeta {
  id: string;
  name: string;
  entryCount: number;
  createdAt: string;
  updatedAt: string;
  hiddenDays: DayOfWeek[];
}

/** Form schedules for state history tracking */
export interface FormSchedule {
  days: DayOfWeek[];
  timeRange: [string, string] | null; // HH:mm format
  rooms: string[];
}

/** Form state structure for state history tracking */
export interface FormState {
  subjectCode: string;
  offerCode: string;
  subjectDescription: string;
  room?: string[];
  colorRandom: boolean;
  color: string;
  schedules: FormSchedule[];
  program: string;
  year: string;
  section: string;
  department?: string;
}

