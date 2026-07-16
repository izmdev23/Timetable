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
  /** When set, marks this entry as a placed instance derived from a blueprint */
  blueprintId?: string;
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

/** A timetable within a .ttcl collection */
export interface CollectionTimetable {
  id: string;
  name: string;
  blueprints: SubjectEntry[];
  instances: SubjectEntry[];
  hiddenDays: DayOfWeek[];
  theme: string;
  bandedRows: boolean;
  createdAt: string;
  updatedAt: string;
  dynamicData: DynamicData[];
}

/** The .ttcl collection file format (Base64 encoded when saved to disk) */
export interface CollectionFile {
  version: 1;
  timetables: CollectionTimetable[];
}

/** Dynamic data entry (departments, instructors, rooms, etc.) */
export interface DynamicData {
  id: string;
  dataType: string;
  value: string;
  displayAs: string;
}

/** A recent collection entry stored in localStorage */
export interface CollectionRecord {
  name: string;
  path: string;
  timetableCount: number;
  lastOpened: string;
}

/** Form schedules for state history tracking */
export interface FormSchedule {
  days: DayOfWeek[];
  timeRange: [string, string] | null; // HH:mm format
  rooms: string[];
  /** Preserved schedule ID when editing, so links survive form-based edits */
  id?: string;
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

/** ── Collaboration & Commit History Types ── */

export interface PermissionSet {
  all: boolean;
  write: boolean;
  delete: boolean;
  create: boolean;
}

export interface CollabUser {
  clientId: string;
  userName: string;
  color: string;
  permissions: PermissionSet;
  joinedAt: number;
  isHost: boolean;
}

export interface CommitRecord {
  id: string;
  timetableId: string;
  actionType: string;
  actionJson: string;
  description: string;
  author: string;
  authorId: string;
  timestamp: number;
  isUndo: boolean;
  undoneCommitId: string | null;
}

export interface CollabAction {
  op:
    | 'addBlueprint'
    | 'addInstance'
    | 'addInstances'
    | 'updateInstance'
    | 'deleteBlueprint'
    | 'deleteBlueprints'
    | 'deleteInstance'
    | 'setHiddenDays'
    | 'updateTheme'
    | 'updateBandedRows'
    | 'addDynamicData'
    | 'deleteDynamicData'
    | 'updateDynamicData'
    | 'addLinksBatched'
    | 'mergeEntries'
    | 'mergeBlueprints'
    | 'addBlueprints'
    | 'addBlueprintsAndInstances'
    | 'undo';
  payload: Record<string, unknown>;
}

export interface CollabState {
  blueprints: SubjectEntry[];
  instances: SubjectEntry[];
  dynamicData: DynamicData[];
  hiddenDays: DayOfWeek[];
  theme: string;
  bandedRows: boolean;
  filePath: string | null;
}

export interface CollabServerStatus {
  running: boolean;
  port: number;
  peer_count: number;
}

export type ConnectionQuality = 'good' | 'degraded' | 'disconnected';

