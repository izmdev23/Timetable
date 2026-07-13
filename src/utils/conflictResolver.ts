import type { SubjectEntry, ConflictInfo, DynamicData, Schedule } from '../types';

export interface ResolveRoomParams {
  schedule: Schedule;
  candidateEntry: SubjectEntry;
  instancesToAdd: SubjectEntry[];
  storeInstances: SubjectEntry[];
  dynamicData: DynamicData[];
  detectConflicts: (candidate: SubjectEntry, againstEntries?: SubjectEntry[]) => ConflictInfo[];
  rowRooms: string[];
  blueprintBuilding: string;
  autoFixConflicts: boolean;
  allowAnyRoom: boolean;
  limitToBuilding: boolean;
  roomIndex: number;
}

export interface ResolveRoomResult {
  roomVal: string;
  nextRoomIndex: number;
  isAutoPicked: boolean;
}

/**
 * Resolves a room assignment for a schedule, checking for conflicts and attempting auto-fix if configured.
 * 
 * @param params The parameters for room resolution.
 * @returns The resolved room value, the next room index pointer, and whether a system room was auto-picked.
 */
export function resolveRoomForSchedule(params: ResolveRoomParams): ResolveRoomResult {
  const {
    schedule,
    candidateEntry,
    instancesToAdd,
    storeInstances,
    dynamicData,
    detectConflicts,
    rowRooms,
    blueprintBuilding,
    autoFixConflicts,
    allowAnyRoom,
    limitToBuilding,
    roomIndex,
  } = params;

  const againstEntries = [...storeInstances, ...instancesToAdd];

  const checkRoomConflict = (roomName: string): boolean => {
    const fullRoom = roomName && blueprintBuilding ? `${roomName}|${blueprintBuilding}` : roomName;
    const tempSched: Schedule = {
      ...schedule,
      rooms: fullRoom ? [fullRoom] : [],
    };
    const tempEntry: SubjectEntry = {
      ...candidateEntry,
      room: fullRoom || '',
      schedules: [tempSched],
    };

    const conflicts = detectConflicts(tempEntry, againstEntries);
    return conflicts.some((c) => c.type === 'room');
  };

  if (rowRooms.length === 0) {
    return { roomVal: '', nextRoomIndex: roomIndex, isAutoPicked: false };
  }

  if (!autoFixConflicts) {
    const firstRoom = rowRooms[0];
    const fullRoom = firstRoom && blueprintBuilding ? `${firstRoom}|${blueprintBuilding}` : firstRoom;
    return { roomVal: fullRoom, nextRoomIndex: roomIndex, isAutoPicked: false };
  }

  // Try rooms in CSV list starting from roomIndex
  for (let i = roomIndex; i < rowRooms.length; i++) {
    const room = rowRooms[i];
    if (!checkRoomConflict(room)) {
      const fullRoom = room && blueprintBuilding ? `${room}|${blueprintBuilding}` : room;
      return { roomVal: fullRoom, nextRoomIndex: i + 1, isAutoPicked: false };
    }
  }

  // If no room found and allowAnyRoom is true, search system rooms
  if (allowAnyRoom) {
    let targetBuilding = blueprintBuilding || '';
    if (!targetBuilding && limitToBuilding && rowRooms.length > 0) {
      const firstRoomName = rowRooms[0].toLowerCase();
      const existingRoom = dynamicData.find(
        (d) => d.dataType === 'room' && d.value.toLowerCase() === firstRoomName
      );
      if (existingRoom) {
        const parts = existingRoom.displayAs.split('|');
        targetBuilding = parts[1] || 'External';
      }
    }

    const csvRoomNamesLower = new Set(rowRooms.map((r) => r.toLowerCase()));
    const candidateSystemRooms = dynamicData.filter((d) => {
      if (d.dataType !== 'room') return false;
      if (csvRoomNamesLower.has(d.value.toLowerCase())) return false;
      
      if (limitToBuilding && targetBuilding) {
        const parts = d.displayAs.split('|');
        const bldg = parts[1] || 'External';
        return bldg.toLowerCase() === targetBuilding.toLowerCase();
      }
      return true;
    });

    for (const sysRoom of candidateSystemRooms) {
      if (!checkRoomConflict(sysRoom.value)) {
        const parts = sysRoom.displayAs.split('|');
        const roomBldg = parts[1] || blueprintBuilding || '';
        const fullRoom = roomBldg ? `${sysRoom.value}|${roomBldg}` : sysRoom.value;
        return { roomVal: fullRoom, nextRoomIndex: roomIndex, isAutoPicked: true };
      }
    }
  }

  // Fallback to first room in CSV
  const fallbackRoom = rowRooms[0];
  const fullFallback = fallbackRoom && blueprintBuilding ? `${fallbackRoom}|${blueprintBuilding}` : fallbackRoom;
  return { roomVal: fullFallback, nextRoomIndex: roomIndex, isAutoPicked: false };
}
