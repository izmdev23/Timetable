# ttcl real-time collab via react-use-websocket

**Session ID:** ses_0a1c638e9ffeEh7C4D5kPN2uIL
**Created:** 7/14/2026, 9:24:32 AM
**Updated:** 7/14/2026, 10:41:58 AM

---

## User

i want to implement a colloration feature where i can host my opened ttcl file over local network. then other users can access and modify my file. i can also see what they are modifying in real time.

when in collaboration mode, our screens will be independent but what modifications on the ttcl file will be seen by all users.

libraries to use:
- react-use-websocket will be used for live data streaming. do not use raw websockets

give me clarifications if exists. give me improvements to the current implementation. provide optimization improvements and quality of life features to the implementation

---

## Assistant (Plan · DeepSeek V4 Flash Free · 88.5s)

_Thinking:_

The user wants to implement a collaboration feature for their Timetable application. Let me break down the requirements:

1. Host a .ttcl file over local network
2. Other users can access and modify the file
3. Real-time viewing of modifications
4. Independent screens but shared modifications
5. Use `react-use-websocket` library

They're asking for:
- Clarifications if needed
- Improvements to their current implementation
- Optimization improvements and quality of life features

Since this is plan mode, I need to explore the codebase first to understand the current architecture before providing a plan. Let me explore the key files to understand the project structure, data flow, and current implementation.

Let me start by exploring the codebase to understand:
1. Project structure
2. How the timetable data is managed (stores, state)
3. How data is persisted (SQLite, file operations)
4. The current undo/redo system
5. How the app handles file operations (open, save)

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\Dev\\Projects\\Timetable"
}
```

**Output:**
```
<path>C:\Dev\Projects\Timetable</path>
<type>directory</type>
<entries>
.git/
.github/
.gitignore
.oxlintrc.json
AGENTS.md
dist/
index.html
node_modules/
package-lock.json
package.json
public/
README.md
session-ses_0a6a.md
src-tauri/
src/
tsconfig.app.json
tsconfig.json
tsconfig.node.json
vite.config.ts

(19 entries)
</entries>
```

**Tool: task**

**Input:**
```json
{
  "description": "Explore project architecture",
  "prompt": "Explore the codebase at C:\\Dev\\Projects\\Timetable to understand the project architecture. I need to understand:\n\n1. The project structure (src/ layout, key directories)\n2. The state management system - how is timetable data stored and modified? Look at zustand stores, especially useTimetableStore\n3. How undo/redo works\n4. How file operations work (open/save of .ttcl files)\n5. How data flows from UI to SQLite/backend\n6. The App.tsx routing and window detection\n7. Any existing networking or IPC code\n\nBe very thorough. Read all key files in src/ including stores, hooks, components, and the utils. Also read src-tauri/src/lib.rs for the Rust backend. Return a comprehensive summary of:\n- All store actions and state shape\n- How modifications are applied to the timetable\n- The file format/structure of .ttcl files\n- How the app currently handles concurrency or multi-user scenarios\n- The dependency list (package.json)\n- The Tauri capabilities and commands",
  "subagent_type": "explore"
}
```

**Output:**
```
<task id="ses_0a1c615e8ffeExmKdO3YiEufJy" state="completed">
<task_result>
Now I have a thorough understanding of the entire codebase. Here is the comprehensive summary.

---

## Comprehensive Codebase Summary: Timetable v1.4.0

### 1. Project Structure

```
C:\Dev\Projects\Timetable\
├── src/                          # React/TypeScript frontend
│   ├── main.tsx                  # Entry point, StrictMode, ErrorBoundary, ConfigProvider
│   ├── App.tsx                   # Root router, window detection, keyboard shortcuts, event wiring
│   ├── types.ts                  # All TypeScript interfaces/types
│   ├── theme.ts                  # Ant Design theme config (5 built-in themes + custom)
│   ├── index.css                 # Global CSS
│   ├── declarations.d.ts         # Ambient type declarations
│   ├── pages/
│   │   ├── HomePage.tsx          # Collection management (create/open/close/recent)
│   │   ├── TimetablePage.tsx     # Main editor (~2600 lines, handles all editing operations)
│   │   ├── PreferencesPage.tsx   # Settings page (export options)
│   │   └── BlueprintFormWindow.tsx  # Standalone subject-form window
│   ├── components/
│   │   ├── TitleBar.tsx          # Custom frameless title bar with File menu + window controls
│   │   ├── RibbonToolbar.tsx     # Main toolbar: save/undo, insert, filters, theme, days, cell sizing
│   │   ├── TimetableGrid.tsx     # The visual timetable grid (~1367 lines)
│   │   ├── BlueprintList.tsx     # Left sidebar list of blueprint subjects
│   │   ├── BlueprintForm.tsx     # Subject entry form (add/edit blueprint)
│   │   ├── EntryFormModal.tsx    # Draggable modal wrapper for BlueprintForm
│   │   ├── PlacedSchedules.tsx   # Right panel listing placed schedule blocks
│   │   ├── SchedulePropertiesPanel.tsx  # Right panel for editing a single schedule block
│   │   ├── StatusBar.tsx         # Bottom status bar with room selector, conflict count, linking
│   │   ├── ExportButton.tsx      # Simple XLSX export button
│   │   ├── ColumnMappingForm.tsx # Excel import column mapping UI
│   │   └── DocxTemplatePreview.tsx # DOCX template preview with marquee positioning (~1371 lines)
│   ├── hooks/
│   │   ├── useTimetableStore.ts  # **Core state management** (~1276 lines)
│   │   ├── useTimetableList.ts   # Home page timetable list CRUD via SQLite
│   │   ├── useCollectionContext.tsx  # React context for .ttcl collection operations
│   │   ├── useSubjectSearch.ts   # Web Worker-based blueprint search
│   │   └── useBlueprintSearch.ts # Web Worker-based blueprint search (duplicate variant)
│   ├── context/
│   │   └── PreferencesContext.tsx # Simple localStorage-backed preferences
│   └── utils/
│       ├── collection.ts         # .ttcl file encode/decode, load/save collection
│       ├── linkUtils.ts          # Graph-based schedule block linking utilities
│       ├── conflictResolver.ts   # Room conflict resolution algorithm for Excel import
│       ├── teacherName.ts        # Teacher name parsing (JSON, comma-separated, etc.)
│       ├── autoDetectColumns.ts  # Fuzzy column detection for Excel import headers
│       ├── searchWorker.ts       # Web Worker for fuzzy search scoring
│       ├── exportXlsx.ts         # XLSX export via exceljs (~331 lines)
│       ├── exportDocx.ts         # DOCX template insertion via JSZip (~351 lines)
│       └── time.ts               # Time formatting utilities
├── src-tauri/                    # Tauri 2.x Rust backend
│   ├── src/lib.rs                # Migration definitions (7 migrations) + 5 Tauri commands
│   ├── tauri.conf.json           # Window config, file associations, bundle settings
│   └── capabilities/default.json # Permission grants for windows, SQL, dialog, fs
├── package.json                  # Dependencies (see below)
├── vite.config.ts                # Vite 8 config
├── tsconfig.json                 # Project references (tsconfig.app.json + tsconfig.node.json)
└── tsconfig.app.json             # Path alias: @/ -> src/
```

---

### 2. State Management: `useTimetableStore`

This is the central hook (not a Zustand store despite the name -- it is a vanilla React hook using `useState`/`useCallback`). It is instantiated per-timetable in `TimetablePage`.

#### State Shape

| Field | Type | Persistence |
|---|---|---|
| `blueprints` | `SubjectEntry[]` | SQLite `timetables.entries_json` |
| `instances` | `SubjectEntry[]` | Same JSON blob (combined) |
| `hiddenDays` | `DayOfWeek[]` | SQLite `timetables.hidden_days` |
| `filePath` | `string \| null` | SQLite `timetables.file_path` |
| `theme` | `string` | SQLite `timetables.theme` |
| `bandedRows` | `boolean` | SQLite `timetables.banded_rows` |
| `dynamicData` | `DynamicData[]` | SQLite `dynamic_data` table |
| `editingEntryId` | `string \| null` | Memory only |
| `formState` | `FormState` | Memory only |
| `isDirty` | `boolean` | Memory (dispatches `store:dirty-change`) |
| `canUndo`, `canRedo` | `boolean` | Memory (dispatches `store:history-change`) |
| `columnWidths`, `rowHeights` | `Record<string, number>` | localStorage |
| `globalColWidth`, `globalRowHeight` | `number` | localStorage |
| `importedSuggestions` | `Array<...>` | `localStorage` keyed by `suggestions_${timetableId}` |

#### All Store Actions (returned from hook)

**Modification actions** (all call `commitState` which writes to SQLite + pushes history):
- `addBlueprint(entry)` -- prepend to blueprints array
- `addBlueprints(entries)` -- bulk prepend
- `addBlueprintsAndInstances(bps, insts)` -- add both at once
- `addInstance(entry)` -- prepend to instances, returns `ConflictInfo[]`
- `addInstances(entries)` -- bulk prepend, returns `ConflictInfo[][]`
- `updateInstance(entry, editedScheduleId?)` -- replaces entry by id, propagates linked schedule changes
- `deleteBlueprint(id)` -- removes blueprint + its instances + cleans links
- `deleteBlueprints(ids)` -- batch delete with link cleanup
- `deleteInstance(id)` -- removes single instance + cleans links
- `setHiddenDays(days)`

**Bulk import/merge:**
- `importEntries(jsonString)` -- replace all instances from JSON
- `mergeEntries(imported)` -- merge instances by subjectCode+offerCode, dedup schedules
- `mergeBlueprints(entries)` -- merge blueprints with update/skip logic
- `mergeDynamicData(entries)` -- merge dynamic data items
- `exportEntries()` -- JSON string of instances

**Dynamic data:**
- `addDynamicData(dataType, value, displayAs)` -- inserts into SQLite
- `addLinksBatched(links)` -- batch insert link rows
- `deleteDynamicData(id)` -- deletes from SQLite
- `updateDynamicData(id, dataType, value, displayAs)` -- updates SQLite

**Undo/Redo:**
- `undo()`, `redo()` -- navigate history stack, restores full snapshot (including dynamicData)
- `markSaved()` -- sets isDirty=false

**Form editing:**
- `startEdit(id)` -- loads blueprint into formState
- `cancelEdit()` -- resets form
- `updateFormState(state)` -- syncs form state to store

**Suggestions** (computed via `useMemo`):
- `suggestions.assignedTeacherNames`, `subjectCodes`, `offerCodes`, `rooms`, `subjectDescriptions`
- Built from blueprints + instances + importedSuggestions

**Cell sizing:**
- `commitCellSizes(newColumnWidths, newRowHeights)` -- persists to localStorage + history
- `applyGlobalCellSizing(width, height)` -- resets all to global values

---

### 3. How Modifications Are Applied

Every mutation flows through `commitState()`:

1. Updates all React state atoms (`setBlueprints`, `setInstances`, etc.)
2. Persists column/row sizes to `localStorage`
3. Sets `isDirty = true` and dispatches `store:dirty-change` event
4. If NOT an undo/redo operation: slices the history stack at the current index, appends a new `HistorySnapshot`, increments the index, and dispatches `store:history-change`
5. Compares the new combined JSON (`{ blueprints, instances }`) and hiddenDays JSON against the `lastSavedJsonRef`; if different, immediately writes to SQLite via:
   ```sql
   UPDATE timetables SET entries_json = $1, entry_count = $2, updated_at = $3, hidden_days = $4 WHERE id = $5
   ```

**Key quirk**: There is no debouncing or batching of SQLite writes. Every single add/update/delete triggers an immediate SQL write. This means rapid edits generate many individual SQL transactions.

---

### 4. Undo/Redo System

- **History stack**: `historyRef.current` is an array of `HistorySnapshot` objects
- **History index**: `historyIndexRef.current` points to the current state in the stack
- **Snapshot shape**:
  ```typescript
  interface HistorySnapshot {
    blueprints: SubjectEntry[];
    instances: SubjectEntry[];
    editingEntryId: string | null;
    formState: FormState;
    dynamicData: DynamicData[];
    columnWidths: Record<string, number>;
    rowHeights: Record<number, number>;
    globalColWidth: number;
    globalRowHeight: number;
  }
  ```
- **Push**: On every non-undo/redo mutation, `commitState` slices `[0..index+1]`, appends the new snapshot, and advances the index. Maximum history size is unbounded (all memory).
- **Undo**: Decrements index, restores snapshot via `commitState(isUndoRedoOperation=true)`, syncs `dynamicData` via `syncDynamicData()` (deletes all + re-inserts), dispatches `timetable:history-focus` with old/new state.
- **Redo**: Increments index, otherwise same as undo.
- **UI feedback**: The `TimetablePage` runs an animation (10 steps x 80ms = 800ms) before calling undo/redo, showing a loading modal with progress bar.
- **Dirty tracking**: isDirty compares `lastSavedJsonRef` against the current JSON. Saving resets it. Undo/redo that changes data will re-set isDirty=true.
- **Persistence**: History is ONLY in-memory. Refreshing the page or switching timetables loses undo history.

---

### 5. File Operations (.ttcl Collection Files)

#### File Format

`.ttcl` files are **Base64-encoded JSON** with this structure:

```typescript
interface CollectionFile {
  version: 1;
  timetables: CollectionTimetable[];
}

interface CollectionTimetable {
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
```

Encoding: `btoa(encodeURIComponent(JSON.stringify(data)))` on save, reversed on load.

#### Save Flow (Ctrl+S / File > Save)

1. `TimetablePage` detects `saveTrigger` increment
2. If `collection.collectionPath` is set: calls `collection.saveCollection()` which reads all timetables from SQLite via `saveDbToCollectionFile()`, serializes to `.ttcl` format, encodes as Base64, and writes via `invoke('save_file_bytes', { path, bytes })`
3. If no path: opens a save dialog asking for a `.ttcl` path, then calls `saveCollectionAs`
4. After save, calls `store.markSaved()` to clear dirty flag

#### Open Flow (Ctrl+O / File > Open)

1. Opens file dialog for `.ttcl`
2. Calls `collection.openCollection(path)`:
   - Clears SQLite `timetables` and `dynamic_data` tables
   - Reads file via `invoke('read_text_file', { path })`
   - Decodes Base64 -> JSON
   - For each timetable in the file, `INSERT OR REPLACE INTO timetables`
   - For each dynamicData entry, `INSERT OR REPLACE INTO dynamic_data`
3. Returns `TimetableMeta[]`; opens the first one

#### CLI / File Association

- `tauri.conf.json` registers `.ttcl` file association
- Rust command `get_opened_file()` scans CLI args for a `.ttcl` path or `--file=path.ttcl`
- `App.tsx` calls this on mount; if a file is found, it opens the collection directly

---

### 6. Data Flow: UI -> SQLite/Backend

```
User Action (click, drag, edit)
  -> TimetablePage / component calls store method (e.g., store.addInstance(entry))
    -> store method calls commitState(newBlueprints, newInstances, ...)
      -> commitState:
          1. Updates React state (setBlueprints, setInstances, etc.)
          2. Pushes history snapshot
          3. Serializes {blueprints, instances} to JSON
          4. Compares with lastSavedJsonRef (optimization to skip identical writes)
          5. Executes SQL directly: getDb().execute('UPDATE timetables SET ...')
             (Database is imported from @tauri-apps/plugin-sql - SQLite runs in a Rust background thread,
              but the SQL query is sent from the frontend via Tauri IPC)
```

For file I/O:
```
Save to .ttcl:
  store state (in SQLite) -> saveDbToCollectionFile() reads all rows
  -> serializes to CollectionFile JSON
  -> encodeCollection() -> Base64 string
  -> invoke('save_file_bytes', { path, bytes })
    -> Rust tokio::fs::write()
```

```
Open .ttcl:
  invoke('read_text_file', { path })
    -> Rust tokio::fs::read_to_string()
  -> decodeCollection() -> CollectionFile
  -> INSERT INTO timetables / INSERT INTO dynamic_data
```

**The Rust backend is minimal** -- it only provides:
1. `save_file_bytes(path, bytes)` -- write binary file
2. `read_file_bytes(path)` -- read binary file (used for DOCX templates)
3. `read_text_file(path)` -- read text file
4. `file_exists(path)` -- check existence
5. `resolve_default_path(app, filename)` -- get Documents directory path
6. `get_opened_file()` -- check CLI args for .ttcl

All SQL runs on the frontend via `@tauri-apps/plugin-sql`. The Rust side only provides the connection pool + schema migrations.

---

### 7. App.tsx Routing and Window Detection

```typescript
// At module level:
let initialIsFormWindow = false;
try {
  initialIsFormWindow = getCurrentWindow().label === 'subject-form';
} catch (e) { /* browser fallback */ }

function App() {
  if (initialIsFormWindow) {
    return <BlueprintFormWindow />;
  }
  return (
    <PreferencesProvider>
      <CollectionProvider>
        <AppInner />
      </CollectionProvider>
    </PreferencesProvider>
  );
}
```

- **Two Tauri windows**: `main` (the main editor) and `subject-form` (popup form)
- **Routing**: Simple state-based: `page` can be `'home' | 'timetable' | 'preferences'`
- **Navigation**: Controlled via `setPage()` in `AppInner`
- **subject-form window**: Opens via Tauri webview window creation; communicates via Tauri events:
  - `subject-form:ready` -- emitted by form window when mounted
  - `subject-form:init` -- main window sends initial data payload
  - `subject-form:submit` -- form sends back the submitted entry
  - `subject-form:closed` -- emitted when form window closes
  - `subject-form:success` -- emitted on successful submission
  - `subject-form:conflict` -- main window sends conflict info back to form
  - `subject-form:state-change` -- form syncs state changes back to main window

---

### 8. Concurrency / Multi-User Scenarios

**There are none.** The app is strictly single-user, single-instance:

- SQLite is a local file (`timetable.db` in the app data directory)
- No locking, no conflict resolution, no sync
- The `.ttcl` file format has no versioning other than `version: 1`
- No network requests, no server, no collaboration features
- Undo/redo is purely in-memory (lost on navigation/refresh)
- The only "sharing" mechanism is exporting `.ttcl` or `.json` files and manually importing them

---

### 9. Schedule Block Linking System

This is the most complex feature. It allows linking schedule blocks so that editing one propagates changes to linked blocks:

- **Storage**: Special `dynamicData` entries with `dataType: 'link'`, where `value` = child key and `displayAs` = parent key
- **Key format**: `"${entryId}:${scheduleId}"`
- **Graph traversal**: `getConnectedKeys()` in `linkUtils.ts` builds an adjacency graph and does BFS to find all connected blocks
- **Propagation**: When `updateInstance()` is called with `editedScheduleId`, it finds all connected keys via BFS and propagates `subjectCode`, `offerCode`, `subjectDescription`, `assignedTeacherName`, `department`, `program`, `year`, `section`, `color`, and the schedule-level `assignedTeacherName`
- **Visualization**: SVG lines are drawn between linked blocks via DOM manipulation (not React state), positioned using `getBoundingClientRect()` with GSAP

---

### 10. Dependency List (package.json)

**Dependencies:**
| Package | Version | Purpose |
|---|---|---|
| `@ant-design/icons` | ^6.3.2 | Icon library |
| `@tauri-apps/api` | ^2.11.1 | Tauri IPC, window, event APIs |
| `@tauri-apps/plugin-dialog` | ^2.7.1 | Native file dialogs + message boxes |
| `@tauri-apps/plugin-fs` | ^2.5.1 | Filesystem access (unused directly, but capability granted) |
| `@tauri-apps/plugin-sql` | ^2.4.0 | SQLite from frontend |
| `@uiw/react-color` | ^2.10.3 | Color picker (Sketch picker) |
| `antd` | ^6.5.0 | UI component library |
| `dayjs` | ^1.11.21 | Date/time handling for TimePicker |
| `docx-preview` | ^0.4.0 | DOCX preview rendering |
| `exceljs` | ^4.4.0 | XLSX reading/writing |
| `gsap` | ^3.15.0 | Animations (drag ghost, fade transitions) |
| `html-to-image` | ^1.11.13 | Capture timetable grid as PNG for DOCX export |
| `jszip` | ^3.10.1 | DOCX file (ZIP) manipulation |
| `react` | ^19.2.7 | UI framework |
| `react-dom` | ^19.2.7 | DOM renderer |
| `xlsx` | ^0.18.5 | Alternative XLSX library (legacy) |

**Dev Dependencies:**
| Package | Version | Purpose |
|---|---|---|
| `@tauri-apps/cli` | ^2.11.4 | Tauri CLI |
| `@types/node` | ^24.13.2 | Node types |
| `@types/react` | ^19.2.17 | React types |
| `@types/react-dom` | ^19.2.3 | React DOM types |
| `@vitejs/plugin-react` | ^6.0.3 | Vite React plugin |
| `oxlint` | ^1.71.0 | Linter (NOT eslint) |
| `typescript` | ~6.0.2 | TypeScript compiler |
| `vite` | ^8.1.1 | Build tool |

---

### 11. Tauri Capabilities and Commands

**`capabilities/default.json`** grants these permissions to both `main` and `subject-form` windows:
- `core:default` -- core Tauri APIs
- `core:window:default` + window control (minimize, maximize, close, start-dragging, is-maximized, show, set-focus)
- `core:webview:allow-create-webview-window` -- needed for opening the subject-form window
- `sql:allow-execute`, `sql:allow-select`, `sql:allow-load` -- SQL plugin
- `dialog:default` -- file dialogs + message boxes
- `fs:default` -- filesystem access
- `window-state:default` -- persist window position/size

**Rust commands** (registered in `tauri::generate_handler!`):
| Command | Signature | Purpose |
|---|---|---|
| `save_file_bytes` | `(path: String, bytes: Vec<u8>) -> Result<(), String>` | Write raw bytes to file |
| `read_file_bytes` | `(path: String) -> Result<Vec<u8>, String>` | Read raw bytes from file |
| `read_text_file` | `(path: String) -> Result<String, String>` | Read UTF-8 text file |
| `file_exists` | `(path: String) -> bool` | Check if file exists |
| `resolve_default_path` | `(app: AppHandle, filename: String) -> Result<String, String>` | Resolve Documents directory path |
| `get_opened_file` | `() -> Option<String>` | Get .ttcl file from CLI args |

**SQLite migrations** (7 total, applied in order by `tauri_plugin_sql`):
1. Create `timetables` table (id, name, entries_json, entry_count, created_at, updated_at)
2. Add `hidden_days` column
3. Add `file_path` column
4. Add `theme` column
5. Add `banded_rows` column
6. Create `dynamic_data` table (id, data_type, value, display_as)
7. Add `timetable_id` column to `dynamic_data`

**Tauri app config:**
- Window: 1280x800, min 900x600, no decorations (custom titlebar), resizable
- File associations: `.ttcl` -> "Timetable Collection File"
- CSP: null (disabled)
</task_result>
</task>
```

---

## Assistant (Plan · DeepSeek V4 Flash Free · 40.2s)

_Thinking:_

Now I have a thorough understanding of the codebase. Let me plan the collaboration feature.

Key observations:
1. The app uses Tauri with SQLite (frontend sends SQL directly)
2. No networking infrastructure exists
3. The store is a React hook with `useState`/`useCallback` (not Zustand, despite the name)
4. The user explicitly wants to use `react-use-websocket`
5. We need a server component (the "host") and client connections

Let me think about the architecture:

### Collaboration Architecture

**Requirements:**
1. Host opens a .ttcl file in collaboration mode
2. Other users on the local network can connect
3. Modifications are synced in real-time
4. Screens are independent (scrolling, zoom, etc.) but data is shared
5. Use `react-use-websocket` library

**Architecture Options:**

**Option A: Peer-to-Peer (WebRTC)**
- Complex to set up
- Requires signaling server
- `react-use-websocket` doesn't support WebRTC

**Option B: Host-as-server (WebSocket server in Tauri or Node.js)**
- The host runs a simple WebSocket server
- `react-use-websocket` connects clients to it
- Tauri could spawn a WebSocket server, but there's no Rust WebSocket dependency currently
- Could use Node.js, but that's not in the project

**Option C: Hybrid - External collaboration server**
- Users connect to a shared server
- Requires setting up and deploying a server

**My recommendation: Option B - Host-as-server within the Tauri app**

Wait, but `react-use-websocket` is a React client library. We'd need a WebSocket server. In a Tauri app, we could:
1. Run a WebSocket server process (but requires adding dependencies)
2. Use Tauri's Rust side to run a WebSocket server (requires `tokio-tungstenite` or similar)

Actually, let me reconsider. The user said "react-use-websocket will be used for live data streaming". This suggests they want the React side to use it as a client. But we still need a server.

For the server, since this is a Tauri app, we have a few choices:
1. **Embed a lightweight WebSocket server in Rust** - Add `tokio-tungstenite` to the Rust backend
2. **Use a separate Node.js server** - Not ideal
3. **Use a peer-to-peer solution** - More complex

I think adding a WebSocket server in the Rust backend is the most elegant approach. The host would run a WebSocket server on a local port, and clients would connect to it.

Let me think about the data flow:

```
Host:
  User makes edit -> store.update() -> apply locally -> broadcast via WebSocket server to all clients

Client:
  Receives WebSocket message -> apply to local store (without re-broadcasting)
```

**What data to sync:**
Since modifications go through the store, we need to sync the operations themselves. Options:

1. **Sync full state snapshots** - Simple but wasteful
2. **Sync operations (CRUD actions)** - More efficient, but requires replay logic
3. **Sync the SQLite changes** - Complex, requires DB-level syncing

I recommend **syncing operations** (Option 2) - broadcast the store action + its parameters, and clients replay the action locally.

Wait, but there's a complexity: undo/redo. If a host performs undo, the clients need to know. Similarly, if a client makes an edit, it becomes part of the host's history.

**Important design decisions to clarify with the user:**

1. **Who can edit?** Can clients edit, or only the host? The user said "other users can access and modify my file" - so everyone can modify.
2. **Undo/redo scope**: Does each user have their own undo history, or is undo global? Since undo/redo is in-memory, it should probably be per-user.
3. **Conflict resolution**: What happens if two users edit the same item simultaneously?
4. **Host identity**: How does the host start the server? How do clients discover the host's IP?
5. **Authentication**: Any password/authentication for the collaboration session?

Let me now design the full implementation plan.

### Full Plan

#### 1. Rust Backend: WebSocket Server
- Add `tokio-tungstenite` and `futures-util` to Cargo.toml
- Create a WebSocket server in Rust that:
  - Listens on a configurable port (default e.g., 9182)
  - Accepts multiple client connections
  - Broadcasts messages from any one client to all other clients (including the host's own React app via a local connection)
  - Can be started/stopped via Tauri commands
- Tauri commands:
  - `start_collab_server(port: u16)` - starts the WS server
  - `stop_collab_server()` - stops the server
  - `get_collab_server_status()` - returns running/not running + connection count
  - `get_local_ip()` - returns the host's local IP address

Actually, wait. The Rust side and the React side communicate via Tauri commands/events. But the React app also needs to connect to the WebSocket server. If the server runs on the Rust side, the React app connects as a WebSocket client to `ws://localhost:PORT`.

But there's a complication: the Rust server needs to forward messages to all connected clients, including the server's own UI. If the React app connects as a client to `localhost`, it will receive messages via `react-use-websocket` just like any other client.

#### 2. React Frontend: Collaboration Manager Hook
- Create `useCollaboration.ts` hook that:
  - Uses `react-use-websocket` to connect to the server
  - Provides `hostSession()`, `joinSession(url)`, `leaveSession()` actions
  - On receiving a remote modification, applies it to the local store
  - On local modification, broadcasts it to all connected clients
  - Tracks connected users (user list)
  - Provides session status (connected/disconnected, user count, latency)

#### 3. Store Integration
- Modify `commitState` or add a middleware to detect if collaboration is active
- When in collaboration mode, after applying a local change, broadcast the action via WebSocket
- When receiving a remote change, apply it to the store (without re-broadcasting)

Wait, but the store is per-timetable. The collaboration should be per-timetable as well. Let me think about this more carefully.

Actually, since all changes go through `commitState`, we could instrument it to:
1. If collaboration is active AND the change originated locally: broadcast the action
2. If collaboration is active AND the change originated remotely: apply silently (no broadcast)

But we need to prevent infinite loops (client A broadcasts, client B receives and applies, client B's store broadcast triggers again, client A receives...). We need a flag like `isRemoteUpdate` to suppress broadcasting.

#### 4. UI Components
- **CollabBar**: A panel/bar showing connection status, connected users, etc.
- **HostDialog**: Modal to start a session (shows IP, port, session ID)
- **JoinDialog**: Modal to enter host IP/port to join
- **UserAvatarList**: Shows connected users with names/colors
- **RemoteCursor/Highlight**: Shows what other users are editing (optional, nice-to-have)

#### 5. Data Protocol

WebSocket messages will be JSON:

```typescript
// From client to server (and broadcasted)
type CollabMessage = 
  | { type: 'user:join', userId: string, userName: string }
  | { type: 'user:leave', userId: string }
  | { type: 'action', action: StoreAction, userId: string, timestamp: number, actionId: string }
  | { type: 'cursor', userId: string, position: { x: number, y: number } }
  | { type: 'state:sync' }  // Request full state
  | { type: 'state:full', state: FullState }  // Full state snapshot for new clients

type StoreAction = 
  | { type: 'addBlueprint', payload: { entry: SubjectEntry } }
  | { type: 'addInstance', payload: { entry: SubjectEntry } }
  | { type: 'updateInstance', payload: { entry: SubjectEntry, editedScheduleId?: string } }
  | { type: 'deleteBlueprint', payload: { id: string } }
  | { type: 'deleteInstance', payload: { id: string } }
  | // ... etc
```

#### 6. New Users Joining
When a new user joins, they need the full current state. The flow:
1. New user connects to WebSocket
2. Client sends `{ type: 'state:sync' }` message
3. Server (or host client) responds with `{ type: 'state:full', state: { blueprints, instances, dynamicData, hiddenDays } }`
4. New user applies the full state locally

The host's React client is the authority for state. When a sync request comes in, the host responds with its current state.

Wait, but the server is in Rust. It doesn't know about the React state. So the flow should be:
1. New user connects to WS server
2. Server detects new connection and sends a notification to host's client via Tauri event
3. Host's client sends full state via WS (as a normal message)
4. New user receives and applies

Or simpler: the WS server could relay a `sync_request` message to the host's React client, which responds with `state:full`.

Actually, the simplest approach: the WS server is just a relay. It doesn't know about the application state. The host's React client is the "brain":
- When a new user connects, the server notifies everyone (including the host's React app)
- The host's React app sends `state:full` to the server, which relays it to the new user
- All mutations are broadcast by the host client

Wait, this gets complicated with multiple clients editing. Let me simplify:

**Simplified Protocol:**
- The WS server is a dumb relay (broadcasts messages from any client to all others)
- Each client has a `userId`
- When a client makes an edit, it broadcasts `{ type: 'action', ... }`
- All clients (including the sender) receive and apply the action
    - The sender uses the `actionId` to skip re-applying its own action
- When a new client joins, anyone can send `{ type: 'state:full', ... }` to the server (which relays to all, but the new client ignores it if already synced)

Hmm, this creates a problem: who sends the full state to a new joiner? The host should be responsible. But if any client can send it, there might be race conditions.

**Better approach:**
1. WS server is a dumb relay
2. When a client joins, it publishes `{ type: 'user:join', userId, userName }`
3. The host client (identified by a well-known userId e.g., 'host') responds with `{ type: 'state:full', targetUserId, ... }`
4. The target client ignores `state:full` messages not addressed to it
5. The host client periodically broadcasts its state (or on each change)

Actually, let's simplify even more:

**Simplest viable approach:**
- The WS server relays messages
- Each message includes `sourceUserId`
- Each client tracks which actions it has already applied (via `actionId` dedup)
- When a new client joins, someone sends `state:full` - the host is the designated sender
- After applying `state:full`, the new client is in sync
- From then on, all edits are broadcast as `action` messages
- `actionId` dedup prevents loops

For dedup: each client generates a unique `actionId` (e.g., `${userId}:${counter}`) for its local edits. When receiving a message with an `actionId` it has already seen, it skips it. This naturally prevents infinite loops and double-application.

#### 7. Conflict Resolution

For this initial implementation, I'd recommend **Last-Writer-Wins (LWW)**:
- Each action carries a timestamp
- If two conflicting actions arrive, the one with the later timestamp wins
- For CRUD operations, since each entity has a unique ID, conflicts are minimal:
  - `updateInstance`: last write wins
  - `deleteInstance`: if already deleted, ignore
  - `addBlueprint`: no conflict (just append)

This is simple and sufficient for a local network collaboration scenario.

#### 8. Cursor/Activity Indicators (QoL)
- Show which user is currently editing which subject/instance
- Show a colored border/indicator on items being edited by other users
- Show connected users in a bar

#### 9. Security Considerations
- Since it's local network only, minimal security is needed
- Optionally allow a simple password for the session
- The WebSocket server should only bind to LAN interfaces (not public)

### Questions for the User:

1. Should clients be able to edit the timetable, or only view? (User already said "modify")
2. Should there be a user identity system (names/colors)?
3. How should undo/redo work in collaboration mode? Per-user undo, or global?
4. Should we persist collaboration history (e.g., store actions in SQLite)?
5. Should the collaboration server be embedded in Rust, or could we use a lightweight Node.js sidecar?
6. What port should the WebSocket server use?
7. Should there be a "lock" mechanism to prevent concurrent edits on the same item?

Let me present a well-organized plan to the user.

Actually, I realize I should also check what dependencies are available and what Tauri plugins might help. Let me also check the Cargo.toml to see current Rust dependencies.

Let me present the plan now with clear questions.

Now let me check the Rust backend dependencies and Tauri config to understand what we're working with:

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\Dev\\Projects\\Timetable\\src-tauri\\Cargo.toml"
}
```

**Output:**
```
<path>C:\Dev\Projects\Timetable\src-tauri\Cargo.toml</path>
<type>file</type>
<content>
1: [package]
2: name = "app"
3: version = "1.3.0"
4: description = "A Tauri App"
5: authors = ["you"]
6: license = ""
7: repository = ""
8: edition = "2021"
9: rust-version = "1.77.2"
10: 
11: # See more keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html
12: 
13: [lib]
14: name = "app_lib"
15: crate-type = ["staticlib", "cdylib", "rlib"]
16: 
17: [build-dependencies]
18: tauri-build = { version = "2.6.3", features = [] }
19: 
20: [dependencies]
21: serde_json = "1.0"
22: serde = { version = "1.0", features = ["derive"] }
23: log = "0.4"
24: tauri = { version = "2.11.3", features = [] }
25: tauri-plugin-log = "2"
26: tauri-plugin-sql = { version = "2", features = ["sqlite"] }
27: tauri-plugin-dialog = "2"
28: tauri-plugin-fs = "2"
29: tauri-plugin-window-state = "2"
30: tokio = { version = "1", features = ["full"] }

(End of file - total 30 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\Dev\\Projects\\Timetable\\src-tauri\\src\\lib.rs"
}
```

**Output:**
```
<path>C:\Dev\Projects\Timetable\src-tauri\src\lib.rs</path>
<type>file</type>
<content>
1: use tauri_plugin_sql::{Migration, MigrationKind};
2: 
3: /// Schema migration: creates the timetables table on first run.
4: const MIGRATION_V1: Migration = Migration {
5:     version: 1,
6:     description: "create_timetables_table",
7:     sql: "CREATE TABLE IF NOT EXISTS timetables (
8:         id           TEXT PRIMARY KEY,
9:         name         TEXT NOT NULL,
10:         entries_json TEXT NOT NULL DEFAULT '[]',
11:         entry_count  INTEGER NOT NULL DEFAULT 0,
12:         created_at   TEXT NOT NULL,
13:         updated_at   TEXT NOT NULL
14:     );",
15:     kind: MigrationKind::Up,
16: };
17: 
18: const MIGRATION_V2: Migration = Migration {
19:     version: 2,
20:     description: "add_hidden_days",
21:     sql: "ALTER TABLE timetables ADD COLUMN hidden_days TEXT NOT NULL DEFAULT '[]';",
22:     kind: MigrationKind::Up,
23: };
24: 
25: const MIGRATION_V3: Migration = Migration {
26:     version: 3,
27:     description: "add_file_path",
28:     sql: "ALTER TABLE timetables ADD COLUMN file_path TEXT;",
29:     kind: MigrationKind::Up,
30: };
31: 
32: const MIGRATION_V4: Migration = Migration {
33:     version: 4,
34:     description: "add_theme",
35:     sql: "ALTER TABLE timetables ADD COLUMN theme TEXT DEFAULT 'blue';",
36:     kind: MigrationKind::Up,
37: };
38: 
39: const MIGRATION_V5: Migration = Migration {
40:     version: 5,
41:     description: "add_banded_rows",
42:     sql: "ALTER TABLE timetables ADD COLUMN banded_rows INTEGER DEFAULT 1;",
43:     kind: MigrationKind::Up,
44: };
45: 
46: const MIGRATION_V6: Migration = Migration {
47:     version: 6,
48:     description: "create_dynamic_data_table",
49:     sql: "CREATE TABLE IF NOT EXISTS dynamic_data (
50:         id          TEXT PRIMARY KEY,
51:         data_type   TEXT NOT NULL,
52:         value       TEXT NOT NULL,
53:         display_as  TEXT NOT NULL
54:     );",
55:     kind: MigrationKind::Up,
56: };
57: 
58: const MIGRATION_V7: Migration = Migration {
59:     version: 7,
60:     description: "add_timetable_id_to_dynamic_data",
61:     sql: "ALTER TABLE dynamic_data ADD COLUMN timetable_id TEXT;",
62:     kind: MigrationKind::Up,
63: };
64: 
65: #[tauri::command]
66: async fn save_file_bytes(path: String, bytes: Vec<u8>) -> Result<(), String> {
67:     tokio::fs::write(&path, bytes).await.map_err(|e| e.to_string())
68: }
69: 
70: #[tauri::command]
71: async fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
72:     tokio::fs::read(&path).await.map_err(|e| e.to_string())
73: }
74: 
75: #[tauri::command]
76: async fn read_text_file(path: String) -> Result<String, String> {
77:     tokio::fs::read_to_string(&path).await.map_err(|e| e.to_string())
78: }
79: 
80: #[tauri::command]
81: fn file_exists(path: String) -> bool {
82:     std::path::Path::new(&path).exists()
83: }
84: 
85: #[tauri::command]
86: fn resolve_default_path(app: tauri::AppHandle, filename: String) -> Result<String, String> {
87:     use tauri::Manager;
88:     let doc_dir = app.path().document_dir().map_err(|e| e.to_string())?;
89:     let full_path = doc_dir.join(filename);
90:     Ok(full_path.to_string_lossy().to_string())
91: }
92: 
93: #[tauri::command]
94: fn get_opened_file() -> Option<String> {
95:     let args: Vec<String> = std::env::args().collect();
96:     // Skip the first arg (the executable path), look for a .ttcl file argument
97:     for arg in args.iter().skip(1) {
98:         if arg.to_lowercase().ends_with(".ttcl") {
99:             return Some(arg.clone());
100:         }
101:         // Also check if it was passed as --file=path.ttcl
102:         if let Some(value) = arg.strip_prefix("--file=") {
103:             return Some(value.to_string());
104:         }
105:     }
106:     None
107: }
108: 
109: #[cfg_attr(mobile, tauri::mobile_entry_point)]
110: pub fn run() {
111:     tauri::Builder::default()
112:         .plugin(tauri_plugin_dialog::init())
113:         .plugin(tauri_plugin_fs::init())
114:         .plugin(tauri_plugin_window_state::Builder::default().build())
115:         .plugin(
116:             tauri_plugin_sql::Builder::default()
117:                 .add_migrations(
118:                     "sqlite:timetable.db",
119:                     vec![
120:                         MIGRATION_V1,
121:                         MIGRATION_V2,
122:                         MIGRATION_V3,
123:                         MIGRATION_V4,
124:                         MIGRATION_V5,
125:                         MIGRATION_V6,
126:                         MIGRATION_V7,
127:                     ],
128:                 )
129:                 .build(),
130:         )
131:         .setup(|app| {
132:             if cfg!(debug_assertions) {
133:                 app.handle().plugin(
134:                     tauri_plugin_log::Builder::default()
135:                         .level(log::LevelFilter::Info)
136:                         .build(),
137:                 )?;
138:             }
139:             Ok(())
140:         })
141:         .invoke_handler(tauri::generate_handler![
142:             save_file_bytes,
143:     read_text_file,
144:     read_file_bytes,
145:     file_exists,
146:             resolve_default_path,
147:             get_opened_file
148:         ])
149:         .run(tauri::generate_context!())
150:         .expect("error while running tauri application");
151: }

(End of file - total 151 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\Dev\\Projects\\Timetable\\src-tauri\\capabilities\\default.json"
}
```

**Output:**
```
<path>C:\Dev\Projects\Timetable\src-tauri\capabilities\default.json</path>
<type>file</type>
<content>
1: {
2:   "$schema": "../gen/schemas/desktop-schema.json",
3:   "identifier": "default",
4:   "description": "enables the default permissions",
5:   "windows": [
6:     "main",
7:     "subject-form"
8:   ],
9:   "permissions": [
10:     "core:default",
11:     "core:window:default",
12:     "core:window:allow-minimize",
13:     "core:window:allow-maximize",
14:     "core:window:allow-unmaximize",
15:     "core:window:allow-close",
16:     "core:window:allow-start-dragging",
17:     "core:window:allow-is-maximized",
18:     "core:window:allow-show",
19:     "core:window:allow-set-focus",
20:     "core:webview:allow-create-webview-window",
21:     "sql:allow-execute",
22:     "sql:allow-select",
23:     "sql:allow-load",
24:     "dialog:default",
25:     "fs:default",
26:     "window-state:default"
27:   ]
28: }

(End of file - total 28 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\Dev\\Projects\\Timetable\\package.json"
}
```

**Output:**
```
<path>C:\Dev\Projects\Timetable\package.json</path>
<type>file</type>
<content>
1: {
2:   "name": "timetable",
3:   "private": true,
4:   "version": "1.3.0",
5:   "type": "module",
6:   "scripts": {
7:     "dev": "vite",
8:     "build": "tsc -b && vite build",
9:     "lint": "oxlint",
10:     "preview": "vite preview",
11:     "tauri": "tauri",
12:     "dev:tauri": "tauri dev",
13:     "build:tauri": "tauri build"
14:   },
15:   "dependencies": {
16:     "@ant-design/icons": "^6.3.2",
17:     "@tauri-apps/api": "^2.11.1",
18:     "@tauri-apps/plugin-dialog": "^2.7.1",
19:     "@tauri-apps/plugin-fs": "^2.5.1",
20:     "@tauri-apps/plugin-sql": "^2.4.0",
21:     "@uiw/react-color": "^2.10.3",
22:     "antd": "^6.5.0",
23:     "dayjs": "^1.11.21",
24:     "docx-preview": "^0.4.0",
25:     "exceljs": "^4.4.0",
26:     "gsap": "^3.15.0",
27:     "html-to-image": "^1.11.13",
28:     "jszip": "^3.10.1",
29:     "react": "^19.2.7",
30:     "react-dom": "^19.2.7",
31:     "xlsx": "^0.18.5"
32:   },
33:   "devDependencies": {
34:     "@tauri-apps/cli": "^2.11.4",
35:     "@types/node": "^24.13.2",
36:     "@types/react": "^19.2.17",
37:     "@types/react-dom": "^19.2.3",
38:     "@vitejs/plugin-react": "^6.0.3",
39:     "oxlint": "^1.71.0",
40:     "typescript": "~6.0.2",
41:     "vite": "^8.1.1"
42:   }
43: }

(End of file - total 43 lines)
</content>
```

---

## Assistant (Plan · DeepSeek V4 Flash Free · 17.2s)

_Thinking:_

Now I have a comprehensive understanding of the codebase. Let me also look at the key store file and the TimetablePage to understand how modifications flow, so I can plan the integration points precisely.

Actually, the explore agent already gave me a very detailed summary. Let me also quickly check the useTimetableStore hook and the TimetablePage for specific integration points.

Now let me think about the full plan and what questions I need to ask the user.

Key design decisions I need to make:

### 1. Server Architecture: Rust vs Sidecar
The Rust backend already has `tokio` with "full" features. Adding `tokio-tungstenite` would give us a WebSocket server directly in Rust. This is the most natural approach since we don't need any external processes. The WebSocket server would:
- Be controlled via Tauri commands: `start_collab_server(port)`, `stop_collab_server()`
- Emit Tauri events when users join/leave
- Relay messages between clients

### 2. State Authority
Who is the "source of truth"?
- **Option A: Host client is authority** - The host's React app has the canonical state. When a new client joins, the host sends the full state.
- **Option B: Server is authority** - The Rust server holds the state (inefficient, complex)
- **Option C: First-write wins** - Anyone can broadcast, trust-based

I recommend **Option A** because the SQLite database is on the host's machine. The host is the authority.

### 3. How the rust WebSocket server works
The server is a relay:
1. Host calls `start_collab_server(port)` via Tauri command
2. Rust starts a WebSocket server on that port (bound to 0.0.0.0 for LAN access)
3. The host's React app connects to `ws://localhost:PORT` as a WebSocket client
4. Remote clients connect to `ws://HOST_IP:PORT`
5. Server broadcasts any message from one client to all others
6. Host calls `stop_collab_server()` to shut down

### 4. Store Integration Points
The store (`useTimetableStore`) needs to:
- Accept an `onRemoteAction` callback or expose a way to apply actions remotely
- After a local mutation, call a `broadcastAction` function if in collab mode
- Use an `actionId` dedup mechanism

Actually, looking more carefully at the store, I think the cleanest approach is:
- Create a new `useCollaboration` hook that takes the store actions and wraps them
- Or, modify `commitState` to call a collab broadcast function if registered

I think using a **collaboration middleware** pattern would be cleanest:
- The store exposes a `registerCollabMiddleware` function
- When collab is active, the middleware intercepts mutations, broadcasts them, and handles incoming remote mutations

### 5. Message Protocol

```typescript
// Server-to-client system messages
type ServerMessage = 
  | { type: 'welcome', clientId: string }
  | { type: 'peer:joined', clientId: string, userName: string }
  | { type: 'peer:left', clientId: string }

// Client messages (relayed to all)
type ClientMessage = 
  | { type: 'announce', clientId: string, userName: string }
  | { type: 'action', actionId: string, clientId: string, action: CollabAction, timestamp: number }
  | { type: 'state:request', clientId: string }
  | { type: 'state:full', targetClientId: string, state: CollabState }
  | { type: 'cursor', clientId: string, data: unknown }
  | { type: 'ping' }  // latency check
  | { type: 'pong' }
```

For the `action` type, we need to serialize store operations:

```typescript
type CollabAction =
  | { op: 'addBlueprint', entry: SubjectEntry }
  | { op: 'addInstance', entry: SubjectEntry }
  | { op: 'addInstances', entries: SubjectEntry[] }
  | { op: 'updateInstance', entry: SubjectEntry, editedScheduleId?: string }
  | { op: 'deleteBlueprint', id: string }
  | { op: 'deleteBlueprints', ids: string[] }
  | { op: 'deleteInstance', id: string }
  | { op: 'addDynamicData', dataType: string, value: string, displayAs: string }
  | { op: 'deleteDynamicData', id: string }
  | { op: 'updateDynamicData', id: string, dataType: string, value: string, displayAs: string }
  | { op: 'setHiddenDays', days: DayOfWeek[] }
  | { op: 'setTheme', theme: string }
  | { op: 'setBandedRows', banded: boolean }
  | { op: 'setFilePath', path: string | null }
```

### 6. Undo/Redo in Collab Mode

This is tricky. Options:
1. **Per-user undo**: Each user has their own undo stack. Remote actions don't go on the local undo stack.
2. **Global undo**: All actions go on one undo stack. This is complex and confusing.
3. **No undo in collab mode**: Simplest but frustrating.

I recommend **Per-user undo**: Remote mutations are applied directly to state without going through the undo stack. Only local mutations are undoable. When a user undoes, it broadcasts an `undo` action with the inverse operation.

Actually, even simpler: remote mutations bypass the undo stack entirely. The undo stack only contains local mutations. If you undo, you undo your own last action. The remote user's action is not affected.

But wait, this creates a problem: if User A adds a blueprint and User B deletes it, then User A undoes their add... the blueprint was already deleted. This gets into conflict resolution territory.

For the initial implementation, I think the simplest approach is:
- Remote actions are applied to the store's state directly (not through `commitState`)
- They bypass the history stack
- Undo only affects locally-generated actions
- This means if you undo an "add" that was already deleted by someone else, it's just a no-op (the item with that ID doesn't exist anymore, so undo does nothing)

Actually, I think we should have remote actions go through `commitState` but with a flag to skip history recording. Let me re-examine the store code to see how `commitState` works.

Let me read the store hook to understand commitState better.

Let me read the store hook to understand the modification pipeline:

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\Dev\\Projects\\Timetable\\src\\hooks\\useTimetableStore.ts"
}
```

**Output:**
```
<path>C:\Dev\Projects\Timetable\src\hooks\useTimetableStore.ts</path>
<type>file</type>
<content>
1: import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
2: import Database from '@tauri-apps/plugin-sql';
3: import type { SubjectEntry, ConflictInfo, DayOfWeek, FormState, DynamicData } from '../types';
4: import { getConnectedKeys } from '../utils/linkUtils';
5: 
6: let dbPromise: Promise<Database> | null = null;
7: 
8: function getDb(): Promise<Database> {
9:   if (!dbPromise) {
10:     dbPromise = Database.load('sqlite:timetable.db');
11:   }
12:   return dbPromise;
13: }
14: 
15: function toMinutes(time: string): number {
16:   const parts = time.split(':');
17:   return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
18: }
19: 
20: function timesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
21:   const sa = toMinutes(startA);
22:   const ea = toMinutes(endA);
23:   const sb = toMinutes(startB);
24:   const eb = toMinutes(endB);
25:   return sa < eb && sb < ea;
26: }
27: 
28: function uniqueValues(entries: SubjectEntry[], accessor: (e: SubjectEntry) => string | undefined | null): string[] {
29:   const seen = new Set<string>();
30:   for (const entry of entries) {
31:     const val = (accessor(entry) || '').trim();
32:     if (val) seen.add(val);
33:   }
34:   return Array.from(seen).sort();
35: }
36: 
37: export const DEFAULT_FORM_STATE: FormState = {
38:   subjectCode: '',
39:   offerCode: '',
40:   subjectDescription: '',
41:   room: [],
42:   colorRandom: true,
43:   color: '#2B4C7E',
44:   schedules: [],
45:   program: '',
46:   year: '1',
47:   section: '',
48:   department: '',
49: };
50: 
51: export interface TimetableStore {
52:   blueprints: SubjectEntry[];
53:   instances: SubjectEntry[];
54:   hiddenDays: DayOfWeek[];
55:   isLoading: boolean;
56:   filePath: string | null;
57:   updateFilePath: (path: string | null) => Promise<void>;
58:   addBlueprint: (entry: SubjectEntry) => ConflictInfo[];
59:   addInstance: (entry: SubjectEntry) => ConflictInfo[];
60:   addInstances: (entries: SubjectEntry[]) => ConflictInfo[][];
61:   updateInstance: (entry: SubjectEntry, editedScheduleId?: string) => ConflictInfo[];
62:   deleteBlueprint: (id: string) => void;
63:   deleteBlueprints: (ids: string[]) => void;
64:   deleteInstance: (id: string) => void;
65:   setHiddenDays: (days: DayOfWeek[]) => void;
66:   detectConflicts: (candidate: SubjectEntry, againstEntries?: SubjectEntry[]) => ConflictInfo[];
67:   importEntries: (jsonString: string) => { success: boolean; error?: string };
68:   mergeEntries: (imported: SubjectEntry[]) => { successCount: number; skippedCount: number; totalImported: number };
69:   exportEntries: () => string;
70:   importSuggestions: (templates: Array<{
71:     subjectCode: string;
72:     offerCode: string;
73:     subjectDescription: string;
74:     assignedTeacherName: string;
75:     room: string;
76:     program?: string;
77:     programShorthand?: string;
78:     year?: number;
79:     section?: string;
80:   }>) => Promise<void>;
81:   importedSuggestions: Array<{
82:     subjectCode: string;
83:     offerCode: string;
84:     subjectDescription: string;
85:     assignedTeacherName: string;
86:     room: string;
87:     program?: string;
88:     programShorthand?: string;
89:     year?: number;
90:     section?: string;
91:   }>;
92:   deleteImportedSuggestion: (index: number) => Promise<void>;
93:   clearImportedSuggestions: () => Promise<void>;
94:   theme: string;
95:   bandedRows: boolean;
96:   columnWidths: Record<string, number>;
97:   rowHeights: Record<number, number>;
98:   globalColWidth: number;
99:   globalRowHeight: number;
100:   commitCellSizes: (newColumnWidths: Record<string, number>, newRowHeights: Record<number, number>) => void;
101:   applyGlobalCellSizing: (width: number, height: number) => void;
102:   updateTheme: (theme: string) => Promise<void>;
103:   updateBandedRows: (banded: boolean) => Promise<void>;
104:   suggestions: {
105:     assignedTeacherNames: string[];
106:     subjectCodes: string[];
107:     offerCodes: string[];
108:     rooms: string[];
109:     subjectDescriptions: string[];
110:   };
111:   undo: () => void;
112:   redo: () => void;
113:   canUndo: boolean;
114:   canRedo: boolean;
115:   editingEntryId: string | null;
116:   formState: FormState;
117:   startEdit: (id: string) => void;
118:   cancelEdit: () => void;
119:   updateFormState: (state: FormState) => void;
120:   dynamicData: DynamicData[];
121:   addDynamicData: (dataType: string, value: string, displayAs: string) => Promise<void>;
122:   addLinksBatched: (links: Array<{ childKey: string; parentKey: string }>) => Promise<void>;
123:   deleteDynamicData: (id: string) => Promise<void>;
124:   updateDynamicData: (id: string, dataType: string, value: string, displayAs: string) => Promise<void>;
125:   isDirty: boolean;
126:   markSaved: () => void;
127:   addBlueprints: (entries: SubjectEntry[]) => void;
128:   addBlueprintsAndInstances: (blueprints: SubjectEntry[], instances: SubjectEntry[]) => void;
129:   mergeBlueprints: (entries: SubjectEntry[]) => { addedCount: number; updatedCount: number; skippedCount: number };
130:   mergeDynamicData: (entries: DynamicData[]) => { addedCount: number; skippedCount: number };
131: }
132: 
133: interface HistorySnapshot {
134:   blueprints: SubjectEntry[];
135:   instances: SubjectEntry[];
136:   editingEntryId: string | null;
137:   formState: FormState;
138:   dynamicData: DynamicData[];
139:   columnWidths: Record<string, number>;
140:   rowHeights: Record<number, number>;
141:   globalColWidth: number;
142:   globalRowHeight: number;
143: }
144: 
145: function migrateEntries(parsed: unknown): { blueprints: SubjectEntry[]; instances: SubjectEntry[] } {
146:   if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
147:     const obj = parsed as Record<string, unknown>;
148:     if (Array.isArray(obj.blueprints) && Array.isArray(obj.instances)) {
149:       return { blueprints: obj.blueprints as SubjectEntry[], instances: obj.instances as SubjectEntry[] };
150:     }
151:   }
152:   if (Array.isArray(parsed)) {
153:     const blueprints: SubjectEntry[] = [];
154:     const instances: SubjectEntry[] = [];
155:     for (const entry of parsed as SubjectEntry[]) {
156:       const cleaned = {
157:         ...entry,
158:         schedules: (entry.schedules || []).map((s) => ({
159:           ...s,
160:           rooms: s.rooms || (entry.room ? [entry.room] : [])
161:         }))
162:       };
163:       if (cleaned.schedules.length > 0) {
164:         const blueprint = { ...cleaned, schedules: [], assignedTeacherName: '', room: undefined };
165:         const existingBp = blueprints.find(
166:           (b) => b.subjectCode === blueprint.subjectCode && b.offerCode === blueprint.offerCode
167:         );
168:         if (!existingBp) {
169:           blueprints.push(blueprint);
170:         }
171:         instances.push(cleaned);
172:       } else {
173:         blueprints.push(cleaned);
174:       }
175:     }
176:     return { blueprints, instances };
177:   }
178:   return { blueprints: [], instances: [] };
179: }
180: 
181: export function useTimetableStore(timetableId: string): TimetableStore {
182:   const [blueprints, setBlueprints] = useState<SubjectEntry[]>([]);
183:   const [instances, setInstances] = useState<SubjectEntry[]>([]);
184:   const [hiddenDays, setHiddenDaysState] = useState<DayOfWeek[]>([]);
185:   const [filePath, setFilePathState] = useState<string | null>(null);
186:   const [theme, setThemeState] = useState<string>('blue');
187:   const [bandedRows, setBandedRowsState] = useState<boolean>(true);
188:   const [importedSuggestions, setImportedSuggestionsState] = useState<Array<{
189:     subjectCode: string;
190:     offerCode: string;
191:     subjectDescription: string;
192:     assignedTeacherName: string;
193:     room: string;
194:     program?: string;
195:     programShorthand?: string;
196:     year?: number;
197:     section?: string;
198:   }>>([]);
199:   const [editingEntryId, setEditingEntryIdState] = useState<string | null>(null);
200:   const [formState, setFormStateState] = useState<FormState>(DEFAULT_FORM_STATE);
201:   const [isLoading, setIsLoading] = useState(true);
202:   const [dynamicData, setDynamicData] = useState<DynamicData[]>([]);
203:   const [isDirty, setIsDirty] = useState(false);
204:   const setIsDirtyAndDispatch = useCallback((dirty: boolean) => {
205:     setIsDirty(dirty);
206:     window.dispatchEvent(new CustomEvent('store:dirty-change', { detail: { isDirty: dirty } }));
207:   }, []);
208: 
209:   const [columnWidths, setColumnWidthsState] = useState<Record<string, number>>(() => {
210:     try {
211:       const saved = localStorage.getItem('timetable_column_widths');
212:       return saved ? JSON.parse(saved) : {};
213:     } catch {
214:       return {};
215:     }
216:   });
217:   const columnWidthsRef = useRef(columnWidths);
218:   columnWidthsRef.current = columnWidths;
219: 
220:   const [rowHeights, setRowHeightsState] = useState<Record<number, number>>(() => {
221:     try {
222:       const saved = localStorage.getItem('timetable_row_heights');
223:       return saved ? JSON.parse(saved) : {};
224:     } catch {
225:       return {};
226:     }
227:   });
228:   const rowHeightsRef = useRef(rowHeights);
229:   rowHeightsRef.current = rowHeights;
230: 
231:   const [globalColWidth, setGlobalColWidthState] = useState<number>(() => {
232:     const saved = localStorage.getItem('timetable_global_col_width');
233:     return saved ? parseInt(saved, 10) : 130;
234:   });
235:   const globalColWidthRef = useRef(globalColWidth);
236:   globalColWidthRef.current = globalColWidth;
237: 
238:   const [globalRowHeight, setGlobalRowHeightState] = useState<number>(() => {
239:     const saved = localStorage.getItem('timetable_global_row_height');
240:     return saved ? parseInt(saved, 10) : 36;
241:   });
242:   const globalRowHeightRef = useRef(globalRowHeight);
243:   globalRowHeightRef.current = globalRowHeight;
244: 
245:   const lastSavedJsonRef = useRef<string>('');
246:   const lastSavedHiddenDaysRef = useRef<string>('');
247: 
248:   const historyRef = useRef<HistorySnapshot[]>([]);
249:   const historyIndexRef = useRef<number>(-1);
250:   const [canUndo, setCanUndo] = useState(false);
251:   const [canRedo, setCanRedo] = useState(false);
252: 
253:   const updateHistoryState = useCallback((): void => {
254:     setCanUndo(historyIndexRef.current > 0);
255:     setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
256:   }, []);
257: 
258:   useEffect(() => {
259:     if (!timetableId) return;
260:     const stored = localStorage.getItem(`suggestions_${timetableId}`);
261:     if (stored) {
262:       try {
263:         setImportedSuggestionsState(JSON.parse(stored));
264:       } catch {
265:         setImportedSuggestionsState([]);
266:       }
267:     } else {
268:       setImportedSuggestionsState([]);
269:     }
270:   }, [timetableId]);
271: 
272:   useEffect(() => {
273:     if (!timetableId) return;
274:     getDb()
275:       .then((db) => db.select<{ id: string; data_type: string; value: string; display_as: string }[]>(
276:         'SELECT id, data_type, value, display_as FROM dynamic_data WHERE timetable_id = $1',
277:         [timetableId]
278:       ))
279:       .then((rows) => {
280:         const mapped = rows.map((r) => ({
281:           id: r.id,
282:           dataType: r.data_type,
283:           value: r.value,
284:           displayAs: r.display_as,
285:         }));
286:         setDynamicData(mapped);
287:       })
288:       .catch((err) => console.error('Failed to load dynamic data:', err));
289:   }, [timetableId]);
290: 
291:   const isDuplicateRoom = useCallback((value: string, displayAs: string, excludeId: string | null): boolean => {
292:     const building = displayAs.split('|')[1] || '';
293:     return dynamicData.some(
294:       (d) =>
295:         d.dataType === 'room' &&
296:         d.id !== excludeId &&
297:         d.value?.trim().toLowerCase() === value.trim().toLowerCase() &&
298:         (d.displayAs.split('|')[1] || '').trim().toLowerCase() === building.trim().toLowerCase()
299:     );
300:   }, [dynamicData]);
301: 
302:   const addDynamicData = useCallback(async (dataType: string, value: string, displayAs: string) => {
303:     if (dataType === 'room' && isDuplicateRoom(value, displayAs, null)) {
304:       const building = displayAs.split('|')[1] || '';
305:       throw new Error(`Room "${value}" already exists in building "${building || '(none)'}".`);
306:     }
307:     const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
308:     const db = await getDb();
309:     await db.execute(
310:       'INSERT INTO dynamic_data (id, data_type, value, display_as, timetable_id) VALUES ($1, $2, $3, $4, $5)',
311:       [id, dataType, value, displayAs, timetableId]
312:     );
313:     setDynamicData((prev) => [...prev, { id, dataType, value, displayAs }]);
314:     setIsDirtyAndDispatch(true);
315:   }, [timetableId, isDuplicateRoom, setIsDirtyAndDispatch]);
316: 
317:   const addLinksBatched = useCallback(async (links: Array<{ childKey: string; parentKey: string }>) => {
318:     if (links.length === 0) return;
319:     const db = await getDb();
320:     const values: string[] = [];
321:     const params: unknown[] = [];
322:     links.forEach(({ childKey, parentKey }, i) => {
323:       const id = Math.random().toString(36).slice(2) + Date.now().toString(36) + i;
324:       const offset = i * 5;
325:       values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
326:       params.push(id, 'link', childKey, parentKey, timetableId);
327:     });
328:     await db.execute(
329:       `INSERT INTO dynamic_data (id, data_type, value, display_as, timetable_id) VALUES ${values.join(', ')}`,
330:       params,
331:     );
332:     const newRows = links.map(({ childKey, parentKey }, i) => ({
333:       id: Math.random().toString(36).slice(2) + Date.now().toString(36) + i,
334:       dataType: 'link' as const,
335:       value: childKey,
336:       displayAs: parentKey,
337:     }));
338:     setDynamicData((prev) => [...prev, ...newRows]);
339:     setIsDirtyAndDispatch(true);
340:   }, [timetableId, setIsDirtyAndDispatch]);
341: 
342:   const deleteDynamicData = useCallback(async (id: string) => {
343:     const db = await getDb();
344:     await db.execute('DELETE FROM dynamic_data WHERE id = $1', [id]);
345:     setDynamicData((prev) => prev.filter((item) => item.id !== id));
346:     setIsDirtyAndDispatch(true);
347:   }, [setIsDirtyAndDispatch]);
348: 
349:   const updateDynamicData = useCallback(async (id: string, dataType: string, value: string, displayAs: string) => {
350:     if (dataType === 'room' && isDuplicateRoom(value, displayAs, id)) {
351:       const building = displayAs.split('|')[1] || '';
352:       throw new Error(`Room "${value}" already exists in building "${building || '(none)'}".`);
353:     }
354:     const db = await getDb();
355:     await db.execute(
356:       'UPDATE dynamic_data SET data_type = $2, value = $3, display_as = $4 WHERE id = $1',
357:       [id, dataType, value, displayAs]
358:     );
359:     setDynamicData((prev) =>
360:       prev.map((item) => (item.id === id ? { id, dataType, value, displayAs } : item))
361:     );
362:     setIsDirtyAndDispatch(true);
363:   }, [isDuplicateRoom, setIsDirtyAndDispatch]);
364: 
365:   const markSaved = useCallback(() => {
366:     setIsDirtyAndDispatch(false);
367:   }, [setIsDirtyAndDispatch]);
368: 
369:   // Load from DB on mount
370:   useEffect(() => {
371:     if (!timetableId) return;
372:     setIsLoading(true);
373: 
374:     getDb()
375:       .then((db) =>
376:         db.select<{ entries_json: string; hidden_days: string; file_path: string | null; theme: string | null; banded_rows: number | null }[]>(
377:           'SELECT entries_json, hidden_days, file_path, theme, banded_rows FROM timetables WHERE id = $1',
378:           [timetableId],
379:         ),
380:       )
381:       .then((rows) => {
382:         const json = rows[0]?.entries_json ?? '[]';
383:         const hDaysJson = rows[0]?.hidden_days ?? '[]';
384:         const fPath = rows[0]?.file_path ?? null;
385:         const savedTheme = rows[0]?.theme ?? 'blue';
386:         const savedBanded = rows[0]?.banded_rows !== 0;
387: 
388:         setFilePathState(fPath);
389:         setThemeState(savedTheme);
390:         setBandedRowsState(savedBanded);
391: 
392:         try {
393:           const parsed = JSON.parse(json);
394:           const { blueprints: initialBlueprints, instances: initialInstances } = migrateEntries(parsed);
395:           setBlueprints(initialBlueprints);
396:           setInstances(initialInstances);
397:           lastSavedJsonRef.current = JSON.stringify({ blueprints: initialBlueprints, instances: initialInstances });
398:           setEditingEntryIdState(null);
399:           setFormStateState(DEFAULT_FORM_STATE);
400:           historyRef.current = [{
401:             blueprints: initialBlueprints,
402:             instances: initialInstances,
403:             editingEntryId: null,
404:             formState: DEFAULT_FORM_STATE,
405:             dynamicData,
406:             columnWidths: columnWidthsRef.current,
407:             rowHeights: rowHeightsRef.current,
408:             globalColWidth: globalColWidthRef.current,
409:             globalRowHeight: globalRowHeightRef.current,
410:           }];
411:           historyIndexRef.current = 0;
412:           updateHistoryState();
413:         } catch {
414:           setBlueprints([]);
415:           setInstances([]);
416:           lastSavedJsonRef.current = JSON.stringify({ blueprints: [], instances: [] });
417:           setEditingEntryIdState(null);
418:           setFormStateState(DEFAULT_FORM_STATE);
419:           historyRef.current = [{
420:             blueprints: [],
421:             instances: [],
422:             editingEntryId: null,
423:             formState: DEFAULT_FORM_STATE,
424:             dynamicData,
425:             columnWidths: columnWidthsRef.current,
426:             rowHeights: rowHeightsRef.current,
427:             globalColWidth: globalColWidthRef.current,
428:             globalRowHeight: globalRowHeightRef.current,
429:           }];
430:           historyIndexRef.current = 0;
431:           updateHistoryState();
432:         }
433: 
434:         try {
435:           const parsedDays = JSON.parse(hDaysJson);
436:           const initialHidden = Array.isArray(parsedDays) ? parsedDays : [];
437:           setHiddenDaysState(initialHidden);
438:           lastSavedHiddenDaysRef.current = JSON.stringify(initialHidden);
439:         } catch {
440:           setHiddenDaysState([]);
441:           lastSavedHiddenDaysRef.current = '[]';
442:         }
443:       })
444:       .catch(() => {
445:         setBlueprints([]);
446:         setInstances([]);
447:         setHiddenDaysState([]);
448:         setFilePathState(null);
449:         setThemeState('blue');
450:         setBandedRowsState(true);
451:       })
452:       .finally(() => setIsLoading(false));
453:   }, [timetableId, updateHistoryState]);
454: 
455:   const commitState = useCallback(
456:     (
457:       newBlueprints: SubjectEntry[],
458:       newInstances: SubjectEntry[],
459:       newEditingEntryId: string | null,
460:       newFormState: FormState,
461:       isUndoRedoOperation = false,
462:       newHiddenDays = hiddenDays,
463:       newColumnWidths: Record<string, number> = columnWidthsRef.current,
464:       newRowHeights: Record<number, number> = rowHeightsRef.current,
465:       newGlobalColWidth: number = globalColWidthRef.current,
466:       newGlobalRowHeight: number = globalRowHeightRef.current
467:     ): void => {
468:       setBlueprints(newBlueprints);
469:       setInstances(newInstances);
470:       setEditingEntryIdState(newEditingEntryId);
471:       setFormStateState(newFormState);
472:       setHiddenDaysState(newHiddenDays);
473:       setColumnWidthsState(newColumnWidths);
474:       setRowHeightsState(newRowHeights);
475:       setGlobalColWidthState(newGlobalColWidth);
476:       setGlobalRowHeightState(newGlobalRowHeight);
477: 
478:       localStorage.setItem('timetable_column_widths', JSON.stringify(newColumnWidths));
479:       localStorage.setItem('timetable_row_heights', JSON.stringify(newRowHeights));
480:       localStorage.setItem('timetable_global_col_width', String(newGlobalColWidth));
481:       localStorage.setItem('timetable_global_row_height', String(newGlobalRowHeight));
482: 
483:       setIsDirtyAndDispatch(true);
484: 
485:       if (!isUndoRedoOperation) {
486:         const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
487:         newHistory.push({
488:           blueprints: newBlueprints,
489:           instances: newInstances,
490:           editingEntryId: newEditingEntryId,
491:           formState: newFormState,
492:           dynamicData,
493:           columnWidths: newColumnWidths,
494:           rowHeights: newRowHeights,
495:           globalColWidth: newGlobalColWidth,
496:           globalRowHeight: newGlobalRowHeight
497:         });
498:         historyRef.current = newHistory;
499:         historyIndexRef.current = newHistory.length - 1;
500:         updateHistoryState();
501:       }
502: 
503:       const combinedJson = JSON.stringify({ blueprints: newBlueprints, instances: newInstances });
504:       const hiddenDaysJson = JSON.stringify(newHiddenDays);
505: 
506:       const entriesChanged = combinedJson !== lastSavedJsonRef.current;
507:       const hiddenDaysChanged = hiddenDaysJson !== lastSavedHiddenDaysRef.current;
508: 
509:       if (entriesChanged || hiddenDaysChanged) {
510:         lastSavedJsonRef.current = combinedJson;
511:         lastSavedHiddenDaysRef.current = hiddenDaysJson;
512: 
513:         const now = new Date().toISOString();
514:         const totalCount = newBlueprints.length + newInstances.length;
515:         getDb()
516:           .then((db) =>
517:             db.execute(
518:               'UPDATE timetables SET entries_json = $1, entry_count = $2, updated_at = $3, hidden_days = $4 WHERE id = $5',
519:               [combinedJson, totalCount, now, hiddenDaysJson, timetableId],
520:             ),
521:           )
522:           .catch((e: unknown) => console.error('Failed to save timetable:', e));
523:       }
524:     },
525:     [timetableId, hiddenDays, updateHistoryState, dynamicData, setIsDirtyAndDispatch]
526:   );
527: 
528:   const addBlueprints = useCallback((entries: SubjectEntry[]): void => {
529:     const nextBlueprints = [...entries, ...blueprints];
530:     commitState(nextBlueprints, instances, null, DEFAULT_FORM_STATE);
531:   }, [blueprints, instances, commitState]);
532: 
533:   const addBlueprintsAndInstances = useCallback((newBps: SubjectEntry[], newInsts: SubjectEntry[]): void => {
534:     const nextBlueprints = [...newBps, ...blueprints];
535:     const nextInstances = [...newInsts, ...instances];
536:     commitState(nextBlueprints, nextInstances, null, DEFAULT_FORM_STATE);
537:   }, [blueprints, instances, commitState]);
538: 
539:   const persistState = useCallback(
540:     (newBlueprints: SubjectEntry[], newInstances: SubjectEntry[], isUndoRedoOperation = false): void => {
541:       commitState(newBlueprints, newInstances, editingEntryId, formState, isUndoRedoOperation, hiddenDays);
542:     },
543:     [commitState, editingEntryId, formState, hiddenDays],
544:   );
545: 
546:   const setHiddenDays = useCallback(
547:     (_days: DayOfWeek[]): void => {
548:       commitState(blueprints, instances, editingEntryId, formState, false, _days);
549:     },
550:     [blueprints, instances, editingEntryId, formState, commitState],
551:   );
552: 
553:   const updateFilePath = useCallback(
554:     async (path: string | null): Promise<void> => {
555:       setFilePathState(path);
556:       const db = await getDb();
557:       const now = new Date().toISOString();
558:       await db.execute(
559:         'UPDATE timetables SET file_path = $1, updated_at = $2 WHERE id = $3',
560:         [path, now, timetableId]
561:       );
562:     },
563:     [timetableId]
564:   );
565: 
566:   const detectConflicts = useCallback(
567:     (candidate: SubjectEntry, againstEntries?: SubjectEntry[]): ConflictInfo[] => {
568:       const conflicts: ConflictInfo[] = [];
569:       const targetList = againstEntries ?? instances;
570: 
571:       for (const existing of targetList) {
572:         if (existing.id === candidate.id) continue;
573: 
574:         for (const cs of candidate.schedules) {
575:           for (const cDay of cs.days) {
576:             for (const es of existing.schedules) {
577:               for (const eDay of es.days) {
578:                 if (cDay !== eDay) continue;
579:                 if (!timesOverlap(cs.startTime, cs.endTime, es.startTime, es.endTime)) continue;
580: 
581:                 const info = { day: cDay, startTime: cs.startTime, endTime: cs.endTime };
582: 
583:                 conflicts.push({ type: 'time', conflictingEntry: existing, ...info });
584: 
585:                 if (
586:                   candidate.assignedTeacherName &&
587:                   existing.assignedTeacherName &&
588:                   candidate.assignedTeacherName.trim().toLowerCase() === existing.assignedTeacherName.trim().toLowerCase()
589:                 ) {
590:                   conflicts.push({ type: 'teacher', conflictingEntry: existing, ...info });
591:                 }
592: 
593:                 const candRooms = cs.rooms || [];
594:                 const existRooms = es.rooms || [];
595:                 const hasRoomOverlap = candRooms.some((r) =>
596:                   existRooms.some((er) => er.trim().toLowerCase() === r.trim().toLowerCase())
597:                 );
598:                 if (hasRoomOverlap) {
599:                   conflicts.push({ type: 'room', conflictingEntry: existing, ...info });
600:                 }
601:               }
602:             }
603:           }
604:         }
605:       }
606: 
607:       return conflicts;
608:     },
609:     [instances],
610:   );
611: 
612:   const addBlueprint = useCallback(
613:     (entry: SubjectEntry): ConflictInfo[] => {
614:       const existing = blueprints.find((e) => e.id === entry.id);
615:       const nextBlueprints = existing
616:         ? blueprints.map((e) => (e.id === entry.id ? entry : e))
617:         : [entry, ...blueprints];
618:       commitState(nextBlueprints, instances, null, DEFAULT_FORM_STATE);
619:       return [];
620:     },
621:     [blueprints, instances, commitState],
622:   );
623: 
624:   const addInstance = useCallback(
625:     (entry: SubjectEntry): ConflictInfo[] => {
626:       const nextInstances = [entry, ...instances];
627:       commitState(blueprints, nextInstances, null, DEFAULT_FORM_STATE);
628:       return detectConflicts(entry, nextInstances);
629:     },
630:     [blueprints, instances, commitState, detectConflicts],
631:   );
632: 
633:   const addInstances = useCallback(
634:     (entries: SubjectEntry[]): ConflictInfo[][] => {
635:       const nextInstances = [...entries, ...instances];
636:       commitState(blueprints, nextInstances, null, DEFAULT_FORM_STATE);
637:       return entries.map((entry) => detectConflicts(entry, nextInstances));
638:     },
639:     [blueprints, instances, commitState, detectConflicts],
640:   );
641: 
642:   const updateInstance = useCallback(
643:     (entry: SubjectEntry, editedScheduleId?: string): ConflictInfo[] => {
644:       let nextInstances = instances.map((e) => (e.id === entry.id ? entry : e));
645: 
646:       const links = new Map<string, string>();
647:       for (const d of dynamicData) {
648:         if (d.dataType === 'link') {
649:           links.set(d.value, d.displayAs);
650:         }
651:       }
652: 
653:       const connectedSubjectIds = new Set<string>();
654:       const allConnectedKeys = new Set<string>();
655:       const editedSchedule = editedScheduleId
656:         ? entry.schedules.find(s => s.id === editedScheduleId)
657:         : null;
658: 
659:       for (const s of entry.schedules) {
660:         if (editedScheduleId && s.id !== editedScheduleId) continue;
661:         const key = `${entry.id}:${s.id}`;
662:         const connected = getConnectedKeys(key, links);
663:         for (const ck of connected) {
664:           allConnectedKeys.add(ck);
665:           const [subjId] = ck.split(':');
666:           connectedSubjectIds.add(subjId);
667:         }
668:       }
669: 
670:       if (allConnectedKeys.size > 1) {
671:         nextInstances = nextInstances.map((e) => {
672:           if (!connectedSubjectIds.has(e.id)) return e;
673:           if (e.id === entry.id) return e;
674: 
675:           let schedulesChanged = false;
676:           const updatedSchedules = e.schedules.map((s) => {
677:             const sk = `${e.id}:${s.id}`;
678:           if (editedSchedule && allConnectedKeys.has(sk)) {
679:             if (editedSchedule.assignedTeacherName !== s.assignedTeacherName) {
680:               schedulesChanged = true;
681:             }
682:             return {
683:               ...s,
684:               assignedTeacherName: editedSchedule.assignedTeacherName,
685:             };
686:           }
687:             return s;
688:           });
689: 
690:           return {
691:             ...e,
692:             subjectCode: entry.subjectCode,
693:             offerCode: entry.offerCode,
694:             subjectDescription: entry.subjectDescription,
695:             assignedTeacherName: entry.assignedTeacherName,
696:             department: entry.department,
697:             program: entry.program,
698:             year: entry.year,
699:             section: entry.section,
700:             color: entry.color,
701:             ...(schedulesChanged ? { schedules: updatedSchedules } : {}),
702:           };
703:         });
704:       }
705: 
706:       commitState(blueprints, nextInstances, null, DEFAULT_FORM_STATE);
707:       return detectConflicts(entry, nextInstances);
708:     },
709:     [blueprints, instances, commitState, detectConflicts, dynamicData],
710:   );
711: 
712:   const deleteBlueprint = useCallback(
713:     (id: string): void => {
714:       const nextBlueprints = blueprints.filter((e) => e.id !== id);
715:       const nextInstances = instances.filter((e) => e.blueprintId !== id);
716:       const nextEditingEntryId = editingEntryId === id ? null : editingEntryId;
717:       const nextFormState = editingEntryId === id ? DEFAULT_FORM_STATE : formState;
718: 
719:       // Clean up links involving the deleted instances
720:       const deletedInstanceIds = new Set(
721:         instances.filter((e) => e.blueprintId === id).map((e) => e.id)
722:       );
723:       const linksToRemove = dynamicData.filter(
724:         (d) => d.dataType === 'link' && (
725:           deletedInstanceIds.has(d.value.split(':')[0]) || 
726:           deletedInstanceIds.has(d.displayAs.split(':')[0])
727:         )
728:       );
729:       for (const link of linksToRemove) {
730:         void deleteDynamicData(link.id);
731:       }
732: 
733:       commitState(nextBlueprints, nextInstances, nextEditingEntryId, nextFormState);
734:     },
735:     [blueprints, instances, editingEntryId, formState, commitState, dynamicData, deleteDynamicData],
736:   );
737: 
738:   const deleteBlueprints = useCallback(
739:     (ids: string[]): void => {
740:       const idsSet = new Set(ids);
741:       const nextBlueprints = blueprints.filter((e) => !idsSet.has(e.id));
742:       const nextInstances = instances.filter((e) => !e.blueprintId || !idsSet.has(e.blueprintId));
743:       const nextEditingEntryId = idsSet.has(editingEntryId || '') ? null : editingEntryId;
744:       const nextFormState = idsSet.has(editingEntryId || '') ? DEFAULT_FORM_STATE : formState;
745: 
746:       // Clean up links involving the deleted instances
747:       const deletedInstanceIds = new Set(
748:         instances.filter((e) => e.blueprintId && idsSet.has(e.blueprintId)).map((e) => e.id)
749:       );
750:       const linksToRemove = dynamicData.filter(
751:         (d) => d.dataType === 'link' && (
752:           deletedInstanceIds.has(d.value.split(':')[0]) || 
753:           deletedInstanceIds.has(d.displayAs.split(':')[0])
754:         )
755:       );
756:       for (const link of linksToRemove) {
757:         void deleteDynamicData(link.id);
758:       }
759: 
760:       commitState(nextBlueprints, nextInstances, nextEditingEntryId, nextFormState);
761:     },
762:     [blueprints, instances, editingEntryId, formState, commitState, dynamicData, deleteDynamicData],
763:   );
764: 
765:   const deleteInstance = useCallback(
766:     (id: string): void => {
767:       const nextInstances = instances.filter((e) => e.id !== id);
768:       const nextEditingEntryId = editingEntryId === id ? null : editingEntryId;
769:       const nextFormState = editingEntryId === id ? DEFAULT_FORM_STATE : formState;
770: 
771:       const linksToRemove = dynamicData.filter(
772:         (d) => d.dataType === 'link' && (d.value.startsWith(`${id}:`) || d.displayAs.startsWith(`${id}:`))
773:       );
774:       for (const link of linksToRemove) {
775:         deleteDynamicData(link.id);
776:       }
777: 
778:       commitState(blueprints, nextInstances, nextEditingEntryId, nextFormState);
779:     },
780:     [blueprints, instances, editingEntryId, formState, commitState, dynamicData, deleteDynamicData],
781:   );
782: 
783:   const exportEntries = useCallback((): string => {
784:     return JSON.stringify(instances, null, 2);
785:   }, [instances]);
786: 
787:   const importEntries = useCallback(
788:     (jsonString: string): { success: boolean; error?: string } => {
789:       try {
790:         const parsed = JSON.parse(jsonString);
791:         if (!Array.isArray(parsed)) {
792:           return { success: false, error: 'JSON root must be an array of timetable entries.' };
793:         }
794:         for (const item of parsed) {
795:           if (
796:             typeof item !== 'object' || item === null || !item.id || !item.subjectCode || !Array.isArray(item.schedules)
797:           ) {
798:             return { success: false, error: 'Invalid structure. Entries must contain id, subjectCode, and schedules.' };
799:           }
800:         }
801:         persistState(blueprints, parsed as SubjectEntry[]);
802:         return { success: true };
803:       } catch (e: unknown) {
804:         return { success: false, error: e instanceof Error ? e.message : 'Invalid JSON format.' };
805:       }
806:     },
807:     [blueprints, persistState],
808:   );
809: 
810:   const mergeEntries = useCallback(
811:     (imported: SubjectEntry[]): { successCount: number; skippedCount: number; totalImported: number } => {
812:       const currentInstances = [...instances];
813:       let successCount = 0;
814:       let skippedCount = 0;
815:       const totalImported = imported.length;
816: 
817:       for (const entry of imported) {
818:         const existingMatchIndex = currentInstances.findIndex(
819:           (e) =>
820:             e.subjectCode.trim().toLowerCase() === entry.subjectCode.trim().toLowerCase() &&
821:             e.offerCode.trim().toLowerCase() === entry.offerCode.trim().toLowerCase() &&
822:             e.subjectDescription.trim().toLowerCase() === entry.subjectDescription.trim().toLowerCase()
823:         );
824: 
825:         if (existingMatchIndex !== -1) {
826:           const existingMatch = currentInstances[existingMatchIndex];
827:           const allSchedulesDuplicate = entry.schedules.every((impSched) =>
828:             existingMatch.schedules.some(
829:               (s) =>
830:                 s.startTime === impSched.startTime &&
831:                 s.endTime === impSched.endTime &&
832:                 s.days.length === impSched.days.length &&
833:                 s.days.every((d) => impSched.days.includes(d))
834:             )
835:           );
836:           const metaMatch =
837:             existingMatch.assignedTeacherName === entry.assignedTeacherName &&
838:             existingMatch.room === entry.room &&
839:             existingMatch.program === entry.program &&
840:             existingMatch.year === entry.year &&
841:             existingMatch.section === entry.section;
842: 
843:           if (allSchedulesDuplicate && metaMatch) {
844:             skippedCount++;
845:             continue;
846:           }
847: 
848:           const mergedSchedules = [...existingMatch.schedules];
849:           for (const impSched of entry.schedules) {
850:             const hasDuplicate = mergedSchedules.some(
851:               (s) =>
852:                 s.startTime === impSched.startTime &&
853:                 s.endTime === impSched.endTime &&
854:                 s.days.length === impSched.days.length &&
855:                 s.days.every((d) => impSched.days.includes(d))
856:             );
857:             if (!hasDuplicate) {
858:               mergedSchedules.push({
859:                 ...impSched,
860:                 id: impSched.id || Math.random().toString(36).slice(2) + Date.now().toString(36),
861:               });
862:             }
863:           }
864: 
865:           currentInstances[existingMatchIndex] = {
866:             ...existingMatch,
867:             assignedTeacherName: entry.assignedTeacherName || existingMatch.assignedTeacherName,
868:             room: entry.room || existingMatch.room,
869:             color: entry.color !== undefined ? entry.color : existingMatch.color,
870:             schedules: mergedSchedules,
871:           };
872:           successCount++;
873:         } else {
874:           currentInstances.push({
875:             ...entry,
876:             id: entry.id || Math.random().toString(36).slice(2) + Date.now().toString(36),
877:           });
878:           successCount++;
879:         }
880:       }
881: 
882:       persistState(blueprints, currentInstances);
883:       return { successCount, skippedCount, totalImported };
884:     },
885:     [blueprints, instances, persistState]
886:   );
887: 
888:   const mergeBlueprints = useCallback(
889:     (imported: SubjectEntry[]): { addedCount: number; updatedCount: number; skippedCount: number } => {
890:       let addedCount = 0;
891:       let updatedCount = 0;
892:       let skippedCount = 0;
893:       const nextBlueprints = [...blueprints];
894: 
895:       for (const entry of imported) {
896:         const norm = (s: string) => s.trim().toLowerCase();
897: 
898:         // Check exact match (all properties)
899:         const exactMatch = nextBlueprints.find(
900:           (e) =>
901:             norm(e.subjectCode) === norm(entry.subjectCode) &&
902:             norm(e.offerCode) === norm(entry.offerCode) &&
903:             norm(e.subjectDescription) === norm(entry.subjectDescription) &&
904:             norm(e.program) === norm(entry.program) &&
905:             e.year === entry.year &&
906:             norm(e.section) === norm(entry.section)
907:         );
908:         if (exactMatch) {
909:           skippedCount++;
910:           continue;
911:         }
912: 
913:         // Check partial match (same subjectCode + offerCode)
914:         const partialIdx = nextBlueprints.findIndex(
915:           (e) =>
916:             norm(e.subjectCode) === norm(entry.subjectCode) &&
917:             norm(e.offerCode) === norm(entry.offerCode)
918:         );
919:         if (partialIdx !== -1) {
920:           nextBlueprints[partialIdx] = {
921:             ...entry,
922:             id: nextBlueprints[partialIdx].id,
923:           };
924:           updatedCount++;
925:           continue;
926:         }
927: 
928:         // No match — add new
929:         nextBlueprints.push({
930:           ...entry,
931:           id: entry.id || Math.random().toString(36).slice(2) + Date.now().toString(36),
932:         });
933:         addedCount++;
934:       }
935: 
936:       commitState(nextBlueprints, instances, null, DEFAULT_FORM_STATE);
937:       return { addedCount, updatedCount, skippedCount };
938:     },
939:     [blueprints, instances, commitState]
940:   );
941: 
942:   const mergeDynamicData = useCallback(
943:     (imported: DynamicData[]): { addedCount: number; skippedCount: number } => {
944:       let addedCount = 0;
945:       let skippedCount = 0;
946:       const newRows: DynamicData[] = [];
947:       const nextDynamicData = [...dynamicData];
948: 
949:       for (const entry of imported) {
950:         const norm = (s: string) => s.trim().toLowerCase();
951:         const exists = nextDynamicData.some(
952:           (d) => d.dataType === entry.dataType && norm(d.value) === norm(entry.value)
953:         );
954:         if (exists) {
955:           skippedCount++;
956:           continue;
957:         }
958:         const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
959:         const row: DynamicData = {
960:           id: entry.id || id,
961:           dataType: entry.dataType,
962:           value: entry.value,
963:           displayAs: entry.displayAs,
964:         };
965:         newRows.push(row);
966:         nextDynamicData.push(row);
967:         addedCount++;
968:       }
969: 
970:       if (newRows.length > 0) {
971:         setDynamicData(nextDynamicData);
972:         setIsDirtyAndDispatch(true);
973:       }
974:       return { addedCount, skippedCount };
975:     },
976:     [dynamicData, setIsDirtyAndDispatch]
977:   );
978: 
979:   const importSuggestions = useCallback(
980:     async (templates: Array<{
981:       subjectCode: string;
982:       offerCode: string;
983:       subjectDescription: string;
984:       assignedTeacherName: string;
985:       room: string;
986:       program?: string;
987:       programShorthand?: string;
988:       year?: number;
989:       section?: string;
990:     }>): Promise<void> => {
991:       setImportedSuggestionsState(templates);
992:       localStorage.setItem(`suggestions_${timetableId}`, JSON.stringify(templates));
993:     },
994:     [timetableId]
995:   );
996: 
997:   const deleteImportedSuggestion = useCallback(
998:     async (index: number): Promise<void> => {
999:       const updated = [...importedSuggestions];
1000:       updated.splice(index, 1);
1001:       setImportedSuggestionsState(updated);
1002:       localStorage.setItem(`suggestions_${timetableId}`, JSON.stringify(updated));
1003:     },
1004:     [importedSuggestions, timetableId]
1005:   );
1006: 
1007:   const clearImportedSuggestions = useCallback(
1008:     async (): Promise<void> => {
1009:       setImportedSuggestionsState([]);
1010:       localStorage.removeItem(`suggestions_${timetableId}`);
1011:     },
1012:     [timetableId]
1013:   );
1014: 
1015:   const updateTheme = useCallback(
1016:     async (newTheme: string): Promise<void> => {
1017:       setThemeState(newTheme);
1018:       const db = await getDb();
1019:       const now = new Date().toISOString();
1020:       await db.execute(
1021:         'UPDATE timetables SET theme = $1, updated_at = $2 WHERE id = $3',
1022:         [newTheme, now, timetableId]
1023:       );
1024:     },
1025:     [timetableId]
1026:   );
1027: 
1028:   const updateBandedRows = useCallback(
1029:     async (banded: boolean): Promise<void> => {
1030:       setBandedRowsState(banded);
1031:       const db = await getDb();
1032:       const now = new Date().toISOString();
1033:       await db.execute(
1034:         'UPDATE timetables SET banded_rows = $1, updated_at = $2 WHERE id = $3',
1035:         [banded ? 1 : 0, now, timetableId]
1036:       );
1037:     },
1038:     [timetableId]
1039:   );
1040: 
1041:   const suggestions = useMemo(() => {
1042:     const combinedEntries = [
1043:       ...blueprints.map((b) => ({
1044:         ...b,
1045:         schedules: [],
1046:       })),
1047:       ...importedSuggestions.map((s, idx) => ({
1048:         id: `imported-${idx}`,
1049:         subjectCode: s.subjectCode,
1050:         offerCode: s.offerCode,
1051:         subjectDescription: s.subjectDescription,
1052:         assignedTeacherName: s.assignedTeacherName,
1053:         room: s.room,
1054:         schedules: [],
1055:         program: s.program || '',
1056:         year: s.year || 1,
1057:         section: s.section || '',
1058:         department: '',
1059:       }))
1060:     ];
1061:     return {
1062:       assignedTeacherNames: (() => {
1063:         const seen = new Set<string>();
1064:         for (const entry of [...blueprints, ...instances]) {
1065:           const mainVal = (entry.assignedTeacherName || '').trim();
1066:           if (mainVal) seen.add(mainVal);
1067:           for (const s of entry.schedules || []) {
1068:             const schedVal = (s.assignedTeacherName || '').trim();
1069:             if (schedVal) seen.add(schedVal);
1070:           }
1071:         }
1072:         return Array.from(seen).sort();
1073:       })(),
1074:       subjectCodes: uniqueValues(combinedEntries, (e) => e.subjectCode),
1075:       offerCodes: uniqueValues(combinedEntries, (e) => e.offerCode),
1076:       rooms: (() => {
1077:         const seen = new Set<string>();
1078:         for (const entry of [...blueprints, ...instances]) {
1079:           const val = entry.room || '';
1080:           if (val) {
1081:             val.split(',').forEach((r) => {
1082:               const trimmed = r.trim();
1083:               if (trimmed) seen.add(trimmed);
1084:             });
1085:           }
1086:           for (const s of entry.schedules || []) {
1087:             if (s.rooms) {
1088:               s.rooms.forEach((r) => {
1089:                 const trimmed = r.trim();
1090:                 if (trimmed) seen.add(trimmed);
1091:               });
1092:             }
1093:           }
1094:         }
1095:         return Array.from(seen).sort();
1096:       })(),
1097:       subjectDescriptions: uniqueValues(combinedEntries, (e) => e.subjectDescription),
1098:     };
1099:   }, [blueprints, instances, importedSuggestions]);
1100: 
1101:   const startEdit = useCallback(
1102:     (id: string): void => {
1103:       const entry = blueprints.find((e) => e.id === id);
1104:       if (!entry) return;
1105: 
1106:       const newFormState: FormState = {
1107:         subjectCode: entry.subjectCode,
1108:         offerCode: entry.offerCode,
1109:         subjectDescription: entry.subjectDescription,
1110:         room: [],
1111:         colorRandom: !entry.color,
1112:         color: entry.color || '#2B4C7E',
1113:         schedules: [],
1114:         program: entry.program || '',
1115:         year: entry.year ? String(entry.year) : '1',
1116:         section: entry.section || '',
1117:         department: entry.department || '',
1118:       };
1119: 
1120:       setEditingEntryIdState(id);
1121:       setFormStateState(newFormState);
1122:     },
1123:     [blueprints]
1124:   );
1125: 
1126:   const cancelEdit = useCallback((): void => {
1127:     setEditingEntryIdState(null);
1128:     setFormStateState(DEFAULT_FORM_STATE);
1129:   }, []);
1130: 
1131:   const updateFormState = useCallback(
1132:     (newFormState: FormState): void => {
1133:       setFormStateState(newFormState);
1134:     },
1135:     []
1136:   );
1137: 
1138:   const syncDynamicData = useCallback(async (data: DynamicData[]): Promise<void> => {
1139:     const db = await getDb();
1140:     await db.execute('DELETE FROM dynamic_data WHERE timetable_id = $1', [timetableId]);
1141:     for (const d of data) {
1142:       await db.execute(
1143:         'INSERT INTO dynamic_data (id, data_type, value, display_as, timetable_id) VALUES ($1, $2, $3, $4, $5)',
1144:         [d.id, d.dataType, d.value, d.displayAs, timetableId]
1145:       );
1146:     }
1147:   }, [timetableId]);
1148: 
1149:   const undo = useCallback((): void => {
1150:     if (historyIndexRef.current > 0) {
1151:       const oldState = historyRef.current[historyIndexRef.current];
1152:       historyIndexRef.current -= 1;
1153:       const newState = historyRef.current[historyIndexRef.current];
1154:       commitState(
1155:         newState.blueprints,
1156:         newState.instances,
1157:         newState.editingEntryId,
1158:         newState.formState,
1159:         true,
1160:         hiddenDays,
1161:         newState.columnWidths,
1162:         newState.rowHeights,
1163:         newState.globalColWidth,
1164:         newState.globalRowHeight
1165:       );
1166:       setDynamicData(newState.dynamicData);
1167:       void syncDynamicData(newState.dynamicData);
1168:       updateHistoryState();
1169: 
1170:       window.dispatchEvent(
1171:         new CustomEvent('timetable:history-focus', {
1172:           detail: { oldState, newState },
1173:         })
1174:       );
1175:     }
1176:   }, [commitState, syncDynamicData, updateHistoryState, hiddenDays]);
1177: 
1178:   const redo = useCallback((): void => {
1179:     if (historyIndexRef.current < historyRef.current.length - 1) {
1180:       const oldState = historyRef.current[historyIndexRef.current];
1181:       historyIndexRef.current += 1;
1182:       const newState = historyRef.current[historyIndexRef.current];
1183:       commitState(
1184:         newState.blueprints,
1185:         newState.instances,
1186:         newState.editingEntryId,
1187:         newState.formState,
1188:         true,
1189:         hiddenDays,
1190:         newState.columnWidths,
1191:         newState.rowHeights,
1192:         newState.globalColWidth,
1193:         newState.globalRowHeight
1194:       );
1195:       setDynamicData(newState.dynamicData);
1196:       void syncDynamicData(newState.dynamicData);
1197:       updateHistoryState();
1198: 
1199:       window.dispatchEvent(
1200:         new CustomEvent('timetable:history-focus', {
1201:           detail: { oldState, newState },
1202:         })
1203:       );
1204:     }
1205:   }, [commitState, syncDynamicData, updateHistoryState, hiddenDays]);
1206: 
1207:   const commitCellSizes = useCallback((newColumnWidths: Record<string, number>, newRowHeights: Record<number, number>) => {
1208:     columnWidthsRef.current = newColumnWidths;
1209:     rowHeightsRef.current = newRowHeights;
1210:     commitState(blueprints, instances, editingEntryId, formState, false, hiddenDays, newColumnWidths, newRowHeights);
1211:   }, [blueprints, instances, editingEntryId, formState, hiddenDays, commitState]);
1212: 
1213:   const applyGlobalCellSizing = useCallback((width: number, height: number) => {
1214:     globalColWidthRef.current = width;
1215:     globalRowHeightRef.current = height;
1216:     columnWidthsRef.current = {};
1217:     rowHeightsRef.current = {};
1218:     commitState(blueprints, instances, editingEntryId, formState, false, hiddenDays, {}, {}, width, height);
1219:   }, [blueprints, instances, editingEntryId, formState, hiddenDays, commitState]);
1220: 
1221:   return {
1222:     blueprints,
1223:     instances,
1224:     hiddenDays,
1225:     columnWidths,
1226:     rowHeights,
1227:     globalColWidth,
1228:     globalRowHeight,
1229:     commitCellSizes,
1230:     applyGlobalCellSizing,
1231:     isLoading,
1232:     filePath,
1233:     updateFilePath,
1234:     addBlueprint,
1235:     addInstance,
1236:     addInstances,
1237:     updateInstance,
1238:     deleteBlueprint,
1239:     deleteBlueprints,
1240:     deleteInstance,
1241:     setHiddenDays,
1242:     detectConflicts,
1243:     importEntries,
1244:     mergeEntries,
1245:     exportEntries,
1246:     importSuggestions,
1247:     importedSuggestions,
1248:     deleteImportedSuggestion,
1249:     clearImportedSuggestions,
1250:     theme,
1251:     bandedRows,
1252:     updateTheme,
1253:     updateBandedRows,
1254:     suggestions,
1255:     undo,
1256:     redo,
1257:     canUndo,
1258:     canRedo,
1259:     editingEntryId,
1260:     formState,
1261:     startEdit,
1262:     cancelEdit,
1263:     updateFormState,
1264:     dynamicData,
1265:     addDynamicData,
1266:     addLinksBatched,
1267:     deleteDynamicData,
1268:     updateDynamicData,
1269:     isDirty,
1270:     markSaved,
1271:     addBlueprints,
1272:     addBlueprintsAndInstances,
1273:     mergeBlueprints,
1274:     mergeDynamicData,
1275:   };
1276: }

(End of file - total 1276 lines)
</content>
```

---

## Assistant (Plan · DeepSeek V4 Flash Free · 29.9s)

_Thinking:_

Now I have a thorough understanding of the codebase. Let me also check the TimetablePage to understand how the store is used:

The key insight is that `commitState` is the single function through which all state mutations flow. This makes it an ideal integration point for collaboration. We can add a remote-update flag to `commitState` that:
1. When `isRemoteUpdate = true`: skip history push, skip broadcast
2. When `isRemoteUpdate = false` (local change) and collab is active: push history AND broadcast

I also need to look at how `dynamicData` mutations work (they don't go through `commitState`) - they use direct `setDynamicData` + SQL. These also need to be integrated.

Let me now write a comprehensive plan.

Actually, wait - the user wants my plan to include:
1. Clarifications needed
2. Improvements to the current implementation 
3. Optimization improvements and quality of life features

Let me organize this clearly.

Now I have a complete picture. Let me present the full plan.

---

## Collaboration Feature — Plan

### Current Architecture Summary

All state mutations flow through `commitState()` in `useTimetableStore.ts:455` which:
1. Sets React state
2. Pushes a history snapshot (unless undo/redo)
3. Writes immediately to SQLite on each change

`dynamicData` mutations (`addDynamicData`, `deleteDynamicData`, etc.) bypass `commitState` — they update React state directly + SQL. The Rust backend is minimal (file I/O only), with no networking code.

---

### 1. Architectural Decision: WebSocket Server in Rust

The Rust backend already has `tokio = { features = ["full"] }` — adding `tokio-tungstenite` gives us a native WebSocket server with zero additional processes.

**Flow:**
```
Host machine:
  Tauri Rust process starts a WS server on 0.0.0.0:PORT
  Host's React app connects to ws://localhost:PORT
  All SQLite writes happen only on the host

Client machine (remote):
  React app connects to ws://HOST_IP:PORT
  No SQLite — all state lives in React memory
```

**New Rust commands** in `lib.rs`:
| Command | Description |
|---|---|
| `start_collab_server(port: u16)` | Spawns tokio task with WS listener |
| `stop_collab_server()` | Shuts down server gracefully |
| `get_collab_status()` | Returns { running, port, peer_count } |
| `get_local_ips()` | Returns LAN IPs to display to user |

The server is a **dumb relay**: it assigns each connection a `clientId` and broadcasts any message from one client to all others.

---

### 2. Frontend Integration

#### 2a. `useCollaboration` hook (`src/hooks/useCollaboration.ts`)

Uses `react-use-websocket` to manage the WS connection:
- **Host mode**: starts Rust WS server via Tauri command, then connects as a client
- **Client mode**: connects to `ws://host:port`
- **Message dispatch**: receives `action` messages, deduplicates by `actionId`, applies to local store
- **State sync request**: new clients request full state; host responds with current `{ blueprints, instances, dynamicData, hiddenDays, theme, bandedRows }`
- **User awareness**: broadcasts/receives `user:join`, `user:leave` with user-assigned color
- **Heartbeat**: periodic ping/pong for connection health

#### 2b. Integration with `useTimetableStore`

The store needs minimal changes:

1. Add a `isRemoteUpdate` parameter to `commitState()`. When true, skip history push and SQL write (these actions come from remote, host shouldn't re-write its DB).

2. Expose a `receiveRemoteAction` function that applies arbitrary mutations to the store (bypassing history, bypassing broadcast).

3. After each local mutation (when collab is active), call a registered `broadcastAction` callback.

**Implementation approach:** Add a `collabBroadcastRef` to the store hook. When collab connects, it sets this ref. After `commitState` (for non-remote, non-undo/redo actions), if the ref is set, call it with the action payload.

#### 2c. Wire Protocol

```typescript
// Client-to-Server (relayed to all peers)
interface CollabMessage {
  type: 'action' | 'state:request' | 'state:full' | 'user:join' | 'user:leave' | 'cursor' | 'ping' | 'pong';
  clientId: string;
  actionId?: string;        // unique id for dedup ('clientId:counter')
  timestamp?: number;
  action?: CollabAction;     // for type: 'action'
  state?: CollabState;       // for type: 'state:full'
  userName?: string;
  userColor?: string;
  targetClientId?: string;   // for directed messages like state:full
}

interface CollabAction {
  op: 'addBlueprint' | 'addInstance' | 'addInstances' 
    | 'updateInstance' | 'deleteBlueprint' | 'deleteBlueprints' 
    | 'deleteInstance' | 'setHiddenDays' | 'updateTheme' 
    | 'updateBandedRows'
    | 'addDynamicData' | 'deleteDynamicData' | 'updateDynamicData'
    | 'addLinksBatched';
  payload: unknown; // the specific parameters for each op
}

interface CollabState {
  blueprints: SubjectEntry[];
  instances: SubjectEntry[];
  dynamicData: DynamicData[];
  hiddenDays: DayOfWeek[];
  theme: string;
  bandedRows: boolean;
}
```

#### 2d. UI Components

- **CollabStatusBar**: Shows connection status, user count, session info (in StatusBar or RibbonToolbar)
- **StartSessionModal**: On host side — shows IP/port, QR code, session ID; button to start
- **JoinSessionModal**: On client side — input for IP:port
- **UserIndicators**: Colored dots/avatars showing connected users
- **RemoteEditHighlight**: Briefly highlight cells/subjects being modified by remote users (QoL)

---

### 3. Questions / Clarifications Needed

1. **Who can edit?** Should remote clients have full read-write access, or should the host approve changes (e.g. host is read-write, clients can suggest)? You said both can modify — confirming full RW for all?

2. **Undo/redo scope?** In collab mode, undo can be:
   - **Per-user**: each user undoes only their own actions (remote actions don't go on your undo stack)
   - **Last action globally**: whoever acted last, their action is undone
   - I recommend **per-user** — less confusing, aligns with in-memory undo

3. **User identity?** How should users identify themselves? Options:
   - Auto-assigned random name (e.g. "User-7a3f") + color
   - Manual name entry on join
   - System hostname auto-detection

4. **State authority — who sends full state to a new joiner?** The host should be the authority since it has the SQLite DB. New clients request state from the host via a directed message.

5. **Conflict resolution strategy?** For same-item concurrent edits:
   - **Last-Writer-Wins** (simplest, actionId dedup + timestamp)
   - **Lock-based**: user "locks" an item before editing
   - I recommend LWW for v1 with visual conflict notifications

---

### 4. Improvements / Optimizations / QoL

#### Performance Optimizations

| # | Improvement | Description |
|---|---|---|
| 1 | **Debounce SQLite writes** | Currently every mutation writes to SQLite immediately. Batch writes with a short debounce (500ms). Reduces disk I/O, especially during bulk imports. |
| 2 | **Compressed state sync** | When sending full state to a new joiner, the JSON can be large (thousands of entries). Consider zlib compression in Rust or streaming. |
| 3 | **Optimistic + ack** | For collab, apply mutation locally immediately (optimistic), then broadcast. No need to wait for server confirmation on LAN. |
| 4 | **Dedup by actionId** | Each action gets a unique `clientId:counter` — clients ignore duplicate actionIds to prevent echo loops. |

#### Quality-of-Life Features

| # | Feature | Description |
|---|---|---|
| 1 | **Auto-discovery (mDNS)** | Broadcast presence via mDNS so clients can discover hosts without typing IP. Could use a Rust crate or show IP in the UI. Simpler: show IP prominently + QR code for the URL. |
| 2 | **Connection health** | Display connection latency, reconnection with exponential backoff, visual indicator (green/yellow/red). |
| 3 | **Remote edit cursor** | Show which subject/instance a remote user is currently editing (colored border or overlay). |
| 4 | **User avatars** | Colored circles with initials in the toolbar showing connected users. Click to see who is who. |
| 5 | **Session password** | Optional simple passphrase to prevent unauthorized access on the LAN. |
| 6 | **Read-only mode** | Allow joining as read-only (view only, no edits). Useful for supervisors. |
| 7 | **Host transition** | If the host disconnects, capability to designate a new host (or gracefully end session). |
| 8 | **Auto-save on host** | When host receives remote changes, auto-save to the .ttcl file (or mark dirty). |

#### Code Quality Improvements

| # | Improvement | Description |
|---|---|---|
| 1 | **Extract action types** | Move `CollabAction` type union to `src/types.ts` for reuse. |
| 2 | **Separate collab module** | All collab logic in `src/collaboration/` — hook, types, protocol, UI components. |
| 3 | **Configurable port** | Default port 9182 (choose something unlikely to conflict), configurable in preferences. |
| 4 | **Tauri capability** | Add `core:event:default` for Tauri events from Rust → React (for server status notifications). |

---

### 5. Implementation Order

1. **Rust: WebSocket server** — Cargo.toml deps, server module, Tauri commands (`start/stop/get_status/get_local_ips`)
2. **`useCollaboration` hook** — WS connection, message dispatch, protocol
3. **Store integration** — `commitState` remote flag, `receiveRemoteAction`, broadcast callback
4. **UI: Host/Join modals** — Session start/join UI
5. **UI: Status indicators** — Connection status, user list
6. **UI: Remote highlights** — Real-time edit indicators
7. **Polish & testing** — Reconnection, error handling, edge cases

---

Would you like me to proceed with any specific direction? The key decisions I need from you are items in section 3 (edit permissions, undo scope, identity, conflict resolution).

---

## User

for commiting states. use a queue system where our actions will be in a queue and the queue will commit its elements sequentially. the commited states will be persisted in the database. also display a right sidebar that shows all commited state, who created the state and the time and date.

use npm i queue to create the queue.

for questions
1. the host client will assign a default permission to all clients who will join the collaboration. the permission will be using checkbox (all, write, delete, create)

All - client has all access
Write - client can edit data on the file
Delete - client can delete contents in the file
Create - client can create data on the file

if All is checked, all other checkboxes will be checked. if All is unchecked, all other checkboxes will be unchecked. if All is checked and i uncheck a checkbox, the All checkbox will be unchecked. if i manually check all checkboxes, it will check the All checkbox.

in the top navigation bar beside the nav controls (minimize, maximize, close) put a profile head icons button. when i click on it, it will show a dropdown popup and shows all connected clients.

i can modify permissions in there for each client.

when i host or join, i must set a name first.

---

## Assistant (Plan · DeepSeek V4 Flash Free · 2.0s)

---

## User

for commiting states. use a queue system where our actions will be in a queue and the queue will commit its elements sequentially. the commited states will be persisted in the database. also display a right sidebar that shows all commited state, who created the state and the time and date.

use npm i queue to create the queue.

for questions
Question 1. the host client will assign a default permission to all clients who will join the collaboration. the permission will be using checkbox (all, write, delete, create)

All - client has all access
Write - client can edit data on the file
Delete - client can delete contents in the file
Create - client can create data on the file

if All is checked, all other checkboxes will be checked. if All is unchecked, all other checkboxes will be unchecked. if All is checked and i uncheck a checkbox, the All checkbox will be unchecked. if i manually check all checkboxes, it will check the All checkbox.

in the top navigation bar beside the nav controls (minimize, maximize, close) put a profile head icons button. when i click on it, it will show a dropdown popup and shows all connected clients.

i can modify permissions in there for each client.

when i host or join, i must set a name first.

Question 2. Undo will be per user. when undoing an action, it will not delete its entry in the commit history, but will display an undo action.

Question 3. Manual name entry on host or join. the default value will be the name of the host device.

Question 4. do that.

Question 5. The first writer wins and the item also gets locked when being edited.

---

## Assistant (Plan · DeepSeek V4 Flash Free · 6.1s)

_Thinking:_

The user wants:

1. A queue system using `npm i queue` to process commits sequentially
2. A right sidebar showing commit history (who, when)
3. Permission system with checkboxes (All, Write, Delete, Create)
4. Profile head icon in title bar showing connected clients
5. Per-client permission management via dropdown
6. Name entry when hosting/joining (default: host device name)
7. First-writer-wins with item locking during editing
8. Per-user undo (marks as undo action in history, doesn't delete entry)

Let me first check what `npm i queue` provides, and then explore the TitleBar component since that's where the profile icon needs to go.

Actually wait - the user mentioned "top navigation bar beside the nav controls (minimize, maximize, close)" - this is the TitleBar component. Let me check it.

Also, I need to understand how the commit queue would work. The user wants:
- A queue (`npm i queue`) that processes actions sequentially
- Each action is committed (applied to state + persisted to DB)
- A right sidebar shows all committed states with author and timestamp

Let me explore the TitleBar and understand the current layout.

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\Dev\\Projects\\Timetable\\src\\components\\TitleBar.tsx"
}
```

**Output:**
```
<path>C:\Dev\Projects\Timetable\src\components\TitleBar.tsx</path>
<type>file</type>
<content>
1: import { useState, useEffect } from "react";
2: import { Dropdown, Modal, Input, message } from "antd";
3: import type { MenuProps } from "antd";
4: import {
5:   FileOutlined,
6:   PlusOutlined,
7:   FolderOpenOutlined,
8:   CloseOutlined,
9:   SaveOutlined,
10:   DownloadOutlined,
11:   SettingOutlined,
12:   MinusOutlined,
13:   BorderOutlined,
14:   UndoOutlined,
15:   RedoOutlined,
16:   ImportOutlined,
17:   ExportOutlined,
18: } from "@ant-design/icons";
19: import { getCurrentWindow } from "@tauri-apps/api/window";
20: import { open as openDialog } from "@tauri-apps/plugin-dialog";
21: import Database from "@tauri-apps/plugin-sql";
22: import type { TimetableMeta } from "../types";
23: 
24: interface TitleBarProps {
25:   /** Current page — controls which File items are enabled */
26:   page: "home" | "timetable" | "preferences";
27:   /** Name of the open timetable (timetable page only) */
28:   timetableName?: string;
29:   /** Called to open a timetable for editing */
30:   onOpenTimetable?: (meta: TimetableMeta) => void;
31:   /** Called to open a .ttcl collection file */
32:   onOpenCollection?: () => void;
33:   /** Called to close the open timetable (go back to home) */
34:   onCloseTimetable?: () => void;
35:   /** Called to trigger File > Save As (XLSX export) */
36:   onSaveAs?: () => void;
37:   /** Called to trigger File > Save (JSON export) */
38:   onSave?: () => void;
39:   /** Called to trigger Export JSON Data */
40:   onExportJson?: () => void;
41:   /** Called to trigger Export Room Excel */
42:   onExportExcelRoom?: () => void;
43:   /** Called to trigger Export Word (Docx) */
44:   onExportDocx?: () => void;
45:   /** Called to trigger Import and Merge */
46:   onImportMerge?: () => void;
47:   /** Called to trigger Import Blueprints from Excel */
48:   onImportExcel?: () => void;
49:   /** Called to open the Preferences page */
50:   onOpenPreferences?: () => void;
51:   onUndo?: () => void;
52:   onRedo?: () => void;
53:   canUndo?: boolean;
54:   canRedo?: boolean;
55: }
56: 
57: /** Custom frameless title bar with a File dropdown menu and window controls. */
58: export function TitleBar({
59:   page,
60:   timetableName,
61:   onOpenTimetable,
62:   onCloseTimetable,
63:   onSaveAs,
64:   onSave,
65:   onExportJson,
66:   onExportExcelRoom,
67:   onExportDocx,
68:   onImportMerge,
69:   onImportExcel,
70:   onOpenPreferences,
71:   onUndo,
72:   onRedo,
73:   canUndo = false,
74:   canRedo = false,
75: }: TitleBarProps) {
76:   const [messageApi, contextHolder] = message.useMessage();
77: 
78:   // New timetable modal state
79:   const [newModalOpen, setNewModalOpen] = useState(false);
80:   const [newName, setNewName] = useState("");
81:   const [creating, setCreating] = useState(false);
82: 
83:   const isTimetable = page === "timetable";
84: 
85:   // Listen for keyboard shortcut events dispatched by App.tsx
86:   useEffect(() => {
87:     function onNew() { setNewName(""); setNewModalOpen(true); }
88:     function onOpen() { void handleOpen(); }
89:     window.addEventListener("titlebar:new", onNew);
90:     window.addEventListener("titlebar:open", onOpen);
91:     return () => {
92:       window.removeEventListener("titlebar:new", onNew);
93:       window.removeEventListener("titlebar:open", onOpen);
94:     };
95:   }, []); // eslint-disable-line react-hooks/exhaustive-deps
96: 
97:   async function handleCreateTimetable(): Promise<void> {
98:     const trimmed = newName.trim();
99:     if (!trimmed) return;
100:     setCreating(true);
101:     try {
102:       // Directly create the timetable via SQLite — avoids needing useTimetableList here
103:       const db = await Database.load("sqlite:timetable.db");
104:       const id = crypto.randomUUID();
105:       const now = new Date().toISOString();
106:       await db.execute(
107:         "INSERT INTO timetables (id, name, entries_json, entry_count, created_at, updated_at, hidden_days) VALUES ($1, $2, $3, $4, $5, $6, $7)",
108:         [id, trimmed, "[]", 0, now, now, "[\"Sun\"]"],
109:       );
110:       const meta: TimetableMeta = { id, name: trimmed, entryCount: 0, createdAt: now, updatedAt: now, hiddenDays: ["Sun"] };
111:       setNewModalOpen(false);
112:       onOpenTimetable?.(meta);
113:     } catch (e: unknown) {
114:       messageApi.error(`Failed to create: ${e instanceof Error ? e.message : String(e)}`);
115:     } finally {
116:       setCreating(false);
117:     }
118:   }
119: 
120:   async function handleOpen(): Promise<void> {
121:     try {
122:       const filePath = await openDialog({
123:         title: "Open Timetable Collection",
124:         filters: [{ name: "Timetable Collection", extensions: ["ttcl"] }],
125:         multiple: false,
126:         directory: false,
127:       });
128:       if (!filePath || typeof filePath !== "string") return;
129:       // The parent (App.tsx) handles the actual open via collection context
130:       window.dispatchEvent(new CustomEvent('titlebar:open-collection', { detail: { path: filePath } }));
131:     } catch (e: unknown) {
132:       messageApi.error(`Open failed: ${e instanceof Error ? e.message : String(e)}`);
133:     }
134:   }
135: 
136:   async function handleWindowControl(action: "minimize" | "maximize" | "close"): Promise<void> {
137:     const win = getCurrentWindow();
138:     if (action === "minimize") await win.minimize();
139:     else if (action === "maximize") {
140:       const isMax = await win.isMaximized();
141:       if (isMax) await win.unmaximize();
142:       else await win.maximize();
143:     } else {
144:       window.dispatchEvent(new CustomEvent('titlebar:before-close'));
145:     }
146:   }
147: 
148:   useEffect(() => {
149:     const handleConfirmClose = () => {
150:       const win = getCurrentWindow();
151:       win.close();
152:     };
153:     window.addEventListener('titlebar:confirm-close', handleConfirmClose);
154:     return () => window.removeEventListener('titlebar:confirm-close', handleConfirmClose);
155:   }, []);
156: 
157:   // Render a menu label with an optional right-aligned shortcut hint
158:   function label(text: string, shortcut?: string): React.ReactNode {
159:     return (
160:       <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 32 }}>
161:         <span>{text}</span>
162:         {shortcut && (
163:           <span style={{ fontSize: 11, color: "rgba(0,0,0,0.38)", letterSpacing: 0.3 }}>{shortcut}</span>
164:         )}
165:       </span>
166:     );
167:   }
168: 
169:   const fileMenuItems: MenuProps["items"] = [
170:     { key: "new",       label: label("New",          "Ctrl+N"), icon: <PlusOutlined />,       onClick: () => { setNewName(""); setNewModalOpen(true); } },
171:     { key: "open",      label: label("Open",         "Ctrl+O"), icon: <FolderOpenOutlined />, onClick: () => { void handleOpen(); } },
172:     { type: "divider" },
173:     { key: "close",     label: label("Close",        "Ctrl+Q"), icon: <CloseOutlined />,      disabled: !isTimetable, onClick: onCloseTimetable },
174:     { key: "save",      label: label("Save",         "Ctrl+S"), icon: <SaveOutlined />,       disabled: !isTimetable, onClick: onSave },
175:     { key: "save-as",   label: label("Save As…", "Ctrl+Shift+S"), icon: <DownloadOutlined />,   disabled: !isTimetable, onClick: onSaveAs },
176:     {
177:       key: "import", label: label("Import"), icon: <ImportOutlined />, disabled: !isTimetable,
178:       children: [
179:         { key: "import-json", label: label("Import Collection Data (JSON)"), onClick: onImportMerge },
180:         { key: "import-excel", label: label("Import Blueprints from Excel"), onClick: onImportExcel },
181:       ],
182:     },
183:     {
184:       key: "export", label: label("Export"), icon: <ExportOutlined />, disabled: !isTimetable,
185:       children: [
186:         { key: "export-json", label: label("Export Collection Data (JSON)"), onClick: onExportJson },
187:         { key: "export-excel-room", label: label("Export Room Timetable (Excel)"), onClick: onExportExcelRoom },
188:         { key: "export-docx", label: label("Export Timetable (Word/Docx)"), onClick: onExportDocx },
189:       ],
190:     },
191:     { type: "divider" },
192:     { key: "undo",      label: label("Undo",         "Ctrl+Z"), icon: <UndoOutlined />,       disabled: !canUndo, onClick: onUndo },
193:     { key: "redo",      label: label("Redo",         "Ctrl+Shift+Z"), icon: <RedoOutlined />, disabled: !canRedo, onClick: onRedo },
194:     { type: "divider" },
195:     { key: "prefs",     label: label("Preferences"),            icon: <SettingOutlined />,    onClick: onOpenPreferences },
196:   ];
197: 
198:   const winBtnStyle: React.CSSProperties = {
199:     width: 38,
200:     height: 32,
201:     background: "transparent",
202:     border: "none",
203:     color: "#7A8BA8",
204:     cursor: "pointer",
205:     display: "flex",
206:     alignItems: "center",
207:     justifyContent: "center",
208:     fontSize: 11,
209:     transition: "background 0.15s, color 0.15s",
210:     flexShrink: 0,
211:   };
212: 
213:   return (
214:     <>
215:       {contextHolder}
216: 
217:       <div
218:         data-tauri-drag-region
219:         style={{
220:           height: 32,
221:           background: "#FFFFFF",
222:           display: "flex",
223:           alignItems: "center",
224:           justifyContent: "space-between",
225:           userSelect: "none",
226:           flexShrink: 0,
227:           cursor: "default",
228:           boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
229:         }}
230:       >
231:         {/* Left: File menu + breadcrumb */}
232:         <div style={{ display: "flex", alignItems: "center" }}>
233:           <div onMouseDown={(e) => e.stopPropagation()}>
234:             <Dropdown menu={{ items: fileMenuItems }} trigger={["click"]} placement="bottomLeft">
235:               <button
236:                 style={{
237:                   background: "transparent",
238:                   border: "none",
239:                   color: "#1A2640",
240:                   fontSize: 12,
241:                   fontWeight: 500,
242:                   cursor: "pointer",
243:                   padding: "0 12px",
244:                   height: 32,
245:                   display: "flex",
246:                   alignItems: "center",
247:                   gap: 5,
248:                   transition: "background 0.15s",
249:                 }}
250:                 onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.05)"; }}
251:                 onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
252:               >
253:                 <FileOutlined style={{ fontSize: 11 }} /> File
254:               </button>
255:             </Dropdown>
256:           </div>
257: 
258:           {/* Breadcrumb — pointer-events none so drag falls through to bar background */}
259:           <div style={{ paddingLeft: 8, display: "flex", alignItems: "center", gap: 5, pointerEvents: "none" }}>
260:             <span style={{ color: "#7A8BA8", fontSize: 12, fontWeight: 600 }}>Timetable</span>
261:             {timetableName && (
262:               <>
263:                 <span style={{ color: "#D0D7E3", fontSize: 12 }}>›</span>
264:                 <span style={{ color: "#1A2640", fontSize: 12, fontWeight: 500 }}>{timetableName}</span>
265:               </>
266:             )}
267:           </div>
268:         </div>
269: 
270:         {/* Right: window controls */}
271:         <div style={{ display: "flex", alignItems: "center" }} onMouseDown={(e) => e.stopPropagation()}>
272:           {(["minimize", "maximize", "close"] as const).map((action) => (
273:             <button
274:               key={action}
275:               onClick={() => void handleWindowControl(action)}
276:               aria-label={action}
277:               style={winBtnStyle}
278:               onMouseEnter={(e) => {
279:                 const btn = e.currentTarget as HTMLButtonElement;
280:                 btn.style.background = action === "close" ? "#C42B1C" : "rgba(0,0,0,0.06)";
281:                 btn.style.color = action === "close" ? "#FFFFFF" : "#1A2640";
282:               }}
283:               onMouseLeave={(e) => {
284:                 const btn = e.currentTarget as HTMLButtonElement;
285:                 btn.style.background = "transparent";
286:                 btn.style.color = "#7A8BA8";
287:               }}
288:             >
289:               {action === "minimize" && <MinusOutlined />}
290:               {action === "maximize" && <BorderOutlined />}
291:               {action === "close"    && <CloseOutlined style={{ fontSize: 11 }} />}
292:             </button>
293:           ))}
294:         </div>
295:       </div>
296: 
297:       {/* New Timetable modal */}
298:       <Modal
299:         title="New Timetable"
300:         open={newModalOpen}
301:         onOk={handleCreateTimetable}
302:         onCancel={() => setNewModalOpen(false)}
303:         okText="Create"
304:         okButtonProps={{ loading: creating, disabled: !newName.trim() }}
305:         destroyOnClose
306:       >
307:         <div style={{ paddingTop: 8 }}>
308:           <Input
309:             id="titlebar-new-timetable-name"
310:             placeholder="Timetable name"
311:             value={newName}
312:             onChange={(e) => setNewName(e.target.value)}
313:             onPressEnter={handleCreateTimetable}
314:             maxLength={80}
315:             autoFocus
316:           />
317:         </div>
318:       </Modal>
319:     </>
320:   );
321: }

(End of file - total 321 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\Dev\\Projects\\Timetable\\src\\App.tsx"
}
```

**Output:**
```
<path>C:\Dev\Projects\Timetable\src\App.tsx</path>
<type>file</type>
<content>
1: import { useState, useEffect, useRef } from 'react';
2: import { Modal, List, Button } from 'antd';
3: import { HomePage } from './pages/HomePage';
4: import { TimetablePage } from './pages/TimetablePage';
5: import { PreferencesPage } from './pages/PreferencesPage';
6: import { TitleBar } from './components/TitleBar';
7: import { PreferencesProvider } from './context/PreferencesContext';
8: import { CollectionProvider, useCollection } from './hooks/useCollectionContext';
9: import type { TimetableMeta } from './types';
10: import { listen } from '@tauri-apps/api/event';
11: import { invoke } from '@tauri-apps/api/core';
12: 
13: type Page = 'home' | 'timetable' | 'preferences';
14: 
15: /**
16:  * Root application router.
17:  * Uses simple state-based navigation — no external router library required.
18:  */
19: function AppInner() {
20:   const [page, setPage] = useState<Page>('home');
21:   const [activeTimetable, setActiveTimetable] = useState<TimetableMeta | null>(null);
22:   const [isFormOpen, setIsFormOpen] = useState(false);
23:   const collection = useCollection();
24: 
25:   useEffect(() => {
26:     const unlistenReady = listen('subject-form:ready', () => {
27:       setIsFormOpen(true);
28:     });
29:     const unlistenClosed = listen('subject-form:closed', () => {
30:       setIsFormOpen(false);
31:     });
32:     const unlistenSuccess = listen('subject-form:success', () => {
33:       setIsFormOpen(false);
34:     });
35: 
36:     return () => {
37:       unlistenReady.then((fn) => fn());
38:       unlistenClosed.then((fn) => fn());
39:       unlistenSuccess.then((fn) => fn());
40:     };
41:   }, []);
42: 
43:   // Check for a .ttcl file passed via CLI args (double-click association)
44:   useEffect(() => {
45:     async function checkOpenedFile() {
46:       try {
47:         const filePath = await invoke<string | null>('get_opened_file');
48:         if (filePath && typeof filePath === 'string') {
49:           const timetables = await collection.openCollection(filePath);
50:           if (timetables.length > 0) {
51:             setActiveTimetable(timetables[0]);
52:             setPage('timetable');
53:           }
54:         }
55:       } catch {
56:         // not running in Tauri or command not available
57:       }
58:     }
59:     void checkOpenedFile();
60:   }, []); // eslint-disable-line react-hooks/exhaustive-deps
61: 
62:   // Triggers for TitleBar → page communication (incremented to fire actions)
63:   const [exportTrigger, setExportTrigger] = useState(0);
64:   const [saveTrigger, setSaveTrigger] = useState(0);
65:   const [importMergeTrigger, setImportMergeTrigger] = useState(0);
66:   const [exportJsonTrigger, setExportJsonTrigger] = useState(0);
67:   const [exportExcelRoomTrigger, setExportExcelRoomTrigger] = useState(0);
68:   const [importExcelTrigger, setImportExcelTrigger] = useState(0);
69: 
70:   // DOCX template state and QoL recent template lists
71:   const [docxTemplate, setDocxTemplate] = useState<{ name: string; path: string; bytes: Uint8Array } | null>(null);
72:   const [exportDocxModalOpen, setExportDocxModalOpen] = useState(false);
73:   const [recentTemplates, setRecentTemplates] = useState<{ name: string; path: string }[]>([]);
74: 
75:   useEffect(() => {
76:     try {
77:       const saved = localStorage.getItem('recent_docx_templates');
78:       if (saved) {
79:         setRecentTemplates(JSON.parse(saved));
80:       }
81:     } catch (e) {
82:       console.error('Failed to load recent templates', e);
83:     }
84:   }, [exportDocxModalOpen]);
85: 
86:   async function loadTemplateFromPath(path: string) {
87:     try {
88:       const bytes = await invoke<number[]>('read_file_bytes', { path });
89:       const name = path.split(/[\\/]/).pop() || 'template.docx';
90:       
91:       const newTemplate = { name, path, bytes: new Uint8Array(bytes) };
92:       setDocxTemplate(newTemplate);
93:       setExportDocxModalOpen(false);
94: 
95:       // Add to recent templates in localStorage
96:       let updated = [{ name, path }, ...recentTemplates.filter(t => t.path !== path)];
97:       updated = updated.slice(0, 3);
98:       localStorage.setItem('recent_docx_templates', JSON.stringify(updated));
99:       setRecentTemplates(updated);
100:     } catch (err: unknown) {
101:       const { message: showMessage } = await import('@tauri-apps/plugin-dialog');
102:       await showMessage(`Failed to read template: ${err instanceof Error ? err.message : String(err)}`, { title: 'Error', kind: 'error' });
103:     }
104:   }
105: 
106:   async function handleBrowseTemplate() {
107:     try {
108:       const { open } = await import('@tauri-apps/plugin-dialog');
109:       const selected = await open({
110:         title: 'Select Word Template',
111:         filters: [{ name: 'Word Documents', extensions: ['docx'] }],
112:         multiple: false,
113:         directory: false,
114:       });
115:       if (selected && typeof selected === 'string') {
116:         await loadTemplateFromPath(selected);
117:       }
118:     } catch (err: unknown) {
119:       const { message: showMessage } = await import('@tauri-apps/plugin-dialog');
120:       await showMessage(`Error choosing template: ${err instanceof Error ? err.message : String(err)}`, { title: 'Error', kind: 'error' });
121:     }
122:   }
123: 
124:   // Stable refs so the keydown handler doesn't close over stale state
125:   const pageRef = useRef(page);
126:   const openTimetableRef = useRef<((meta: TimetableMeta) => void) | null>(null);
127:   const closeTimetableRef = useRef<(() => void) | null>(null);
128:   const isDirtyRef = useRef(false);
129:   useEffect(() => { pageRef.current = page; }, [page]);
130: 
131:   function openTimetable(meta: TimetableMeta): void {
132:     setActiveTimetable(meta);
133:     setPage('timetable');
134:   }
135:   openTimetableRef.current = openTimetable;
136: 
137:   async function closeTimetable(): Promise<void> {
138:     if (isDirtyRef.current) {
139:       const { ask } = await import('@tauri-apps/plugin-dialog');
140:       const confirmed = await ask(
141:         'You have unsaved changes. Are you sure you want to close?',
142:         { title: 'Unsaved Changes', kind: 'warning', okLabel: 'Close Anyway', cancelLabel: 'Cancel' }
143:       );
144:       if (!confirmed) return;
145:     }
146:     setActiveTimetable(null);
147:     setPage('home');
148:   }
149:   closeTimetableRef.current = closeTimetable;
150: 
151:   const [canUndo, setCanUndo] = useState(false);
152:   const [canRedo, setCanRedo] = useState(false);
153: 
154:   useEffect(() => {
155:     const handleHistoryChange = (e: Event) => {
156:       const customEvent = e as CustomEvent<{ canUndo: boolean; canRedo: boolean; isDirty?: boolean }>;
157:       setCanUndo(customEvent.detail.canUndo);
158:       setCanRedo(customEvent.detail.canRedo);
159:       if (customEvent.detail.isDirty !== undefined) {
160:         isDirtyRef.current = customEvent.detail.isDirty;
161:       }
162:     };
163:     const handleDirtyChange = (e: Event) => {
164:       const customEvent = e as CustomEvent<{ isDirty: boolean }>;
165:       isDirtyRef.current = customEvent.detail.isDirty;
166:     };
167:     window.addEventListener('store:history-change', handleHistoryChange);
168:     window.addEventListener('store:dirty-change', handleDirtyChange);
169:     return () => {
170:       window.removeEventListener('store:history-change', handleHistoryChange);
171:       window.removeEventListener('store:dirty-change', handleDirtyChange);
172:     };
173:   }, []);
174: 
175:   // Listen for window close request from TitleBar (red X button)
176:   useEffect(() => {
177:     async function onBeforeClose() {
178:       if (isDirtyRef.current) {
179:         const { ask } = await import('@tauri-apps/plugin-dialog');
180:         const confirmed = await ask(
181:           'You have unsaved changes. Are you sure you want to close?',
182:           { title: 'Unsaved Changes', kind: 'warning', okLabel: 'Close Anyway', cancelLabel: 'Cancel' }
183:         );
184:         if (!confirmed) return;
185:       }
186:       window.dispatchEvent(new CustomEvent('titlebar:confirm-close'));
187:     }
188:     window.addEventListener('titlebar:before-close', onBeforeClose);
189:     return () => window.removeEventListener('titlebar:before-close', onBeforeClose);
190:   }, []);
191: 
192:   // Listen for collection-related events from TitleBar
193:   useEffect(() => {
194:     function onOpenCollection(e: Event) {
195:       const detail = (e as CustomEvent<{ path: string }>).detail;
196:       if (detail?.path) {
197:         collection.openCollection(detail.path).then((timetables) => {
198:           if (timetables.length > 0 && pageRef.current !== 'timetable') {
199:             setActiveTimetable(timetables[0]);
200:             setPage('timetable');
201:           }
202:         }).catch((err) => {
203:           console.error('Failed to open collection:', err);
204:         });
205:       }
206:     }
207: 
208:     window.addEventListener('titlebar:open-collection', onOpenCollection);
209:     return () => {
210:       window.removeEventListener('titlebar:open-collection', onOpenCollection);
211:     };
212:   }, [collection]);
213: 
214:   // Global keyboard shortcuts
215:   useEffect(() => {
216:     function onKeyDown(e: KeyboardEvent): void {
217:       if (!e.ctrlKey && !e.metaKey) return;
218:       // Don't intercept when typing inside an input/textarea
219:       const tag = (document.activeElement?.tagName ?? '').toLowerCase();
220:       const key = e.key.toLowerCase();
221:       const isUndoRedoOrSave = key === 'z' || key === 'y' || key === 's';
222:       if ((tag === 'input' || tag === 'textarea') && !isUndoRedoOrSave) return;
223: 
224:       switch (e.key.toLowerCase()) {
225:         case 'n':
226:           e.preventDefault();
227:           window.dispatchEvent(new CustomEvent('titlebar:new'));
228:           break;
229:         case 'o':
230:           e.preventDefault();
231:           window.dispatchEvent(new CustomEvent('titlebar:open'));
232:           break;
233:         case 'q':
234:           e.preventDefault();
235:           if (pageRef.current === 'timetable') closeTimetableRef.current?.();
236:           break;
237:         case 's':
238:           e.preventDefault();
239:           if (pageRef.current === 'timetable') {
240:             if (e.shiftKey) setExportTrigger((n) => n + 1);
241:             else setSaveTrigger((n) => n + 1);
242:           }
243:           break;
244:         case 'z':
245:           e.preventDefault();
246:           if (e.shiftKey) {
247:             window.dispatchEvent(new CustomEvent('titlebar:redo'));
248:           } else {
249:             window.dispatchEvent(new CustomEvent('titlebar:undo'));
250:           }
251:           break;
252:         case 'r':
253:           e.preventDefault();
254:           window.dispatchEvent(new CustomEvent('titlebar:redo'));
255:           break;
256:         default:
257:           break;
258:       }
259:     }
260: 
261:     window.addEventListener('keydown', onKeyDown);
262:     return () => window.removeEventListener('keydown', onKeyDown);
263:   }, []);
264: 
265:   return (
266:     <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
267:       <TitleBar
268:         page={page}
269:         timetableName={activeTimetable?.name}
270:         onOpenTimetable={openTimetable}
271:         onOpenCollection={() => {}}
272:         onCloseTimetable={closeTimetable}
273:         onSaveAs={() => setExportTrigger((n) => n + 1)}
274:         onSave={() => setSaveTrigger((n) => n + 1)}
275:         onExportJson={() => setExportJsonTrigger((n) => n + 1)}
276:         onExportExcelRoom={() => setExportExcelRoomTrigger((n) => n + 1)}
277:         onExportDocx={() => setExportDocxModalOpen(true)}
278:         onImportMerge={() => setImportMergeTrigger((n) => n + 1)}
279:         onImportExcel={() => setImportExcelTrigger((n) => n + 1)}
280:         onOpenPreferences={() => setPage('preferences')}
281:         canUndo={canUndo}
282:         canRedo={canRedo}
283:         onUndo={() => window.dispatchEvent(new CustomEvent('titlebar:undo'))}
284:         onRedo={() => window.dispatchEvent(new CustomEvent('titlebar:redo'))}
285:       />
286: 
287:       <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
288:         {page === 'home' && (
289:           <HomePage onOpen={openTimetable} />
290:         )}
291:         {page === 'timetable' && activeTimetable && (
292:           <TimetablePage
293:             timetableId={activeTimetable.id}
294:             timetableName={activeTimetable.name}
295:             onBack={closeTimetable}
296:             exportTrigger={exportTrigger}
297:             saveTrigger={saveTrigger}
298:             importMergeTrigger={importMergeTrigger}
299:             exportJsonTrigger={exportJsonTrigger}
300:             exportExcelRoomTrigger={exportExcelRoomTrigger}
301:             importExcelTrigger={importExcelTrigger}
302:             docxTemplate={docxTemplate}
303:             onClearDocxTemplate={() => setDocxTemplate(null)}
304:           />
305:         )}
306:         {page === 'preferences' && (
307:           <PreferencesPage onBack={() => setPage(activeTimetable ? 'timetable' : 'home')} />
308:         )}
309:       </div>
310: 
311:       {isFormOpen && (
312:         <div
313:           style={{
314:             position: 'fixed',
315:             top: 0,
316:             left: 0,
317:             right: 0,
318:             bottom: 0,
319:             background: 'rgba(0,0,0,0.15)',
320:             zIndex: 999999,
321:             cursor: 'not-allowed',
322:           }}
323:           onClick={(e) => {
324:             e.stopPropagation();
325:             e.preventDefault();
326:           }}
327:         />
328:       )}
329: 
330:       {/* ── Export DOCX Template Selector Modal ── */}
331:       <Modal
332:         title="Export Timetable using Word (DOCX) Template"
333:         open={exportDocxModalOpen}
334:         onCancel={() => setExportDocxModalOpen(false)}
335:         footer={[
336:           <Button key="cancel" onClick={() => setExportDocxModalOpen(false)}>
337:             Cancel
338:           </Button>,
339:           <Button
340:             key="browse"
341:             type="primary"
342:             onClick={handleBrowseTemplate}
343:             style={{ background: '#3D6B50', borderColor: '#3D6B50' }}
344:           >
345:             Use Template (Browse)...
346:           </Button>
347:         ]}
348:         width={500}
349:       >
350:         <div style={{ marginBottom: 16, fontSize: 13, color: '#555' }}>
351:           Select an existing Word document (.docx) template. You can visually select a position on any page to paste the timetable image.
352:         </div>
353:         {recentTemplates.length > 0 && (
354:           <div style={{ marginTop: 12 }}>
355:             <div style={{ fontWeight: 600, marginBottom: 8, color: '#3D6B50', fontSize: 12 }}>
356:               Recent Templates:
357:             </div>
358:             <List
359:               dataSource={recentTemplates}
360:               size="small"
361:               bordered
362:               renderItem={(item) => (
363:                 <List.Item
364:                   actions={[
365:                     <Button
366:                       type="link"
367:                       onClick={() => loadTemplateFromPath(item.path)}
368:                       style={{ color: '#3D6B50', padding: 0 }}
369:                     >
370:                       Use Template
371:                     </Button>
372:                   ]}
373:                 >
374:                   <List.Item.Meta
375:                     title={<span style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</span>}
376:                     description={<span style={{ fontSize: 11, color: '#888', wordBreak: 'break-all' }}>{item.path}</span>}
377:                   />
378:                 </List.Item>
379:               )}
380:             />
381:           </div>
382:         )}
383:       </Modal>
384:     </div>
385:   );
386: }
387: 
388: import { getCurrentWindow } from '@tauri-apps/api/window';
389: import { BlueprintFormWindow } from './pages/BlueprintFormWindow';
390: 
391: let initialIsFormWindow = false;
392: try {
393:   initialIsFormWindow = getCurrentWindow().label === 'subject-form';
394: } catch (e) {
395:   // browser fallback
396: }
397: 
398: function App() {
399:   if (initialIsFormWindow) {
400:     return <BlueprintFormWindow />;
401:   }
402: 
403:   return (
404:     <PreferencesProvider>
405:       <CollectionProvider>
406:         <AppInner />
407:       </CollectionProvider>
408:     </PreferencesProvider>
409:   );
410: }
411: 
412: export default App;

(End of file - total 412 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\Dev\\Projects\\Timetable\\src\\pages\\TimetablePage.tsx",
  "limit": 100
}
```

**Output:**
```
<path>C:\Dev\Projects\Timetable\src\pages\TimetablePage.tsx</path>
<type>file</type>
<content>
1: import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
2: import gsap from 'gsap';
3: import { Layout, Typography, Spin, message, Button, Modal, List, Select, Checkbox, ConfigProvider, Drawer, Space, notification, Progress } from 'antd';
4: import { DeleteOutlined } from '@ant-design/icons';
5: import { useTimetableStore } from '../hooks/useTimetableStore';
6: import { getLinks, getConnectedKeys } from '../utils/linkUtils';
7: import { getThemeConfig } from '../theme';
8: import { BlueprintList } from '../components/BlueprintList';
9: import { TimetableGrid } from '../components/TimetableGrid';
10: import { exportToXlsx, exportToXlsxBatch } from '../utils/exportXlsx';
11: import * as ExcelJS from 'exceljs';
12: import { usePreferences } from '../context/PreferencesContext';
13: import { save, ask, open } from '@tauri-apps/plugin-dialog';
14: import { invoke } from '@tauri-apps/api/core';
15: import type { SubjectEntry, DayOfWeek, ConflictInfo, Schedule, DynamicData } from '../types';
16: import { DocxTemplatePreview } from '../components/DocxTemplatePreview';
17: import { exportToDocxTemplate } from '../utils/exportDocx';
18: import { toPng } from 'html-to-image';
19: 
20: import { RibbonToolbar } from '../components/RibbonToolbar';
21: import { PlacedSchedules } from '../components/PlacedSchedules';
22: import { SchedulePropertiesPanel } from '../components/SchedulePropertiesPanel';
23: import { BlueprintForm } from '../components/BlueprintForm';
24: import { ColumnMappingForm } from '../components/ColumnMappingForm';
25: import { detectBlueprintColumns, detectScheduleColumns } from '../utils/autoDetectColumns';
26: import { parseInstructorValue, formatInstructorValue, formatInstructorDisplay } from '../utils/teacherName';
27: import { resolveRoomForSchedule } from '../utils/conflictResolver';
28: import { StatusBar } from '../components/StatusBar';
29: import { useBlueprintSearch } from '../hooks/useBlueprintSearch';
30: import { useCollection } from '../hooks/useCollectionContext';
31: 
32: const { Content } = Layout;
33: const { Text } = Typography;
34: 
35: interface TimetablePageProps {
36:   /** SQLite id of the timetable being edited */
37:   timetableId: string;
38:   /** Display name of the timetable */
39:   timetableName: string;
40:   /** Called when the user navigates back to home */
41:   onBack: () => void;
42:   /** Incremented by TitleBar when File > Save As is triggered */
43:   exportTrigger: number;
44:   /** Incremented when Ctrl+S / File > Save is triggered */
45:   saveTrigger: number;
46:   /** Incremented when File > Import & Merge is triggered */
47:   importMergeTrigger: number;
48:   /** Incremented when File > Export JSON Data is triggered */
49:   exportJsonTrigger: number;
50:   /** Incremented when File > Export Room Timetable is triggered */
51:   exportExcelRoomTrigger: number;
52:   /** Incremented when File > Import Blueprints from Excel is triggered */
53:   importExcelTrigger: number;
54:   /** Word/Docx Template Details */
55:   docxTemplate: { name: string; path: string; bytes: Uint8Array } | null;
56:   /** Callback to clear Word template */
57:   onClearDocxTemplate: () => void;
58: }
59: 
60: function toMin(time: string): number {
61:   const parts = time.split(':');
62:   return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
63: }
64: 
65: function toTime(min: number): string {
66:   const h = Math.floor(min / 60).toString().padStart(2, '0');
67:   const m = (min % 60).toString().padStart(2, '0');
68:   return `${h}:${m}`;
69: }
70: 
71: /** Helper to filter out schedules on hidden days and/or outside the visible time window */
72: function filterEntriesForExport(
73:   entries: SubjectEntry[],
74:   hiddenDays: DayOfWeek[],
75:   excludeHiddenDays: boolean,
76:   viewStart: number,
77:   viewEnd: number,
78:   excludeTimeWindow: boolean,
79: ): SubjectEntry[] {
80:   return entries
81:     .map((entry) => {
82:       const schedules = entry.schedules
83:         .map((sched) => {
84:           // Filter out hidden days if requested
85:           const days = excludeHiddenDays
86:             ? sched.days.filter((d) => !hiddenDays.includes(d))
87:             : sched.days;
88: 
89:           if (days.length === 0) return null;
90: 
91:           const s = toMin(sched.startTime);
92:           const e = toMin(sched.endTime);
93: 
94:           // Filter out if no overlap with time window
95:           if (excludeTimeWindow && (s >= viewEnd || e <= viewStart)) {
96:             return null;
97:           }
98: 
99:           // Clamp times to window if excludeTimeWindow is true
100:           const clampedStart = excludeTimeWindow ? Math.max(s, viewStart) : s;

(Showing lines 1-100 of 3256. Use offset=101 to continue.)
</content>
```

---

## Assistant (Plan · DeepSeek V4 Flash Free · 24.5s)

_Thinking:_

Now I have a comprehensive understanding of the codebase. Let me also check the StatusBar component since the user mentioned a "right sidebar" for commit history, and also look at the current RibbonToolbar to understand the top nav layout.

Let me also think about the `npm i queue` library. The user wants to use `npm i queue` - this is likely the `queue` package on npm (a simple async queue). Let me check what it does.

Actually, the user wants me to present a plan, not to implement yet. Let me formulate the comprehensive plan now.

Key things to address:

1. **Queue system**: Using `npm i queue` package to create an action queue that commits states sequentially
2. **Commit history sidebar**: Right sidebar showing all committed states, who created them, and timestamp
3. **Permission system**: 
   - All, Write, Delete, Create checkboxes
   - All checks/unchecks all others
   - If all manually checked, All auto-checks
   - If All checked and one unchecked, All unchecks
4. **Profile head icon**: In TitleBar beside window controls, shows dropdown with connected clients and per-client permission editing
5. **Name entry on host/join**: Default value is host device name
6. **Undo per user**: Marks as undo in commit history, doesn't delete entry
7. **First-writer-wins + item locking**: When an item is being edited, it gets locked. First write wins.

Let me now think about the full architecture.

### Architecture

#### Queue System (npm i queue)

The `queue` package provides a simple async queue. We'll use it to serialize state commits:

```typescript
import Queue from 'queue';

const commitQueue = new Queue({ concurrency: 1, autostart: true, timeout: 5000 });

// Each commit is a function
function enqueueCommit(action: CommitAction): Promise<void> {
  return new Promise((resolve, reject) => {
    commitQueue.push(async (cb) => {
      try {
        await processCommit(action);
        cb(null, result);
        resolve();
      } catch (err) {
        cb(err);
        reject(err);
      }
    });
  });
}
```

Wait, I need to understand what `npm i queue` actually provides. Let me check.

The `queue` npm package (by Jake Archibald / npm `queue`) is an async job queue. It provides:
- `queue.push(job)` - adds a job
- `queue.start()` - starts processing
- `queue.stop()` - stops
- `queue.concurrency` - set concurrency

A job is a function that receives a callback `(error, result)` or returns a promise.

For our use case, we want:
1. All state commits go through a queue (concurrency 1, FIFO)
2. Each commit action is logged to a commit history
3. The commit history is displayed in a right sidebar

#### Commit History

```typescript
interface CommitEntry {
  id: string;
  action: CollabAction;
  author: string;        // client ID or name
  timestamp: number;     // Date.now()
  type: 'local' | 'remote' | 'undo';
  description: string;   // human-readable "UserX added blueprint CS101"
}
```

The commit history will be stored in:
- React state (for display)
- SQLite (for persistence) — new table `commit_history`

Wait, the user said "the committed states will be persisted in the database". So we need a new SQLite table:

```sql
CREATE TABLE IF NOT EXISTS commit_history (
  id TEXT PRIMARY KEY,
  timetable_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_json TEXT NOT NULL,
  author TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  description TEXT NOT NULL
);
```

#### Right Sidebar

The right sidebar shows the commit history. It should be a collapsible drawer or panel that shows:
- List of commits with scroll
- Each commit shows: icon (type), description, author, time
- Ability to filter by author

This sidebar will be shown/hidden via a toggle button (perhaps in the RibbonToolbar or as part of the collaboration UI).

#### Lock System

First-writer-wins with item locking:
- When a user starts editing an item (opens the form or clicks on a schedule), a `lock` message is broadcast
- The lock is acquired for `clientId` on `itemId`
- Other clients see the item as locked (grayed out, with a lock icon showing who is editing)
- When the user finishes editing (saves or cancels), the lock is released
- If a user tries to edit a locked item, they see a message like "User X is currently editing this item"

Lock storage:
- On the host side, in memory (a `Map<itemId, { clientId, userName, acquiredAt }>`)
- Lock state is broadcast to all clients when it changes
- If a host disconnects, all locks are released

Actually, since the user said "First writer wins", I think the locking is simpler: the first user to start editing an item gets the lock. If another user tries to edit the same item, they're blocked. The lock is released when:
- The user saves the edit (broadcasts the action)
- The user cancels the edit
- The user disconnects

#### Collaboration Hook Structure

```
src/
  hooks/
    useCollaboration.ts       # Main hook (uses react-use-websocket)
    useCommitQueue.ts         # Queue wrapper for sequential commits
    useCommitHistory.ts       # Commit history state + persistence
  components/
    CollabStatusBar.tsx       # Connection status
    CollabHostModal.tsx       # Host setup modal
    CollabJoinModal.tsx       # Join session modal
    CollabUserMenu.tsx        # Profile icon dropdown in titlebar
    CollabPermissionEditor.tsx # Permission editing UI
    CommitHistorySidebar.tsx  # Right sidebar for commit history
    PermissionCheckboxes.tsx   # The All/Write/Delete/Create checkbox group
```

Wait, actually - the user's response was quite comprehensive. Let me re-read it carefully.

The user wants:
1. Queue system using `npm i queue` - commits processed sequentially
2. Committed states persisted in DB
3. Right sidebar showing commit history (author, date/time)
4. Permission system with checkboxes (All, Write, Delete, Create)
5. Profile head icon in title bar showing connected clients dropdown
6. Per-client permission editing in that dropdown
7. Name required when hosting/joining (default: host device name)
8. Undo per user - shows as undo action in history
9. First-writer-wins with item locking during editing

Let me also check - the user said "use npm i queue to create the queue" - but `npm i queue` might refer to the `queue` package. Let me look at what's available.

Actually, I should check if `queue` is the right package name. There's:
- `queue` (by Jake Archibald) - simple async queue with concurrency
- `p-queue` - promise-based queue
- `bull` - Redis-backed queue (overkill)

The `queue` package seems most appropriate. Its API:
```js
const queue = require('queue');
const q = queue({ concurrency: 1 });

q.push(function(cb) {
  // do something
  cb(null, result);
});

// Or with promises:
q.push(async function() {
  // do something
});
```

Now let me write the comprehensive plan.

I should also look at what the `npm i queue` package actually is. Let me search for it.

Actually, I don't need to install it for a plan. I can just describe the API based on its documentation.

Let me now synthesize all this into a clear plan. The user wants:
1. Clarifications on the above points
2. A plan for implementation

Since they said they want clarifications AND gave answers to my previous questions, let me acknowledge their answers and present the refined plan.

Let me be careful - the user's message contains their answers to my 5 questions, plus additional requirements. Let me process them:

Q1 (Edit permissions): The user answered in detail about the permission system
Q2 (Undo scope): Per-user undo, shows as undo action in history
Q3 (User identity): Manual name on host/join, default = host device name
Q4 (Authority): "do that" = host is authority
Q5 (Conflict resolution): First-writer-wins + item locking

Additional requirements from the user's message:
- Queue system using `npm i queue`
- Commit history persisted in SQLite
- Right sidebar showing commit history
- Profile icon in titlebar with dropdown for connected clients
- Permission management via checkboxes (All, Write, Delete, Create)

Now let me write the comprehensive plan.

Actually, I need to first check - the user says "Question 1" and "Question 2" in their message. It seems like they're answering my questions from my previous message. Let me re-read...

Actually re-reading, they seem to be answering my questions interleaved with their additional requirements. Let me parse:

"for committing states. use a queue system..." - This is their requirement
"use npm i queue to create the queue." - Clarification on queue library
"for questions" - Now they're answering my questions
"Question 1. the host client will assign a default permission..." - Answer to permission question
"Question 2. Undo will be per user..." - Answer to undo question
"Question 3. Manual name entry..." - Answer to identity question
"Question 4. do that." - Answer to authority question
"Question 5. The first writer wins..." - Answer to conflict resolution

Great, I have all the answers. Let me now present the refined plan.

For the plan, I should structure it as:

1. Architecture Overview
2. Rust Backend Changes
3. Frontend: Queue System
4. Frontend: Commit History
5. Frontend: Collaboration Hook
6. Frontend: Store Integration
7. UI Components
8. Permission System
9. Lock System
10. Implementation Order

Let me write this out.

Now let me check how the TimetablePage lays out its content area to understand where a right sidebar would fit:

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\Dev\\Projects\\Timetable\\src\\pages\\TimetablePage.tsx",
  "offset": 100,
  "limit": 200
}
```

**Output:**
```
<path>C:\Dev\Projects\Timetable\src\pages\TimetablePage.tsx</path>
<type>file</type>
<content>
100:           const clampedStart = excludeTimeWindow ? Math.max(s, viewStart) : s;
101:           const clampedEnd = excludeTimeWindow ? Math.min(e, viewEnd) : e;
102: 
103:           return {
104:             ...sched,
105:             days,
106:             startTime: toTime(clampedStart),
107:             endTime: toTime(clampedEnd),
108:           };
109:         })
110:         .filter((s): s is Exclude<typeof s, null> => s !== null);
111: 
112:       return {
113:         ...entry,
114:         schedules,
115:       };
116:     })
117:     .filter((entry) => {
118:       const original = entries.find((e) => e.id === entry.id);
119:       const originalHadSchedules = original ? original.schedules.length > 0 : false;
120:       if (originalHadSchedules && entry.schedules.length === 0) {
121:         return false;
122:       }
123:       return true;
124:     });
125: }
126: 
127: /**
128:  * Full timetable editor page.
129:  * Loads entries and hidden days from SQLite via the store hook and persists on every mutation.
130:  */
131: export function TimetablePage({
132:   timetableId,
133:   timetableName,
134:   onBack: _onBack,
135:   exportTrigger,
136:   saveTrigger,
137:   importMergeTrigger,
138:   exportJsonTrigger,
139:   exportExcelRoomTrigger,
140:   importExcelTrigger,
141:   docxTemplate,
142:   onClearDocxTemplate
143: }: TimetablePageProps) {
144:   const store = useTimetableStore(timetableId);
145:   const collection = useCollection();
146:   const prefs = usePreferences();
147:   const [messageApi, contextHolder] = message.useMessage();
148:   const [notificationApi, notificationContextHolder] = notification.useNotification();
149:   const [statusMessage, setStatusMessage] = useState('');
150: 
151:   // Prevent default window dragover/drop behaviors to allow Tauri/WebView2 HTML5 drag and drop
152:   useEffect(() => {
153:     const preventDefault = (e: DragEvent) => {
154:       e.preventDefault();
155:     };
156:     window.addEventListener('dragover', preventDefault);
157:     window.addEventListener('drop', preventDefault);
158:     return () => {
159:       window.removeEventListener('dragover', preventDefault);
160:       window.removeEventListener('drop', preventDefault);
161:     };
162:   }, []);
163: 
164:   useEffect(() => {
165:     window.dispatchEvent(new CustomEvent('store:history-change', {
166:       detail: { canUndo: store.canUndo, canRedo: store.canRedo, isDirty: store.isDirty }
167:     }));
168:   }, [store.canUndo, store.canRedo, store.isDirty]);
169: 
170:   // Auto-clear status message after 4 seconds
171:   useEffect(() => {
172:     if (!statusMessage) return;
173:     const timer = setTimeout(() => setStatusMessage(''), 4000);
174:     return () => clearTimeout(timer);
175:   }, [statusMessage]);
176: 
177:   const editingEntry = useMemo(
178:     () => store.blueprints.find((e) => e.id === store.editingEntryId) || null,
179:     [store.blueprints, store.editingEntryId]
180:   );
181:   const [suggestionsModalOpen, setSuggestionsModalOpen] = useState(false);
182: 
183:   // Lifted timespan view range state (defaults to 07:00 - 21:00)
184:   const [viewStart, setViewStart] = useState<number>(7 * 60);
185:   const [viewEnd, setViewEnd] = useState<number>(21 * 60);
186: 
187:   const lastSaveTriggerRef = useRef(saveTrigger);
188:   const lastExportTriggerRef = useRef(exportTrigger);
189:   const lastImportMergeTriggerRef = useRef(importMergeTrigger);
190:   const lastExportJsonTriggerRef = useRef(exportJsonTrigger);
191:   const lastExportExcelRoomTriggerRef = useRef(exportExcelRoomTrigger);
192:   const lastImportExcelTriggerRef = useRef(importExcelTrigger);
193: 
194:   // DOCX template state and image generation
195:   const [timetableImgDataUrl, setTimetableImgDataUrl] = useState<string | null>(null);
196:   const [timetableGridAspectRatio, setTimetableGridAspectRatio] = useState<number>(1.6);
197:   const [selectedTemplatePosition, setSelectedTemplatePosition] = useState<{
198:     pageIndex: number;
199:     xPct: number;
200:     yPct: number;
201:     wPct: number;
202:     hPct: number;
203:     targetParagraphIndex: number;
204:   } | null>(null);
205: 
206:   const [layoutConfig, setLayoutConfig] = useState<{
207:     orientation: 'portrait' | 'landscape';
208:     paperSize: { widthDxa: number; heightDxa: number };
209:     margins: { topDxa: number; bottomDxa: number; leftDxa: number; rightDxa: number };
210:   } | null>(null);
211: 
212:   useEffect(() => {
213:     if (!docxTemplate) {
214:       setTimetableImgDataUrl(null);
215:       setSelectedTemplatePosition(null);
216:       return;
217:     }
218: 
219:     async function captureGrid() {
220:       // Small timeout for layout stability
221:       await new Promise((resolve) => setTimeout(resolve, 300));
222:       const target = document.querySelector('.timetable-grid-capture-target');
223:       if (target) {
224:         try {
225:           const dataUrl = await toPng(target as HTMLElement, {
226:             backgroundColor: '#ffffff',
227:             style: {
228:               transform: 'scale(1)',
229:               transformOrigin: 'top left'
230:             }
231:           });
232:           setTimetableImgDataUrl(dataUrl);
233: 
234:           const rect = target.getBoundingClientRect();
235:           if (rect.height > 0) {
236:             setTimetableGridAspectRatio(rect.width / rect.height);
237:           }
238:         } catch (err) {
239:           console.error('Failed to capture timetable grid image:', err);
240:         }
241:       }
242:     }
243:     void captureGrid();
244:   }, [docxTemplate]);
245: 
246:   async function handleExportDocxFinal() {
247:     if (!docxTemplate || !timetableImgDataUrl || !selectedTemplatePosition) return;
248: 
249:     try {
250:       setStatusMessage('Exporting Word document...');
251:       const response = await fetch(timetableImgDataUrl);
252:       const blob = await response.blob();
253:       const arrayBuffer = await blob.arrayBuffer();
254:       const imageBytes = new Uint8Array(arrayBuffer);
255: 
256:       const resultBytes = await exportToDocxTemplate(
257:         docxTemplate.bytes,
258:         imageBytes,
259:         selectedTemplatePosition.xPct,
260:         selectedTemplatePosition.yPct,
261:         selectedTemplatePosition.wPct,
262:         selectedTemplatePosition.hPct,
263:         selectedTemplatePosition.targetParagraphIndex,
264:         selectedTemplatePosition.pageIndex,
265:         layoutConfig || undefined
266:       );
267: 
268:       const defaultFilename = `${timetableName}_docx_export.docx`;
269:       const resolvedPath = await invoke<string>('resolve_default_path', { filename: defaultFilename });
270: 
271:       const selectedPath = await save({
272:         title: 'Export Timetable Word Document',
273:         defaultPath: resolvedPath,
274:         filters: [{ name: 'Word Documents', extensions: ['docx'] }],
275:       });
276: 
277:       if (!selectedPath) {
278:         setStatusMessage('');
279:         return;
280:       }
281: 
282:       await invoke('save_file_bytes', { path: selectedPath, bytes: Array.from(resultBytes) });
283:       messageApi.success(`Exported document to ${selectedPath.split(/[\\/]/).pop()}`);
284:       onClearDocxTemplate();
285:       setStatusMessage('');
286:     } catch (err: unknown) {
287:       console.error(err);
288:       messageApi.error(`Word export failed: ${err instanceof Error ? err.message : String(err)}`);
289:       setStatusMessage('');
290:     }
291:   }
292: 
293:   const [exportModalOpen, setExportModalOpen] = useState(false);
294:   const [exportFilterType, setExportFilterType] = useState<'current' | 'all' | 'room'>('current');
295:   const [exportSelectedRooms, setExportSelectedRooms] = useState<string[]>([]);
296:   const [exportExactMatch, setExportExactMatch] = useState(false);
297:   const [pendingExportPath, setPendingExportPath] = useState<string | null>(null);
298: 
299:   const [filterType, setFilterType] = useState<'all' | 'student' | 'teacher' | 'room'>('all');

(Showing lines 100-299 of 3256. Use offset=300 to continue.)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\Dev\\Projects\\Timetable\\src\\types.ts"
}
```

**Output:**
```
<path>C:\Dev\Projects\Timetable\src\types.ts</path>
<type>file</type>
<content>
1: /** Days of the week available for scheduling */
2: export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
3: 
4: export const DAY_ORDER: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
5: 
6: /** A single time-slot entry within a subject's schedule */
7: export interface Schedule {
8:   id: string;
9:   /** Selected days for this time slot */
10:   days: DayOfWeek[];
11:   /** "HH:mm" 24-hour format */
12:   startTime: string;
13:   /** "HH:mm" 24-hour format */
14:   endTime: string;
15:   /** Rooms assigned specifically for this schedule slot */
16:   rooms: string[];
17:   assignedTeacherName?: string;
18: }
19: 
20: /** A complete subject entry with one or more schedules */
21: export interface SubjectEntry {
22:   id: string;
23:   /** When set, marks this entry as a placed instance derived from a blueprint */
24:   blueprintId?: string;
25:   subjectCode: string;
26:   offerCode: string;
27:   subjectDescription: string;
28:   /** Teacher assigned to conduct the class */
29:   assignedTeacherName: string;
30:   room?: string;
31:   schedules: Schedule[];
32:   color?: string;
33:   program: string;
34:   year: number;
35:   section: string;
36:   department?: string;
37: }
38: 
39: /** Describes a detected conflict between two scheduled entries */
40: export interface ConflictInfo {
41:   type: 'teacher' | 'room' | 'time';
42:   conflictingEntry: SubjectEntry;
43:   day: DayOfWeek;
44:   startTime: string;
45:   endTime: string;
46: }
47: 
48: /** Flat cell data used by TimetableGrid for rendering */
49: export interface TimetableCell {
50:   entry: SubjectEntry;
51:   schedule: Schedule;
52:   day: DayOfWeek;
53: }
54: 
55: /** Metadata for a saved timetable, returned by the Tauri backend */
56: export interface TimetableMeta {
57:   id: string;
58:   name: string;
59:   entryCount: number;
60:   createdAt: string;
61:   updatedAt: string;
62:   hiddenDays: DayOfWeek[];
63: }
64: 
65: /** A timetable within a .ttcl collection */
66: export interface CollectionTimetable {
67:   id: string;
68:   name: string;
69:   blueprints: SubjectEntry[];
70:   instances: SubjectEntry[];
71:   hiddenDays: DayOfWeek[];
72:   theme: string;
73:   bandedRows: boolean;
74:   createdAt: string;
75:   updatedAt: string;
76:   dynamicData: DynamicData[];
77: }
78: 
79: /** The .ttcl collection file format (Base64 encoded when saved to disk) */
80: export interface CollectionFile {
81:   version: 1;
82:   timetables: CollectionTimetable[];
83: }
84: 
85: /** Dynamic data entry (departments, instructors, rooms, etc.) */
86: export interface DynamicData {
87:   id: string;
88:   dataType: string;
89:   value: string;
90:   displayAs: string;
91: }
92: 
93: /** A recent collection entry stored in localStorage */
94: export interface CollectionRecord {
95:   name: string;
96:   path: string;
97:   timetableCount: number;
98:   lastOpened: string;
99: }
100: 
101: /** Form schedules for state history tracking */
102: export interface FormSchedule {
103:   days: DayOfWeek[];
104:   timeRange: [string, string] | null; // HH:mm format
105:   rooms: string[];
106:   /** Preserved schedule ID when editing, so links survive form-based edits */
107:   id?: string;
108: }
109: 
110: /** Form state structure for state history tracking */
111: export interface FormState {
112:   subjectCode: string;
113:   offerCode: string;
114:   subjectDescription: string;
115:   room?: string[];
116:   colorRandom: boolean;
117:   color: string;
118:   schedules: FormSchedule[];
119:   program: string;
120:   year: string;
121:   section: string;
122:   department?: string;
123: }
124: 

(End of file - total 124 lines)
</content>
```

---

## Assistant (Plan · DeepSeek V4 Flash Free · 3.5s)

_Thinking:_

Let me also look at the return section of TimetablePage to see the layout structure where the right sidebar would go.

**Tool: grep**

**Input:**
```json
{
  "pattern": "return \\(|",
  "include": "TimetablePage.tsx"
}
```

**Output:**
```
Found 100 matches (more matches available)
C:\Dev\Projects\Timetable\src\pages\TimetablePage.tsx:
  Line 1: import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

  Line 2: import gsap from 'gsap';

  Line 3: import { Layout, Typography, Spin, message, Button, Modal, List, Select, Checkbox, ConfigProvider, Drawer, Space, notification, Progress } from 'antd';

  Line 4: import { DeleteOutlined } from '@ant-design/icons';

  Line 5: import { useTimetableStore } from '../hooks/useTimetableStore';

  Line 6: import { getLinks, getConnectedKeys } from '../utils/linkUtils';

  Line 7: import { getThemeConfig } from '../theme';

  Line 8: import { BlueprintList } from '../components/BlueprintList';

  Line 9: import { TimetableGrid } from '../components/TimetableGrid';

  Line 10: import { exportToXlsx, exportToXlsxBatch } from '../utils/exportXlsx';

  Line 11: import * as ExcelJS from 'exceljs';

  Line 12: import { usePreferences } from '../context/PreferencesContext';

  Line 13: import { save, ask, open } from '@tauri-apps/plugin-dialog';

  Line 14: import { invoke } from '@tauri-apps/api/core';

  Line 15: import type { SubjectEntry, DayOfWeek, ConflictInfo, Schedule, DynamicData } from '../types';

  Line 16: import { DocxTemplatePreview } from '../components/DocxTemplatePreview';

  Line 17: import { exportToDocxTemplate } from '../utils/exportDocx';

  Line 18: import { toPng } from 'html-to-image';

  Line 19: 

  Line 20: import { RibbonToolbar } from '../components/RibbonToolbar';

  Line 21: import { PlacedSchedules } from '../components/PlacedSchedules';

  Line 22: import { SchedulePropertiesPanel } from '../components/SchedulePropertiesPanel';

  Line 23: import { BlueprintForm } from '../components/BlueprintForm';

  Line 24: import { ColumnMappingForm } from '../components/ColumnMappingForm';

  Line 25: import { detectBlueprintColumns, detectScheduleColumns } from '../utils/autoDetectColumns';

  Line 26: import { parseInstructorValue, formatInstructorValue, formatInstructorDisplay } from '../utils/teacherName';

  Line 27: import { resolveRoomForSchedule } from '../utils/conflictResolver';

  Line 28: import { StatusBar } from '../components/StatusBar';

  Line 29: import { useBlueprintSearch } from '../hooks/useBlueprintSearch';

  Line 30: import { useCollection } from '../hooks/useCollectionContext';

  Line 31: 

  Line 32: const { Content } = Layout;

  Line 33: const { Text } = Typography;

  Line 34: 

  Line 35: interface TimetablePageProps {

  Line 36:   /** SQLite id of the timetable being edited */

  Line 37:   timetableId: string;

  Line 38:   /** Display name of the timetable */

  Line 39:   timetableName: string;

  Line 40:   /** Called when the user navigates back to home */

  Line 41:   onBack: () => void;

  Line 42:   /** Incremented by TitleBar when File > Save As is triggered */

  Line 43:   exportTrigger: number;

  Line 44:   /** Incremented when Ctrl+S / File > Save is triggered */

  Line 45:   saveTrigger: number;

  Line 46:   /** Incremented when File > Import & Merge is triggered */

  Line 47:   importMergeTrigger: number;

  Line 48:   /** Incremented when File > Export JSON Data is triggered */

  Line 49:   exportJsonTrigger: number;

  Line 50:   /** Incremented when File > Export Room Timetable is triggered */

  Line 51:   exportExcelRoomTrigger: number;

  Line 52:   /** Incremented when File > Import Blueprints from Excel is triggered */

  Line 53:   importExcelTrigger: number;

  Line 54:   /** Word/Docx Template Details */

  Line 55:   docxTemplate: { name: string; path: string; bytes: Uint8Array } | null;

  Line 56:   /** Callback to clear Word template */

  Line 57:   onClearDocxTemplate: () => void;

  Line 58: }

  Line 59: 

  Line 60: function toMin(time: string): number {

  Line 61:   const parts = time.split(':');

  Line 62:   return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);

  Line 63: }

  Line 64: 

  Line 65: function toTime(min: number): string {

  Line 66:   const h = Math.floor(min / 60).toString().padStart(2, '0');

  Line 67:   const m = (min % 60).toString().padStart(2, '0');

  Line 68:   return `${h}:${m}`;

  Line 69: }

  Line 70: 

  Line 71: /** Helper to filter out schedules on hidden days and/or outside the visible time window */

  Line 72: function filterEntriesForExport(

  Line 73:   entries: SubjectEntry[],

  Line 74:   hiddenDays: DayOfWeek[],

  Line 75:   excludeHiddenDays: boolean,

  Line 76:   viewStart: number,

  Line 77:   viewEnd: number,

  Line 78:   excludeTimeWindow: boolean,

  Line 79: ): SubjectEntry[] {

  Line 80:   return entries

  Line 81:     .map((entry) => {

  Line 82:       const schedules = entry.schedules

  Line 83:         .map((sched) => {

  Line 84:           // Filter out hidden days if requested

  Line 85:           const days = excludeHiddenDays

  Line 86:             ? sched.days.filter((d) => !hiddenDays.includes(d))

  Line 87:             : sched.days;

  Line 88: 

  Line 89:           if (days.length === 0) return null;

  Line 90: 

  Line 91:           const s = toMin(sched.startTime);

  Line 92:           const e = toMin(sched.endTime);

  Line 93: 

  Line 94:           // Filter out if no overlap with time window

  Line 95:           if (excludeTimeWindow && (s >= viewEnd || e <= viewStart)) {

  Line 96:             return null;

  Line 97:           }

  Line 98: 

  Line 99:           // Clamp times to window if excludeTimeWindow is true

  Line 100:           const clampedStart = excludeTimeWindow ? Math.max(s, viewStart) : s;


(Results truncated. Consider using a more specific path or pattern.)
```

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\Dev\\Projects\\Timetable\\src\\pages\\TimetablePage.tsx",
  "offset": 3100
}
```

**Output:**
```
<path>C:\Dev\Projects\Timetable\src\pages\TimetablePage.tsx</path>
<type>file</type>
<content>
3100:         <div style={{ textAlign: 'center', padding: '12px 0' }}>
3101:           <Typography.Title level={5} style={{ marginBottom: 12 }}>
3102:             {undoRedoAction} ongoing...
3103:           </Typography.Title>
3104:           <Progress percent={Math.round(undoRedoProgress)} size="small" status="active" />
3105:         </div>
3106:       </Modal>
3107: 
3108:       {/* Save Loading Modal */}
3109:       <Modal
3110:         open={saveLoading}
3111:         closable={false}
3112:         footer={null}
3113:         maskClosable={false}
3114:         destroyOnClose
3115:         centered
3116:         width={300}
3117:       >
3118:         <div style={{ textAlign: 'center', padding: '20px 0' }}>
3119:           <Spin size="large" />
3120:           <div style={{ marginTop: 16, color: '#595959', fontSize: 14 }}>Saving timetable...</div>
3121:         </div>
3122:       </Modal>
3123: 
3124:       {/* Available Room Selection Modal */}
3125:       <Modal
3126:         title="Select Available Room"
3127:         open={availRoomModalOpen}
3128:         onOk={handleConfirmAvailRoom}
3129:         onCancel={() => { setAvailRoomModalOpen(false); setAvailRoomBlockKey(null); }}
3130:         okText="Move"
3131:         okButtonProps={{ disabled: !selectedAvailRoom }}
3132:         width={520}
3133:         centered
3134:         styles={{ body: { padding: '16px 20px', maxHeight: '55vh', overflowY: 'auto' } }}
3135:       >
3136:         {availCurrentRoomLabel && (
3137:           <div style={{ padding: '8px 12px', marginBottom: 10, background: '#f5f5f5', borderRadius: 4, fontSize: 12, color: '#8c8c8c' }}>
3138:             Current: {availCurrentRoomLabel}
3139:           </div>
3140:         )}
3141:         <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
3142:           {availRoomsList.map((item) => {
3143:             const parts = item.room.split('|');
3144:             const roomName = parts[0] || item.room;
3145:             const building = parts[1] || 'Unknown';
3146:             const isSelected = selectedAvailRoom === item.room;
3147:             return (
3148:               <div
3149:                 key={item.room}
3150:                 onClick={() => setSelectedAvailRoom(item.room)}
3151:                 style={{
3152:                   display: 'flex',
3153:                   alignItems: 'center',
3154:                   gap: 10,
3155:                   padding: '8px 12px',
3156:                   borderRadius: 6,
3157:                   cursor: 'pointer',
3158:                   background: isSelected ? '#E8F0FE' : 'transparent',
3159:                   border: isSelected ? '1px solid #2B4C7E' : '1px solid transparent',
3160:                   transition: 'all 0.15s ease',
3161:                 }}
3162:                 onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#f5f5f5'; }}
3163:                 onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
3164:               >
3165:                 <div
3166:                   style={{
3167:                     width: 16,
3168:                     height: 16,
3169:                     borderRadius: '50%',
3170:                     border: isSelected ? '5px solid #2B4C7E' : '2px solid #bfbfbf',
3171:                     flexShrink: 0,
3172:                     transition: 'border 0.15s ease',
3173:                   }}
3174:                 />
3175:                 <div style={{ flex: 1, fontSize: 13, lineHeight: 1.4 }}>
3176:                   <span style={{ color: '#8c8c8c' }}>{building}</span>
3177:                   {' — '}
3178:                   <span style={{ fontWeight: 600, color: '#1a1a1a' }}>{roomName}</span>
3179:                 </div>
3180:                 <div
3181:                   style={{
3182:                     fontSize: 11,
3183:                     fontWeight: 600,
3184:                     padding: '2px 8px',
3185:                     borderRadius: 4,
3186:                     whiteSpace: 'nowrap',
3187:                     background: item.conflictCount > 0 ? '#FFF1F0' : '#F6FFED',
3188:                     color: item.conflictCount > 0 ? '#ff4d4f' : '#52c41a',
3189:                   }}
3190:                 >
3191:                   {item.conflictCount > 0
3192:                     ? `${item.conflictCount} conflict${item.conflictCount > 1 ? 's' : ''}`
3193:                     : 'Clean'}
3194:                 </div>
3195:               </div>
3196:             );
3197:           })}
3198:           {availRoomsList.length === 0 && (
3199:             <div style={{ textAlign: 'center', padding: 20, color: '#8c8c8c', fontSize: 13 }}>
3200:               No available rooms for this schedule slot.
3201:             </div>
3202:           )}
3203:         </div>
3204:       </Modal>
3205: 
3206:       {/* Excel Import Summary Modal */}
3207:       <Modal
3208:         title="Excel Import Completed"
3209:         open={importSummaryModalOpen}
3210:         onOk={() => setImportSummaryModalOpen(false)}
3211:         onCancel={() => setImportSummaryModalOpen(false)}
3212:         okText="Close"
3213:         cancelButtonProps={{ style: { display: 'none' } }}
3214:         width={450}
3215:         centered
3216:       >
3217:         <div style={{ padding: '8px 0' }}>
3218:           <p style={{ fontWeight: 500, fontSize: '14px', marginBottom: 16 }}>
3219:             The Excel blueprint import has finished.
3220:           </p>
3221:           <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
3222:             <tbody>
3223:               <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
3224:                 <td style={{ padding: '8px 0', color: '#595959' }}>Blueprints Imported</td>
3225:                 <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600 }}>{importSummaryDetails.blueprintsCount}</td>
3226:               </tr>
3227:               <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
3228:                 <td style={{ padding: '8px 0', color: '#595959' }}>Schedules Placed</td>
3229:                 <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600 }}>{importSummaryDetails.schedulesCount}</td>
3230:               </tr>
3231:               <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
3232:                 <td style={{ padding: '8px 0', color: '#595959' }}>Links Created</td>
3233:                 <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600 }}>{importSummaryDetails.linksCount}</td>
3234:               </tr>
3235:               <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
3236:                 <td style={{ padding: '8px 0', color: '#595959' }}>Schedules Still in Conflict</td>
3237:                 <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, color: importSummaryDetails.conflictsCount > 0 ? '#ff4d4f' : '#52c41a' }}>
3238:                   {importSummaryDetails.conflictsCount}
3239:                 </td>
3240:               </tr>
3241:               {importSummaryDetails.skippedCount > 0 && (
3242:                 <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
3243:                   <td style={{ padding: '8px 0', color: '#595959' }}>Skipped Rows</td>
3244:                   <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, color: '#faad14' }}>{importSummaryDetails.skippedCount}</td>
3245:                 </tr>
3246:               )}
3247:             </tbody>
3248:           </table>
3249:           <p style={{ fontSize: '12px', color: '#8c8c8c' }}>
3250:             Detailed logs and notifications are available in the generic notification panel (bell icon) in the bottom statusbar.
3251:           </p>
3252:         </div>
3253:       </Modal>
3254:     </ConfigProvider>
3255:   );
3256: }

(End of file - total 3256 lines)
</content>
```

---

## Assistant (Plan · DeepSeek V4 Flash Free · 3.6s)

_Thinking:_

Let me find the main layout structure of TimetablePage to understand where to add the right sidebar.

**Tool: grep**

**Input:**
```json
{
  "pattern": "return \\(",
  "include": "TimetablePage.tsx"
}
```

**Output:**
```
Found 9 matches
C:\Dev\Projects\Timetable\src\pages\TimetablePage.tsx:
  Line 158:     return () => {

  Line 174:     return () => clearTimeout(timer);

  Line 479:     return () => {

  Line 524:     return () => {

  Line 2135:     return () => {

  Line 2356:     return (

  Line 2363:   return (

  Line 2936:                       return (

  Line 3147:             return (

```

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\Dev\\Projects\\Timetable\\src\\pages\\TimetablePage.tsx",
  "offset": 2790,
  "limit": 310
}
```

**Output:**
```
<path>C:\Dev\Projects\Timetable\src\pages\TimetablePage.tsx</path>
<type>file</type>
<content>
2790:       <Modal
2791:         title="Export Room Timetable to Excel"
2792:         open={exportRoomModalOpen}
2793:         onOk={async () => {
2794:           setExportRoomModalOpen(false);
2795: 
2796:           if (!exportBatchMode) {
2797:             if (!exportRoomRoom) return;
2798:             const resolvedPath = await invoke<string>('resolve_default_path', { filename: `${timetableName}_${exportRoomRoom.replace(/[|]/g, '_')}.xlsx` });
2799:             const selectedPath = await save({
2800:               title: 'Export Room Timetable',
2801:               defaultPath: resolvedPath,
2802:               filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
2803:             });
2804:             if (!selectedPath) return;
2805:             const entriesToExport = filterEntriesForExport(
2806:               store.instances, store.hiddenDays, true, viewStart, viewEnd, true,
2807:             ).filter((e) =>
2808:               e.schedules.some((s) => {
2809:                 const roomVal = s.rooms.length > 0 ? s.rooms[0] : '';
2810:                 return roomVal === exportRoomRoom;
2811:               })
2812:             );
2813:             try {
2814:               await exportToXlsx(
2815:                 entriesToExport, `${timetableName}_${exportRoomRoom.replace(/[|]/g, '_')}.xlsx`,
2816:                 store.hiddenDays, true, viewStart, viewEnd, true,
2817:                 selectedPath, store.theme, store.bandedRows,
2818:               );
2819:               messageApi.success(`Exported room timetable to ${selectedPath.split(/[\\/]/).pop()}`);
2820:             } catch (e: unknown) {
2821:               messageApi.error(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
2822:             }
2823:           } else {
2824:             if (exportBatchRooms.length === 0) return;
2825:             const entriesByRoom: Record<string, SubjectEntry[]> = {};
2826:             for (const roomVal of exportBatchRooms) {
2827:               entriesByRoom[roomVal] = filterEntriesForExport(
2828:                 store.instances, store.hiddenDays, true, viewStart, viewEnd, true,
2829:               ).filter((e) =>
2830:                 e.schedules.some((s) => {
2831:                   const entryRoomVal = s.rooms.length > 0 ? s.rooms[0] : '';
2832:                   return entryRoomVal === roomVal;
2833:                 })
2834:               );
2835:             }
2836:             const resolvedPath = await invoke<string>('resolve_default_path', { filename: `${timetableName}_batch.xlsx` });
2837:             const selectedPath = await save({
2838:               title: 'Export Batch Room Timetable',
2839:               defaultPath: resolvedPath,
2840:               filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
2841:             });
2842:             if (!selectedPath) return;
2843:             try {
2844:               await exportToXlsxBatch(
2845:                 entriesByRoom, `${timetableName}_batch.xlsx`,
2846:                 store.hiddenDays, true, viewStart, viewEnd, true,
2847:                 selectedPath, store.theme, store.bandedRows,
2848:               );
2849:               messageApi.success(`Exported batch room timetable to ${selectedPath.split(/[\\/]/).pop()}`);
2850:             } catch (e: unknown) {
2851:               messageApi.error(`Batch export failed: ${e instanceof Error ? e.message : String(e)}`);
2852:             }
2853:           }
2854:         }}
2855:         onCancel={() => setExportRoomModalOpen(false)}
2856:         okText="Export"
2857:         okButtonProps={{ disabled: exportBatchMode ? exportBatchRooms.length === 0 : !exportRoomRoom }}
2858:       >
2859:         <Space direction="vertical" style={{ width: '100%' }} size={12}>
2860:           <Checkbox
2861:             checked={exportBatchMode}
2862:             onChange={(e) => {
2863:               setExportBatchMode(e.target.checked);
2864:               if (!e.target.checked) {
2865:                 setExportBatchBuildings([]);
2866:                 setExportBatchRooms([]);
2867:               }
2868:             }}
2869:           >
2870:             Batch Export (one sheet per room)
2871:           </Checkbox>
2872: 
2873:           {!exportBatchMode ? (
2874:             <>
2875:               <div>
2876:                 <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>Building</div>
2877:                 <Select
2878:                   style={{ width: '100%' }}
2879:                   placeholder="Select building"
2880:                   value={exportRoomBuilding}
2881:                   onChange={(val) => { setExportRoomBuilding(val); setExportRoomRoom(null); }}
2882:                   options={buildingOptions}
2883:                   allowClear
2884:                 />
2885:               </div>
2886:               <div>
2887:                 <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>Room</div>
2888:                 <Select
2889:                   style={{ width: '100%' }}
2890:                   placeholder="Select room"
2891:                   value={exportRoomRoom}
2892:                   onChange={(val) => setExportRoomRoom(val)}
2893:                   options={exportRoomLabelOptions}
2894:                   allowClear
2895:                 />
2896:               </div>
2897:             </>
2898:           ) : (
2899:             <>
2900:               <div>
2901:                 <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>Buildings</div>
2902:                 <Select
2903:                   mode="multiple"
2904:                   style={{ width: '100%' }}
2905:                   placeholder="Select buildings (or leave empty for all)"
2906:                   value={exportBatchBuildings}
2907:                   onChange={(val) => { setExportBatchBuildings(val); setExportBatchRooms([]); }}
2908:                   options={buildingOptions}
2909:                   allowClear
2910:                 />
2911:               </div>
2912:               <div>
2913:                 <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>Rooms</div>
2914:                 <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #D0D7E3', borderRadius: 4, padding: '4px 8px' }}>
2915:                   <Checkbox
2916:                     checked={exportBatchRooms.length > 0 && exportBatchRooms.length === filteredBatchRoomOptions.length}
2917:                     indeterminate={exportBatchRooms.length > 0 && exportBatchRooms.length < filteredBatchRoomOptions.length}
2918:                     onChange={(e) => {
2919:                       if (e.target.checked) {
2920:                         setExportBatchRooms(filteredBatchRoomOptions.map(r => r.value));
2921:                       } else {
2922:                         setExportBatchRooms([]);
2923:                       }
2924:                     }}
2925:                     style={{ marginBottom: 4 }}
2926:                   >
2927:                     Select All
2928:                   </Checkbox>
2929:                   <Checkbox.Group
2930:                     value={exportBatchRooms}
2931:                     onChange={(vals) => setExportBatchRooms(vals as string[])}
2932:                     style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
2933:                   >
2934:                     {filteredBatchRoomOptions.map(r => {
2935:                       const parts = r.value.split('|');
2936:                       return (
2937:                         <Checkbox key={r.value} value={r.value}>
2938:                           {parts[0]} <span style={{ fontSize: 11, color: '#7A8BA8' }}>({parts[1] || 'External'})</span>
2939:                         </Checkbox>
2940:                       );
2941:                     })}
2942:                   </Checkbox.Group>
2943:                 </div>
2944:               </div>
2945:             </>
2946:           )}
2947:         </Space>
2948:       </Modal>
2949: 
2950:       {/* ── Import Blueprints from Excel Modal ─────────────────────── */}
2951:       <Modal
2952:         title="Import Blueprints from Excel"
2953:         open={importExcelModalOpen}
2954:         onCancel={() => { setImportExcelModalOpen(false); setImportExcelFileBytes(null); setImportExcelFileName(''); setImportExcelMapping({}); setImportExcelSkipped([]); setImportExcelPreviewRows(undefined); }}
2955:         footer={null}
2956:         width={560}
2957:       >
2958:         {!importExcelFileBytes ? (
2959:           <Space direction="vertical" style={{ width: '100%' }} size={12}>
2960:             <Text type="secondary">
2961:               Select an Excel file (.xlsx) containing blueprint data.
2962:             </Text>
2963:             <Button
2964:               onClick={async () => {
2965:                 const filePath = await open({
2966:                   title: 'Select Excel File',
2967:                   filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
2968:                   multiple: false,
2969:                   directory: false,
2970:                 });
2971:                 if (!filePath || typeof filePath !== 'string') return;
2972:                 setImportExcelLoading(true);
2973:                 try {
2974:                   const bytes = await invoke<number[]>('read_file_bytes', { path: filePath });
2975:                   const uint8 = new Uint8Array(bytes);
2976:                   
2977:                   // Auto-detect column mapping from header row
2978:                   let bpDetected = {};
2979:                   let schedDetected = {};
2980:                   let rawRows: string[][] = [];
2981:                   try {
2982:                     const workbook = new ExcelJS.Workbook();
2983:                     await workbook.xlsx.load(uint8 as any);
2984:                     const worksheet = workbook.worksheets[0];
2985:                     if (worksheet) {
2986:                       bpDetected = detectBlueprintColumns(worksheet);
2987:                       schedDetected = detectScheduleColumns(worksheet);
2988: 
2989:                       // Extract raw preview rows (first 6 data rows)
2990:                       worksheet.eachRow((row, rowNumber) => {
2991:                         if (rowNumber === 1) return;
2992:                         if (rawRows.length >= 6) return false;
2993:                         const rowData: string[] = [];
2994:                         row.eachCell({ includeEmpty: true }, (cell: any) => {
2995:                           rowData.push(cell.value?.toString()?.trim() || '');
2996:                         });
2997:                         rawRows.push(rowData);
2998:                       });
2999:                     }
3000:                   } catch {
3001:                     bpDetected = {};
3002:                     schedDetected = {};
3003:                     rawRows = [];
3004:                   }
3005: 
3006:                   // Set all states in a single batch after the await is completed
3007:                   setImportExcelMapping(bpDetected);
3008:                   setImportExcelScheduleMapping(schedDetected);
3009:                   setImportExcelPreviewRows(rawRows.length > 0 ? rawRows : undefined);
3010:                   setImportExcelFileName(filePath.split(/[\\/]/).pop() || '');
3011:                   setImportExcelFileBytes(uint8);
3012:                 } catch (e: unknown) {
3013:                   messageApi.error(`Failed to read file: ${e instanceof Error ? e.message : String(e)}`);
3014:                 } finally {
3015:                   setImportExcelLoading(false);
3016:                 }
3017:               }}
3018:               loading={importExcelLoading}
3019:             >
3020:               Select Excel File
3021:             </Button>
3022:             {importExcelFileName && (
3023:               <Text style={{ fontSize: 12 }}>Selected: {importExcelFileName}</Text>
3024:             )}
3025:           </Space>
3026:         ) : (
3027:           <ColumnMappingForm
3028:             key={importExcelFileName}
3029:             initialMapping={importExcelMapping}
3030:             initialScheduleMapping={importExcelScheduleMapping}
3031:             onImport={handleExcelImport}
3032:             loading={importExcelLoading}
3033:             onSearchAllColumns={async () => {
3034:               if (!importExcelFileBytes) return { mapping: {}, scheduleMapping: {} };
3035:               const wb = new ExcelJS.Workbook();
3036:               await wb.xlsx.load(importExcelFileBytes as any);
3037:               const ws = wb.worksheets[0];
3038:               if (!ws) return { mapping: {}, scheduleMapping: {} };
3039:               const bpDetected = detectBlueprintColumns(ws);
3040:               const schedDetected = detectScheduleColumns(ws);
3041:               return { mapping: bpDetected, scheduleMapping: schedDetected };
3042:             }}
3043:             worksheetRows={importExcelPreviewRows}
3044:           />
3045:         )}
3046:       </Modal>
3047: 
3048:       {/* Skipped Rows Drawer */}
3049:       <Drawer
3050:         title="Skipped Rows"
3051:         placement="right"
3052:         width={400}
3053:         onClose={() => setImportExcelSkippedDrawerOpen(false)}
3054:         open={importExcelSkippedDrawerOpen}
3055:       >
3056:         {importExcelSkipped.length === 0 ? (
3057:           <Text type="secondary">No rows were skipped.</Text>
3058:         ) : (
3059:           <List
3060:             size="small"
3061:             dataSource={importExcelSkipped}
3062:             renderItem={(item) => <List.Item><Text style={{ fontSize: 12 }}>{item}</Text></List.Item>}
3063:           />
3064:         )}
3065:       </Drawer>
3066: 
3067:       {/* Import Progress Modal */}
3068:       <Modal
3069:         open={importProgressModalOpen}
3070:         closable={false}
3071:         footer={null}
3072:         maskClosable={false}
3073:         destroyOnClose
3074:         centered
3075:         width={400}
3076:       >
3077:         <div style={{ textAlign: 'center', padding: '12px 0' }}>
3078:           <Typography.Title level={4} style={{ marginBottom: 16 }}>
3079:             {importProgressStatus}
3080:           </Typography.Title>
3081:           <Progress percent={Math.round(importProgressPercent)} status="active" />
3082:           {importProgressSubtext && (
3083:             <Typography.Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
3084:               {importProgressSubtext}
3085:             </Typography.Text>
3086:           )}
3087:         </div>
3088:       </Modal>
3089: 
3090:       {/* Undo/Redo Progress Modal */}
3091:       <Modal
3092:         open={undoRedoLoading}
3093:         closable={false}
3094:         footer={null}
3095:         maskClosable={false}
3096:         destroyOnClose
3097:         centered
3098:         width={300}
3099:       >

(Showing lines 2790-3099 of 3256. Use offset=3100 to continue.)
</content>
```

---

## Assistant (Plan · DeepSeek V4 Flash Free · 3.3s)

_Thinking:_

Let me find the main layout structure to see where to add the right sidebar.

**Tool: grep**

**Input:**
```json
{
  "include": "TimetablePage.tsx",
  "pattern": "<ConfigProvider|<Layout|<div style=.*flex.*height"
}
```

**Output:**
```
Found 3 matches
C:\Dev\Projects\Timetable\src\pages\TimetablePage.tsx:
  Line 2357:       <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>

  Line 2364:     <ConfigProvider theme={getThemeConfig('blue')}>

  Line 2365:       <Layout style={{ height: '100%', background: '#F5F7FA', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

```

---

## Assistant (Plan · DeepSeek V4 Flash Free · 3.1s)

_Thinking:_

Let me see the main layout from around line 2360 to 2480 to understand the structure of the TimetablePage layout.

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\Dev\\Projects\\Timetable\\src\\pages\\TimetablePage.tsx",
  "offset": 2360,
  "limit": 130
}
```

**Output:**
```
<path>C:\Dev\Projects\Timetable\src\pages\TimetablePage.tsx</path>
<type>file</type>
<content>
2360:     );
2361:   }
2362: 
2363:   return (
2364:     <ConfigProvider theme={getThemeConfig('blue')}>
2365:       <Layout style={{ height: '100%', background: '#F5F7FA', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
2366:         {contextHolder}
2367:         {notificationContextHolder}
2368: 
2369:         {/* ── Ribbon Toolbar ────────────────────────────────────────── */}
2370:         {!docxTemplate && (
2371:           <RibbonToolbar
2372:             onSave={() => window.dispatchEvent(new CustomEvent('titlebar:save'))}
2373:             onSaveAs={handleSaveAs}
2374:             onImportMerge={handleMergeImport}
2375:             canUndo={store.canUndo}
2376:             canRedo={store.canRedo}
2377:             onUndo={handleUndo}
2378:             onRedo={handleRedo}
2379:             filterType={filterType}
2380:             onFilterTypeChange={setFilterType}
2381:             selectedStudentKey={selectedStudentKey}
2382:             onSelectedStudentKeyChange={setSelectedStudentKey}
2383:             studentSchedules={studentSchedules}
2384:             selectedTeacher={selectedTeacher}
2385:             onSelectedTeacherChange={setSelectedTeacher}
2386:             teacherOptions={teacherOptions}
2387:             selectedRooms={selectedRooms}
2388:             onSelectedRoomsChange={handleSelectedRoomsChange}
2389:             roomOptions={roomOptions}
2390:             theme={store.theme}
2391:             onThemeChange={store.updateTheme}
2392:             bandedRows={store.bandedRows}
2393:             onBandedRowsChange={store.updateBandedRows}
2394:             hiddenDays={store.hiddenDays}
2395:             onToggleDay={store.setHiddenDays}
2396:             viewStart={viewStart}
2397:             onViewStartChange={setViewStart}
2398:             viewEnd={viewEnd}
2399:             onViewEndChange={setViewEnd}
2400:             timeOptions={TIME_OPTIONS}
2401:             onAddSubjectEntry={() => {
2402:               store.cancelEdit();
2403:               setSubjectDrawerOpen(true);
2404:             }}
2405:             dynamicData={store.dynamicData}
2406:             addDynamicData={store.addDynamicData}
2407:             deleteDynamicData={store.deleteDynamicData}
2408:             updateDynamicData={store.updateDynamicData}
2409:             linkingModeActive={linkingModeActive}
2410:             onToggleLinkingMode={handleToggleLinkingMode}
2411:             globalColWidth={store.globalColWidth}
2412:             globalRowHeight={store.globalRowHeight}
2413:             onApplyGlobalCellSizing={store.applyGlobalCellSizing}
2414:           />
2415:         )}
2416: 
2417:         {/* ── Main Workspace Body ───────────────────────────────────── */}
2418:         <Content style={{ display: 'flex', alignItems: 'stretch', overflow: 'hidden', flex: 1, minHeight: 0, position: 'relative' }}>
2419:           {/* Left Panel: Subject Entries List (Fill full height) */}
2420:           {!docxTemplate && (
2421:             <div
2422:               style={{
2423:                 width: 350,
2424:                 flexShrink: 0,
2425:                 display: 'flex',
2426:                 flexDirection: 'column',
2427:                 height: '100%',
2428:                 borderRight: '1px solid #D0D7E3',
2429:                 background: '#FFFFFF',
2430:               }}
2431:             >
2432:               <BlueprintList
2433:                 blueprints={store.blueprints}
2434:                 onEdit={handleEdit}
2435:                 onDelete={store.deleteBlueprint}
2436:                 onDeleteBatch={store.deleteBlueprints}
2437:                 hiddenEntryIds={hiddenEntryIds}
2438:                 onToggleHide={handleToggleHideEntry}
2439:                 editingEntryId={editingEntry?.id}
2440:                 searchQuery={searchQuery}
2441:                 onSearchChange={setSearchQuery}
2442:                 searchResults={searchResults}
2443:                 onDragStartCustom={handleDragStartCustom}
2444:               />
2445:             </div>
2446:           )}
2447: 
2448:           {/* Right Panel: Timetable Grid (Fill remaining space) */}
2449:           <div
2450:             className="timetable-grid-capture-target-wrapper"
2451:             style={{
2452:               flex: docxTemplate ? 'none' : 1,
2453:               width: docxTemplate ? 1200 : 'auto',
2454:               height: docxTemplate ? 800 : '100%',
2455:               overflow: 'hidden',
2456:               display: 'flex',
2457:               flexDirection: 'column',
2458:               position: docxTemplate ? 'absolute' : 'relative',
2459:               left: docxTemplate ? -9999 : 0,
2460:               top: docxTemplate ? -9999 : 0,
2461:               opacity: docxTemplate ? 0 : 1,
2462:               pointerEvents: docxTemplate ? 'none' : 'auto',
2463:               padding: docxTemplate ? 0 : '12px 12px 0',
2464:               background: '#FFFFFF',
2465:             }}
2466:           >
2467:             <div ref={gridWrapperRef} style={{ flex: 1, overflowY: 'auto', minHeight: 0, willChange: 'opacity' }}>
2468:               <TimetableGrid
2469:                 entries={gridEntries}
2470:                 hiddenDays={store.hiddenDays}
2471:                 viewStart={viewStart}
2472:                 viewEnd={viewEnd}
2473:                 bandedRows={store.bandedRows}
2474:                 editingEntryId={editingEntry?.id}
2475:                 onCancelEdit={handleCancelEdit}
2476:                 onUpdateEntry={store.updateInstance}
2477:                 onDeleteEntry={store.deleteBlueprint}
2478:                 onDropEntry={handleDropEntry}
2479:                 onDeleteSchedule={handleDeleteSchedule}
2480:                 activeRoom={activeRoom}
2481:                 onSelectScheduleBlock={handleSelectScheduleBlock}
2482:                 linkingFirstBlockKey={linkingFirstBlockKey}
2483:                 linkingHighlightedKeys={linkingHighlightedKeys}
2484:                 linkingModeActive={linkingModeActive}
2485:                 onUnlinkBlock={handleUnlinkBlock}
2486:                 onMoveRoom={handleMoveRoom}
2487:                 onMoveToAvailableRoom={handleMoveToAvailableRoom}
2488:                 theme={store.theme}
2489:                 selectedBlockKeys={selectedBlockKeys}

(Showing lines 2360-2489 of 3256. Use offset=2490 to continue.)
</content>
```

---

## Assistant (Plan · DeepSeek V4 Flash Free · 3.4s)

_Thinking:_

Let me see the rest of the layout to understand the right side panels and the StatusBar.

**Tool: read**

**Input:**
```json
{
  "offset": 2490,
  "filePath": "C:\\Dev\\Projects\\Timetable\\src\\pages\\TimetablePage.tsx",
  "limit": 150
}
```

**Output:**
```
<path>C:\Dev\Projects\Timetable\src\pages\TimetablePage.tsx</path>
<type>file</type>
<content>
2490:                 onToggleSelectBlock={handleToggleSelectBlock}
2491:                 onClearSelection={handleClearSelection}
2492:                 onCopyBlocks={handleCopyBlocks}
2493:                 onPasteBlocks={handlePasteBlocks}
2494:                 canPaste={clipboardBlocks.length > 0}
2495:                 columnWidths={store.columnWidths}
2496:                 rowHeights={store.rowHeights}
2497:                 globalColWidth={store.globalColWidth}
2498:                 globalRowHeight={store.globalRowHeight}
2499:                 onCommitCellSizes={store.commitCellSizes}
2500:               />
2501:             </div>
2502:           </div>
2503: 
2504:           {/* Right Slide-in Schedules Panel / Schedule Properties / DOCX Template Preview */}
2505:           {docxTemplate ? (
2506:             <div
2507:               style={{
2508:                 flex: 1,
2509:                 display: 'flex',
2510:                 flexDirection: 'column',
2511:                 height: '100%',
2512:                 background: '#FFFFFF',
2513:               }}
2514:             >
2515:               <DocxTemplatePreview
2516:                 bytes={docxTemplate.bytes}
2517:                 name={docxTemplate.name}
2518:                 timetableImg={timetableImgDataUrl}
2519:                 timetableAspectRatio={timetableGridAspectRatio}
2520:                 onClose={onClearDocxTemplate}
2521:                 onSelectPosition={setSelectedTemplatePosition}
2522:                 onLayoutConfigChange={setLayoutConfig}
2523:                 onExport={handleExportDocxFinal}
2524:                 canExport={!!selectedTemplatePosition && !!timetableImgDataUrl}
2525:               />
2526:             </div>
2527:           ) : activeSelectedBlock ? (
2528:             <SchedulePropertiesPanel
2529:               disabled={selectedBlockKeys.size > 1}
2530:               entry={activeSelectedBlock.entry}
2531:               schedule={activeSelectedBlock.schedule}
2532:               dynamicData={store.dynamicData}
2533:               onSave={(updatedEntry) => {
2534:                 const scheduleId = activeSelectedBlock.schedule.id;
2535:                 const conflicts = store.updateInstance(updatedEntry, scheduleId);
2536:                 if (conflicts.length > 0) {
2537:                   messageApi.error('Conflict detected during save! Check conflict details.');
2538:                 } else {
2539:                   messageApi.success('Subject properties updated.');
2540:                 }
2541:               }}
2542:               onCancel={() => setSelectedScheduleBlock(null)}
2543:               onDeleteSchedule={(entryId, scheduleId) => {
2544:                 handleDeleteSchedule(entryId, scheduleId);
2545:                 setSelectedScheduleBlock(null);
2546:               }}
2547:             />
2548:           ) : (
2549:             <PlacedSchedules
2550:               entries={gridEntries}
2551:               onHighlightSchedule={handleHighlightSchedule}
2552:               onDeleteSchedule={handleDeleteSchedule}
2553:             />
2554:           )}
2555:         </Content>
2556: 
2557:         {/* ── Status Bar ────────────────────────────────────────────── */}
2558:         <StatusBar
2559:           fileName={collection.collectionPath ? collection.collectionPath.split(/[/\\]/).pop() ?? null : null}
2560:           linkingModeActive={linkingModeActive}
2561:           onToggleLinkingMode={handleToggleLinkingMode}
2562:           roomOptions={roomOptions}
2563:           activeRoom={activeRoom}
2564:           onActiveRoomChange={handleActiveRoomChange}
2565:           linkingFirstBlockKey={linkingFirstBlockKey}
2566:           allConflictsList={allConflictsList}
2567:           onHighlightSchedule={handleHighlightSchedule}
2568:           isDirty={store.isDirty}
2569:           statusMessage={statusMessage}
2570: 
2571:           importNotifications={importNotifications}
2572:           roomConflictSummary={roomConflictSummary}
2573:           onRefreshRoomConflicts={handleRefreshRoomConflicts}
2574:         />
2575: 
2576:         {/* ── Suggestions Modal ────────────────────────────────────── */}
2577:         <Modal
2578:           title={
2579:             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '92%' }}>
2580:               <span style={{ fontSize: 14 }}>Imported Autocomplete Suggestions</span>
2581:               {store.importedSuggestions.length > 0 && (
2582:                 <Button
2583:                   type="text"
2584:                   danger
2585:                   size="small"
2586:                   icon={<DeleteOutlined />}
2587:                   onClick={async () => {
2588:                     await store.clearImportedSuggestions();
2589:                     messageApi.success('All imported suggestions cleared.');
2590:                   }}
2591:                 >
2592:                   Clear All
2593:                 </Button>
2594:               )}
2595:             </div>
2596:           }
2597:           open={suggestionsModalOpen}
2598:           onCancel={() => setSuggestionsModalOpen(false)}
2599:           footer={[
2600:             <Button key="close" type="primary" size="small" onClick={() => setSuggestionsModalOpen(false)}>
2601:               Close
2602:             </Button>
2603:           ]}
2604:           width={580}
2605:           destroyOnClose
2606:         >
2607:           <div style={{ maxHeight: 400, overflowY: 'auto', paddingTop: 8 }}>
2608:             {store.importedSuggestions.length === 0 ? (
2609:               <div style={{ padding: '24px 0', textAlign: 'center', color: '#7A8BA8' }}>
2610:                 No imported suggestions yet. Upload a JSON file to add some!
2611:               </div>
2612:             ) : (
2613:               <List
2614:                 size="small"
2615:                 dataSource={store.importedSuggestions}
2616:                 renderItem={(item, index) => (
2617:                   <List.Item
2618:                     actions={[
2619:                       <Button
2620:                         type="text"
2621:                         danger
2622:                         size="small"
2623:                         icon={<DeleteOutlined style={{ fontSize: 12 }} />}
2624:                         onClick={async () => {
2625:                           await store.deleteImportedSuggestion(index);
2626:                           messageApi.success('Suggestion deleted.');
2627:                         }}
2628:                       />
2629:                     ]}
2630:                     style={{ padding: '6px 8px' }}
2631:                   >
2632:                     <List.Item.Meta
2633:                       title={
2634:                         <div style={{ fontSize: 12, fontWeight: 600 }}>
2635:                           {item.subjectCode} <span style={{ color: '#7A8BA8', fontWeight: 400, marginLeft: 4 }}>({item.offerCode})</span>
2636:                         </div>
2637:                       }
2638:                       description={
2639:                         <div style={{ fontSize: 11, color: '#4A5B78', lineHeight: '1.4' }}>

(Showing lines 2490-2639 of 3256. Use offset=2640 to continue.)
</content>
```

---

## Assistant (Plan · DeepSeek V4 Flash Free · 43.4s)

_Thinking:_

Now I have a comprehensive understanding. Let me now formulate the complete plan.

The TimetablePage layout is:
```
<Layout> (column)
  <RibbonToolbar />
  <Content> (flex row)
    <div> BlueprintList (fixed 350px left) </div>
    <div> TimetableGrid (flex: 1 center) </div>
    <div> SchedulePropertiesPanel | PlacedSchedules (right panel) </div>
  </Content>
  <StatusBar />
  ... modals
</Layout>
```

So the right sidebar for commit history would go into the `<Content>` area, likely inserted between the TimetableGrid and the SchedulePropertiesPanel/PlacedSchedules, or it could replace the SchedulePropertiesPanel when in collaboration mode.

Actually, the user wants it as a persistent "right sidebar" that shows commit history. I think it would be best as a Drawer (antd Drawer) that slides in from the right, toggled by a button. This way it doesn't disrupt the existing layout.

But actually, re-reading the user's request: "also display a right sidebar that shows all commited state" - they want a persistent sidebar, not a sliding drawer. Let me think about this...

Since the user wants a persistent sidebar, I could make it part of the Content area. The Content currently has:
- Left: BlueprintList (350px)
- Center: TimetableGrid (flex: 1)
- Right: PlacedSchedules / SchedulePropertiesPanel

I could add the commit history sidebar as:
- A toggleable panel in the right area (alongside or replacing PlacedSchedules when in collab mode)
- Or a separate collapsible panel

I think the best approach is to make it a toggleable right drawer that can be opened/closed. But the user specifically said "right sidebar" which suggests persistent.

Let me plan this: The commit history sidebar will be a panel that can be toggled on/off via a button in the RibbonToolbar or the TitleBar. When open, it appears on the far right, reducing the grid space. This is similar to how the SchedulePropertiesPanel already works.

Actually, the simplest approach: add a toggleable commit history panel that sits in the right area, similar to the PlacedSchedules panel. When collaboration mode is active, a "Show History" button appears (perhaps in the collaboration section of the RibbonToolbar) which toggles the commit history sidebar.

Now let me structure the full plan for presenting to the user.

Now I have a complete picture. Here's the refined implementation plan based on all your answers:

---

## Final Implementation Plan

### Architecture Overview

```
Host Machine:
┌─────────────────────────────────────────────────┐
│ Tauri Rust Process                              │
│  ┌─────────────────────────────────────────────┐│
│  │ WebSocket Server (tokio-tungstenite)        ││
│  │ Port 9182 — dumb relay, broadcasts to all   ││
│  └─────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────┐│
│  │ SQLite (timetable.db)                       ││
│  │ Tables: timetables, dynamic_data,           ││
│  │         commit_history                      ││
│  └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
        ▲ WebSocket ▲                     ▲ WS
        │ localhost │                     │
┌───────┴────┐ ┌───┴────────┐   ┌────────┴────────┐
│ Host React  │ │ Client A   │   │  Client B       │
│ App         │ │ React App  │   │  React App      │
│ (read-write)│ │ (perms)    │   │  (perms)        │
└─────────────┘ └────────────┘   └─────────────────┘
```

---

### 1. Rust Backend Changes (`src-tauri/`)

**Cargo.toml additions:**
```toml
tokio-tungstenite = "0.24"
futures-util = "0.3"
```

**New file: `src-tauri/src/collab_server.rs`**
- Module managing a WebSocket server on a background tokio task
- State: `HashMap<usize, WS Sender>` (connected peers), `AtomicBool` (running), `AtomicU16` (port)
- On connect: assigns `clientId`, stores sender, sends `welcome` message, broadcasts `peer:joined`
- On disconnect: removes sender, broadcasts `peer:left`
- On message: relays to all OTHER connected clients (not back to sender)
- Commands: `start(port)`, `stop()`, `status()`

**New Tauri commands in `lib.rs`:**
| Command | Signature | Description |
|---|---|---|
| `start_collab_server` | `(port: u16) -> Result<(), String>` | Starts WS server |
| `stop_collab_server` | `() -> Result<(), String>` | Stops WS server |
| `get_collab_status` | `() -> Result<CollabStatus, String>` | `{ running, port, peer_count }` |
| `get_local_ips` | `() -> Vec<String>` | Returns LAN IPs |

**`tauri.conf.json` / capabilities:**
- Add `core:event:allow-emit` for pushing server status to frontend

---

### 2. Database Schema

**Migration V8: `commit_history` table**
```sql
CREATE TABLE IF NOT EXISTS commit_history (
  id            TEXT PRIMARY KEY,
  timetable_id  TEXT NOT NULL,
  action_type   TEXT NOT NULL,    -- e.g. 'addBlueprint', 'addInstance', 'undo'
  action_json   TEXT NOT NULL,    -- serialized action payload
  author        TEXT NOT NULL,    -- client user name
  author_id     TEXT NOT NULL,    -- client ID
  timestamp     TEXT NOT NULL,    -- ISO 8601
  description   TEXT NOT NULL     -- human-readable summary
);
```

**Migration V9: `locks` table** (for first-writer-wins locking)
```sql
CREATE TABLE IF NOT EXISTS locks (
  item_id       TEXT PRIMARY KEY,
  client_id     TEXT NOT NULL,
  user_name     TEXT NOT NULL,
  acquired_at   TEXT NOT NULL
);
```

---

### 3. Queue System (`useCommitQueue.ts`)

Using `npm i queue`:

```typescript
import Queue from 'queue';

// Singleton queue per timetable session
const commitQueue = new Queue({ concurrency: 1, autostart: true });

interface QueuedCommit {
  action: CollabAction;
  author: string;
  authorId: string;
}

function enqueueCommit(commit: QueuedCommit): Promise<void> {
  return new Promise((resolve, reject) => {
    commitQueue.push(async () => {
      try {
        // 1. Apply to React state (via store callback)
        await applyToState(commit.action);
        // 2. Persist to SQLite commit_history
        await persistCommit(commit);
        // 3. Broadcast via WebSocket (if collab active)
        broadcastAction(commit);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
}
```

**How it integrates with the store:**
- Each store action (addBlueprint, addInstance, etc.) doesn't directly call `commitState`.
- Instead, it calls `enqueueCommit({ action, author, authorId })`.
- The queue processes sequentially, ensuring ordered commits.
- The commit callback applies the action to state AND persists to DB.
- After the queue finishes each commit, it emits a custom event `commit:applied` that the CommitHistorySidebar listens to.

**Store changes (`useTimetableStore.ts`):**
- Add `remoteActionQueue` — a separate queue for incoming remote actions
- Modify `commitState` to accept an `isRemoteOrigin` flag
- When `isRemoteOrigin=true`: skip history push, skip SQLite write (host already persists via queue), apply to React state only
- Expose `receiveRemoteAction(action: CollabAction)` — enqueues on the remote queue

---

### 4. Commit History (`useCommitHistory.ts`)

```typescript
interface CommitRecord {
  id: string;
  actionType: string;
  description: string;     // e.g. "Alice added blueprint CS101"
  author: string;           // user display name
  authorId: string;
  timestamp: number;        // epoch ms
  isUndo: boolean;
  sequenceNumber: number;   // global order in this session
}
```

- Loads on mount from SQLite `commit_history WHERE timetable_id = ?`
- `appendCommit(record)` — inserts into SQLite + React state
- `markUndo(originalCommitId)` — inserts an "undo" record referencing the original
- Sorted by `timestamp` descending in the sidebar
- Persisted to SQLite so commit history survives page reload

---

### 5. Collaboration Hook (`useCollaboration.ts`)

Uses `react-use-websocket`:

```typescript
import useWebSocket from 'react-use-websocket';

const WS_URL = isHost ? 'ws://localhost:PORT' : `ws://${hostIp}:${port}`;

const { sendMessage, lastMessage, readyState } = useWebSocket(WS_URL, {
  shouldReconnect: () => true,
  reconnectInterval: 3000,
  reconnectAttempts: 10,
  onOpen: () => { /* send user:announce */ },
  onClose: () => { /* show disconnected */ },
});
```

**Hook returns:**
```typescript
interface UseCollaborationReturn {
  // Status
  isConnected: boolean;
  isHost: boolean;
  sessionInfo: { ip: string; port: number } | null;
  connectedUsers: CollabUser[];
  
  // Actions
  hostSession(port: number, userName: string): Promise<void>;
  joinSession(hostIp: string, port: number, userName: string): Promise<void>;
  leaveSession(): Promise<void>;
  
  // Broadcasting
  broadcastAction(action: CollabAction): void;
  broadcastLock(itemId: string, action: 'acquire' | 'release'): void;
  broadcastCursor(data: unknown): void;
  
  // Permissions
  clientPermissions: Map<string, PermissionSet>;
  setClientPermission(clientId: string, perms: PermissionSet): void;
  
  // Commit history
  commitHistory: CommitRecord[];
}
```

**Message protocol (JSON):**
```typescript
type CollabMessage =
  // System messages
  | { type: 'user:announce', clientId: string, userName: string }
  | { type: 'user:join', clientId: string, userName: string }
  | { type: 'user:leave', clientId: string }
  
  // State sync
  | { type: 'state:request', clientId: string }
  | { type: 'state:full', targetClientId: string, state: CollabState }
  
  // Actions
  | { type: 'action', actionId: string, clientId: string, action: CollabAction, timestamp: number }
  
  // Locking
  | { type: 'lock:acquire', clientId: string, itemId: string }
  | { type: 'lock:release', clientId: string, itemId: string }
  | { type: 'lock:denied', itemId: string, lockedBy: string }
  
  // Permission changes (host only → clients)
  | { type: 'permissions:update', targetClientId: string, permissions: PermissionSet }
  
  // Cursor/activity
  | { type: 'cursor', clientId: string, editingItemId: string | null }
  
  // Heartbeat
  | { type: 'ping' } | { type: 'pong' }
```

---

### 6. Permission System

**Types (`src/types.ts`):**
```typescript
interface PermissionSet {
  all: boolean;
  write: boolean;
  delete: boolean;
  create: boolean;
}
```

**Default permission:** `{ all: true, write: true, delete: true, create: true }`

**Checkbox logic:**
- `All` checked → `write`, `delete`, `create` all checked, all disabled
- `All` unchecked → `write`, `delete`, `create` all unchecked, all enabled
- `All` checked, user unchecks one → `All` unchecked, the unchecked one stays unchecked
- User manually checks all three (`write`, `delete`, `create`) → `All` auto-checks

**Permission enforcement:**
- Before executing any action on the client, check permissions:
  - `addBlueprint`, `addInstance`, `addBlueprints`, `addDynamicData`, `addLinksBatched` → requires `create`
  - `updateInstance`, `updateDynamicData`, `updateTheme`, `updateBandedRows`, `setHiddenDays` → requires `write`
  - `deleteBlueprint`, `deleteInstance`, `deleteDynamicData` → requires `delete`
  - `all` → bypasses individual checks
- If permission denied, show message: "You don't have permission to [action]"
- Permission enforcement is at the UI level (buttons disabled) and at the action dispatch level

**Permission editing UI:**
- In the TitleBar profile dropdown → click on a user → shows PermissionCheckboxes modal
- Host only: only the host can change permissions
- Permission changes are broadcast via `permissions:update` message
- Clients update their local permission map on receiving this message

---

### 7. UI Components

#### 7a. TitleBar Profile Icon

**New file: `src/components/CollabUserMenu.tsx`**

- A `UserOutlined` or profile icon button placed **after the maximize button** and **before the close button** in the TitleBar
- Visible only when a collaboration session is active
- On click: `Dropdown` showing:
  - Session info at top (your name, connected count)
  - List of connected users with colored avatar, name, permissions badge
  - Click on a user (host only) → submenu or modal to edit permissions
  - "Leave Session" button at bottom

**TitleBar changes (`TitleBar.tsx`):**
- Add `collabUsers`, `isCollabActive`, `onOpenPermissionEditor`, `onLeaveSession` props
- Insert the profile icon button in the window controls area (between maximize and close)

#### 7b. Host/Join Modals

**New file: `src/components/CollabHostModal.tsx`**
- Name input (default: hostname from `os.hostname()` or `navigator.userAgent` parsing)
- Port input (default 9182)
- "Start Session" button → calls `collab.hostSession(port, name)`
- Shows "Starting..." state, then transitions to session active state showing IP:port

**New file: `src/components/CollabJoinModal.tsx`**
- Name input (default: PC name)
- Host IP:port input
- "Join Session" button → calls `collab.joinSession(ip, port, name)`

**Access via RibbonToolbar:** A new "Collaboration" dropdown/button in the RibbonToolbar with options:
- "Host Session..."
- "Join Session..."
- (when connected) "Leave Session"
- (when connected) Connection status indicator

#### 7c. CommitHistorySidebar

**New file: `src/components/CommitHistorySidebar.tsx`**

- A toggleable right sidebar (replace the SchedulePropertiesPanel or append to the right area)
- Shows commits in reverse chronological order
- Each commit displays:
  - Colored dot/icon for action type
  - Description text
  - Author name
  - Relative time ("2m ago", "5:42 PM")
  - If undo: strikethrough style + "↩ Undone by X"
- Filters: by author dropdown, by action type tabs
- Toggle button in RibbonToolbar (collab section)
- Auto-scrolls to top on new commits
- Loads from SQLite on page mount

#### 7d. PermissionCheckboxes

**New file: `src/components/PermissionCheckboxes.tsx`**
- A reusable component showing the All, Write, Delete, Create checkboxes
- Implements the auto-check/uncheck logic:
  - All ↔ write & delete & create
  - write & delete & create → All
- Used in both the host's permission editing modal and the default permission setting

#### 7e. Lock Indicators

- In `TimetableGrid.tsx`: when a cell/block is locked by a remote user, overlay with:
  - Semi-transparent gray
  - Lock icon + editing user's name
- In `BlueprintList.tsx`: when a blueprint is locked, show similar indicator
- Prevent drag-and-drop and editing on locked items

---

### 8. Lock System (First-Writer-Wins)

**Flow:**
1. User clicks to edit an item (blueprint or schedule)
2. Client broadcasts `lock:acquire { itemId, clientId }`
3. Host checks if item is locked:
   - If no: creates lock entry, broadcasts `lock:acquire` to all
   - If yes: responds with `lock:denied { lockedBy }`
4. Client receives:
   - Lock acquired → enters edit mode, item now locked for others
   - Lock denied → shows "User X is editing this item" message
5. On save or cancel: broadcasts `lock:release { itemId, clientId }`
6. On disconnect: host auto-releases all locks for that client

**Lock storage:**
- Host maintains `Map<string, LockState>` in the collaboration hook
- Lock state is broadcast to all clients
- Locks are cleaned up on disconnect

---

### 9. Integration Points in Existing Code

**`useTimetableStore.ts`:**
- Add `isRemoteOperation` param to `commitState` — skips history push and local broadcast
- Add `applyRemoteAction(action: CollabAction)` — calls the appropriate store method with `isRemoteOperation = true`
- Add `registerCommitQueue(enqueueCommit)` — called by useCollaboration to set up the queue

**`TimetablePage.tsx`:**
- Instantiate `useCollaboration` and `useCommitHistory`
- Pass collaboration state to `RibbonToolbar` and `TitleBar`
- Add `CommitHistorySidebar` to the right side of the Content area
- Pass lock state to `TimetableGrid` and `BlueprintList`

**`TitleBar.tsx`:**
- Add `CollabUserMenu` button in the window controls area

**`RibbonToolbar.tsx`:**
- Add "Collaboration" section with host/join buttons and connection status

**`App.tsx`:**
- Pass collaboration callbacks to `TitleBar` component
- Handle session state

---

### 10. Implementation Order

| Phase | Task | Files |
|---|---|---|
| **1** | Rust WS server + Tauri commands | `src-tauri/Cargo.toml`, `src-tauri/src/collab_server.rs`, `src-tauri/src/lib.rs` |
| **2** | DB migrations (commit_history, locks) | `src-tauri/src/lib.rs` |
| **3** | Install npm deps | `npm install react-use-websocket queue` |
| **4** | Permission types + checkboxes component | `src/types.ts`, `src/components/PermissionCheckboxes.tsx` |
| **5** | Queue system | `src/hooks/useCommitQueue.ts` |
| **6** | Commit history hook | `src/hooks/useCommitHistory.ts` |
| **7** | Store integration | `src/hooks/useTimetableStore.ts` (modify commitState, add applyRemoteAction) |
| **8** | Collaboration hook | `src/hooks/useCollaboration.ts` |
| **9** | Host/Join modals | `src/components/CollabHostModal.tsx`, `src/components/CollabJoinModal.tsx` |
| **10** | CommitHistorySidebar | `src/components/CommitHistorySidebar.tsx` |
| **11** | CollabUserMenu (TitleBar profile) | `src/components/CollabUserMenu.tsx`, modify `TitleBar.tsx` |
| **12** | RibbonToolbar collab section | Modify `src/components/RibbonToolbar.tsx` |
| **13** | Lock indicators in grid/list | Modify `TimetableGrid.tsx`, `BlueprintList.tsx` |
| **14** | TimetablePage integration | Wire everything together |
| **15** | Permission enforcement | UI-level + action-level checks |

---

### 11. Clarifications Needed

1. **Commit history sidebar**: Should it be a persistent panel replacing the right area (PlacedSchedules/SchedulePropertiesPanel) when in collab mode, or a toggleable Drawer that overlays?

2. **Lock granularity**: Should locking be at the individual entry level (a specific blueprint/schedule), or should entire blueprints be locked when any of their properties are being edited?

3. **Commit history persistence on host disconnect**: When all clients leave but the host keeps the timetable open, should commit history persist in SQLite so it's visible on next session start?

4. **Host device name**: For default name, should we use `os.hostname()` from Tauri IPC or fall back to something browser-side like `navigator.platform`?

---

## User

Clarification answers:
1. It will be persistent. but dont replace the placed schedule. just add a tab in it. the Commit History is always available even if im not in collaboration mode. Commit history will work all the time. not just in collab mode.
2. the locking will only be in individual entry level. dont lock the whole blueprint.
3. the commit history works all the time even if not in collab mode so it will be persisted even if clients will disconnect. save the commit history to the host client. but in collab mode, connected clients can see the whole commit history. But also add a checkbox to Show whole commit history to clients. if i check it, the clients can see the whole commit history. if its unchecked, the client can only see the commit history starting from the time the client connected.
4. use os.hostname()

---

## Assistant (Plan · DeepSeek V4 Flash Free · 32.1s)

_Thinking:_

The user has answered my clarification questions. Let me process them and update the plan:

1. **Commit history sidebar**: Persistent, but added as a tab in the existing right panel (alongside PlacedSchedules/ScheduleProperties). Works ALL the time, not just collab mode.
2. **Lock granularity**: Individual entry level only (specific blueprint/schedule item). Don't lock the whole blueprint.
3. **Commit history persistence**: Always persisted to host's SQLite. In collab mode, checkbox controls whether clients can see the full history or only from their connection time.
4. **Host device name**: Use `os.hostname()` via Tauri IPC.

This changes the plan significantly:

1. The commit history is now a core feature (not just collab) - it works all the time, even without collaboration.
2. The right panel needs a tab system - tabs for PlacedSchedules, ScheduleProperties, and CommitHistory.
3. The "show whole history to clients" checkbox is a collab-specific option.
4. Locking is fine-grained per entry.

Let me also think about how commit history works when not in collab mode:
- Every local action goes through the queue → persisted to commit_history table
- The sidebar shows all commits for this timetable
- This effectively creates an audit log of all changes

When in collab mode:
- Host persists all commits (local + remote)
- Host's commit_history has everything
- If "Share full history" is checked: when a client joins, host sends all commit_history rows
- If unchecked: host only sends commits from the join timestamp onward
- Clients send their commits to host for persistence

Let me also think about the tab system for the right panel. Looking at the current layout:

```
<Content> (flex row, overflow hidden)
  ├── BlueprintList (left, 350px)
  ├── TimetableGrid (flex: 1, center)
  └── Right Panel (~350px):
      ├── docxTemplate → DocxTemplatePreview
      ├── activeSelectedBlock → SchedulePropertiesPanel
      └── else → PlacedSchedules
```

The right panel currently is a conditional render. I need to change it to a tabbed interface:

```
Right Panel (Tabs):
  ├── Tab: "Schedules" → PlacedSchedules (existing)
  ├── Tab: "Properties" → SchedulePropertiesPanel (existing, shown when block selected)
  └── Tab: "History" → CommitHistorySidebar (new)
```

This way:
- The Schedules tab is always there showing placed schedules
- When a block is selected, it auto-switches to the Properties tab (or highlights it)
- The History tab is always accessible
- The tab state persists per user

Let me now think about the complete plan with these clarifications integrated.

Actually, I should also think about the architecture change: previously, `commitState` handled both state updates AND SQLite persistence. With the queue system:

1. `commitState` will still update React state immediately (for responsiveness)
2. BUT the SQLite persistence and history recording will be queued
3. The queue processes sequentially

Wait, actually the user said "the queue will commit its elements sequentially. the committed states will be persisted in the database." This means:
- Actions go into a queue
- The queue processes them one at a time
- Each action: applies to state + persists to DB + records in commit_history

So the flow becomes:
1. User action → create action object
2. Push to queue
3. Queue processes: apply to state → write to DB → write to commit_history → broadcast (if collab)
4. React re-renders from state update

This means `commitState` would be called FROM the queue, not directly from the action function. The action function would just create the action and enqueue it.

But wait, this would mean React state updates are delayed until the queue processes. For a responsive UI, we could:
- Option A: Apply to React state immediately (optimistic), then queue the persistence
- Option B: Wait for queue to process, then update React state

Option A is better for UX but creates a discrepancy if the queue fails. Option B is safer but makes the UI feel laggy.

Actually, looking at the current code, `commitState` already does everything synchronously (React state + SQLite write). The SQLite write is async but fire-and-forget (.then().catch()). So the React state is updated synchronously and the DB write happens in the background.

For the queue system, I think the best approach is:
1. Action is called → creates the action object
2. Action is pushed to the queue
3. Queue processes:
   a. Applies to React state (via commitState or similar)
   b. Persists to commit_history in SQLite
   c. Broadcasts via WebSocket (if collab)
4. React re-renders from step 3a

This means step 3a is synchronous within the queue job, so the queue effectively just orders the operations but doesn't delay them significantly (since commitment to React state is instant).

Actually, re-reading the user's requirement again: "use a queue system where our actions will be in a queue and the queue will commit its elements sequentially" - this means the queue serializes the commits. The purpose is to ensure ordered, sequential processing of actions, especially important in collab mode where actions from multiple clients need to be applied in order.

Let me refine the plan:

**Modified commitState:**
- We don't change the existing `commitState` much
- We add a wrapper: each store action calls `enqueueCommit(action)` instead of calling `commitState` directly
- The queue processes each action:
  1. Calls the actual store mutation function (which calls commitState internally)
  2. Records the commit in commit_history (SQLite)
  3. Broadcasts via WebSocket (if collab)

Wait, this is a bit circular. The store action already calls commitState. So we'd have:

```
addBlueprint(entry) {
  enqueueCommit({ op: 'addBlueprint', payload: { entry } });
}

// Queue processes:
processCommit({ op: 'addBlueprint', payload: { entry } }) {
  // This is what addBlueprint does internally:
  const next = [entry, ...blueprints];
  commitState(next, instances, null, DEFAULT_FORM_STATE);  // Updates React + SQLite entries_json
  // Record in commit_history:
  insertCommitHistory({ actionType: 'addBlueprint', author, timestamp, description });
  // Broadcast:
  if (collab) broadcast({ type: 'action', action: { op: 'addBlueprint', payload: { entry } } });
}
```

But the existing store action methods (like `addBlueprint`) are used in many places in TimetablePage. We don't want to change every call site. Instead, we modify the store methods to enqueue rather than execute directly.

Actually, this is getting complex. Let me think about a cleaner approach.

**Clean approach:** The store methods are modified to:
1. Create the action payload
2. Push to the queue instead of calling commitState directly
3. The queue processes: calls the actual internal mutation (commitState) + persists commit_history + broadcasts

So:
```typescript
const addBlueprint = useCallback((entry: SubjectEntry): ConflictInfo[] => {
  const action: CollabAction = { op: 'addBlueprint', payload: { entry } };
  enqueueCommit(action);
  return [];  // conflicts not returned synchronously anymore... hmm
}, [blueprints, instances, commitState, enqueueCommit]);
```

Wait, `addBlueprint` currently returns `ConflictInfo[]`. With the queue, conflicts would need to be computed differently. But actually, `addBlueprint` always returns `[]`:
```typescript
const addBlueprint = useCallback((entry: SubjectEntry): ConflictInfo[] => {
  // ...
  return [];
}, [...]);
```

So it always returns an empty array. That's fine - no change needed for that.

But `addInstance` does return conflicts. With the queue, conflicts wouldn't be available synchronously. We'd need to either:
- Compute conflicts optimistically before queueing
- Return conflicts after queue processes (async)
- Show conflicts via a different mechanism

Looking at how conflicts are used in TimetablePage:
- `addInstance` conflicts are shown as notifications
- `updateInstance` conflicts are shown as messages

We could handle this by:
1. Computing conflicts before queueing (optimistically compute them)
2. Queueing the action
3. The queue processes the actual state change

This is a reasonable approach. The conflict detection is a pure function (it reads from `instances` state and computes overlaps), so we can call it synchronously before queueing.

So the flow becomes:
```
addInstance(entry):
  1. Compute conflicts optimistically (from current state)
  2. Push action to queue
  3. Return conflicts (for notification display)

Queue processes:
  1. Apply to React state (commitState)
  2. Persist commit_history to SQLite
  3. Broadcast (if collab)
```

This works. Let me finalize the plan.

One more thing: When processing remote actions from the queue, they shouldn't be broadcast again (to avoid loops). So the queue needs to know if the action is local or remote.

OK, I think I have enough to present the final plan. Let me write it up.

Actually, let me also think about the `os.hostname()` requirement. In Tauri, we can:
- Add a new Rust command `get_hostname()` that calls `std::env::var("COMPUTERNAME")` (Windows) or `hostname()` 
- Or use Tauri's existing `os` APIs

The simplest approach is a new Tauri command:
```rust
#[tauri::command]
fn get_hostname() -> String {
    std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "Unknown".to_string())
}
```

OK let me now finalize and present the plan.

Good answers. Let me also quickly check how the right panel (PlacedSchedules/ScheduleProperties) is structured to plan the tab system:

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\Dev\\Projects\\Timetable\\src\\components\\PlacedSchedules.tsx",
  "limit": 40
}
```

**Output:**
```
<path>C:\Dev\Projects\Timetable\src\components\PlacedSchedules.tsx</path>
<type>file</type>
<content>
1: import { Typography, Dropdown } from 'antd';
2: import { CalendarOutlined, DeleteOutlined, AimOutlined } from '@ant-design/icons';
3: import type { SubjectEntry } from '../types';
4: import { formatTimeTo12Hr } from '../utils/time';
5: import { colorForSubject } from '../theme';
6: 
7: const { Text } = Typography;
8: 
9: interface PlacedSchedulesProps {
10:   entries: SubjectEntry[];
11:   onHighlightSchedule: (entryId: string, scheduleId: string) => void;
12:   onDeleteSchedule: (entryId: string, scheduleId: string) => void;
13: }
14: 
15: export function PlacedSchedules({
16:   entries,
17:   onHighlightSchedule,
18:   onDeleteSchedule,
19: }: PlacedSchedulesProps) {
20:   const scheduleItems = entries.flatMap((entry) => {
21:     return entry.schedules.flatMap((s) => {
22:       return s.days.map((day) => ({
23:         entry,
24:         schedule: s,
25:         day,
26:         uniqueKey: `${entry.id}-${s.id}-${day}`,
27:       }));
28:     });
29:   });
30: 
31:   return (
32:     <div
33:       style={{
34:         width: 260,
35:         background: '#FFFFFF',
36:         borderLeft: '1px solid #D0D7E3',
37:         height: '100%',
38:         display: 'flex',
39:         flexDirection: 'column',
40:         flexShrink: 0,

(Showing lines 1-40 of 130. Use offset=41 to continue.)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\Dev\\Projects\\Timetable\\src\\components\\SchedulePropertiesPanel.tsx",
  "limit": 40
}
```

**Output:**
```
<path>C:\Dev\Projects\Timetable\src\components\SchedulePropertiesPanel.tsx</path>
<type>file</type>
<content>
1: import { Form, Input, Select, Button, TimePicker, Divider, Typography, Space, AutoComplete } from 'antd';
2: import { SaveOutlined, CloseOutlined, DeleteOutlined } from '@ant-design/icons';
3: import { useEffect } from 'react';
4: import dayjs from 'dayjs';
5: import type { SubjectEntry, Schedule, DayOfWeek } from '../types';
6: import { DAY_ORDER } from '../types';
7: 
8: const { Text } = Typography;
9: 
10: interface SchedulePropertiesPanelProps {
11:   entry: SubjectEntry;
12:   schedule: Schedule;
13:   dynamicData: Array<{ id: string; dataType: string; value: string; displayAs: string }>;
14:   onSave: (updatedEntry: SubjectEntry) => void;
15:   onCancel: () => void;
16:   onDeleteSchedule: (entryId: string, scheduleId: string) => void;
17:   disabled?: boolean;
18: }
19: 
20: interface FormValues {
21:   subjectCode: string;
22:   offerCode: string;
23:   subjectDescription: string;
24:   assignedTeacherName: string;
25:   department: string;
26:   program: string;
27:   year: string;
28:   section: string;
29:   days: DayOfWeek[];
30:   timeRange: [dayjs.Dayjs, dayjs.Dayjs] | null;
31:   rooms: string[];
32: }
33: 
34: export function SchedulePropertiesPanel({
35:   entry,
36:   schedule,
37:   dynamicData,
38:   onSave,
39:   onCancel,
40:   onDeleteSchedule,

(Showing lines 1-40 of 266. Use offset=41 to continue.)
</content>
```

---

## Assistant (Plan · DeepSeek V4 Flash Free · 3.7s)

_Thinking:_

Now I have a clear picture. Let me also check if there's a `RibbonToolbar` I should look at to understand how to add collab buttons.

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\Dev\\Projects\\Timetable\\src\\components\\RibbonToolbar.tsx",
  "limit": 80
}
```

**Output:**
```
<path>C:\Dev\Projects\Timetable\src\components\RibbonToolbar.tsx</path>
<type>file</type>
<content>
1: import { Button, Select, Checkbox, Space, Divider, Typography, Tooltip, Drawer, Form, Input, InputNumber, Tabs, Card, Dropdown, message, Modal } from 'antd';
2: import { Sketch } from '@uiw/react-color';
3: import {
4:   SaveOutlined,
5:   DownloadOutlined,
6:   UploadOutlined,
7:   PlusOutlined,
8:   UndoOutlined,
9:   RedoOutlined,
10:   LinkOutlined,
11:   FilterOutlined,
12:   UserOutlined,
13:   SolutionOutlined,
14:   HomeOutlined,
15:   BgColorsOutlined,
16: } from '@ant-design/icons';
17: import type { DayOfWeek } from '../types';
18: import { DAY_ORDER } from '../types';
19: import { useState, useEffect } from 'react';
20: import type { DynamicData } from '../types';
21: import { formatInstructorValue, parseInstructorValue, formatInstructorDisplay } from '../utils/teacherName';
22: 
23: const { Text } = Typography;
24: import { Tag } from 'antd';
25: const AntdCheckableTag = Tag.CheckableTag;
26: 
27: const getDisplayLabel = (item: DynamicData): string => {
28:   if (item.dataType === 'room') {
29:     return item.displayAs.split('|')[0] || item.value;
30:   }
31:   if (item.dataType === 'instructor') {
32:     const parts = item.value.split(', ');
33:     const lastName = parts[0] || '';
34:     const firstName = parts[1] || '';
35:     return `${lastName}, ${firstName}`.trim();
36:   }
37:   return item.displayAs || item.value;
38: };
39: 
40: interface RibbonToolbarProps {
41:   // File operations
42:   onSave: () => void;
43:   onSaveAs: () => void;
44:   onImportMerge: () => void;
45:   canUndo: boolean;
46:   canRedo: boolean;
47:   onUndo: () => void;
48:   onRedo: () => void;
49: 
50:   // View settings
51:   filterType: 'all' | 'student' | 'teacher' | 'room';
52:   onFilterTypeChange: (val: 'all' | 'student' | 'teacher' | 'room') => void;
53:   selectedStudentKey: string | null;
54:   onSelectedStudentKeyChange: (val: string | null) => void;
55:   studentSchedules: { label: string; value: string }[];
56:   selectedTeacher: string | null;
57:   onSelectedTeacherChange: (val: string | null) => void;
58:   teacherOptions: { label: string; value: string }[];
59:   selectedRooms: string[];
60:   onSelectedRoomsChange: (val: string[]) => void;
61:   roomOptions: Array<{ label: string; value: string }>;
62:   theme: string;
63:   onThemeChange: (val: string) => void;
64:   bandedRows: boolean;
65:   onBandedRowsChange: (val: boolean) => void;
66: 
67:   // Timetable Grid settings
68:   hiddenDays: DayOfWeek[];
69:   onToggleDay: (days: DayOfWeek[]) => void;
70:   viewStart: number;
71:   onViewStartChange: (val: number) => void;
72:   viewEnd: number;
73:   onViewEndChange: (val: number) => void;
74:   timeOptions: { label: string; value: number }[];
75: 
76:   // App Actions
77:   onAddSubjectEntry: () => void;
78:   linkingModeActive?: boolean;
79:   onToggleLinkingMode?: () => void;
80: 

(Showing lines 1-80 of 803. Use offset=81 to continue.)
</content>
```

**Tool: grep**

**Input:**
```json
{
  "include": "RibbonToolbar.tsx",
  "pattern": "interface RibbonToolbarProps"
}
```

**Output:**
```
Found 1 matches
C:\Dev\Projects\Timetable\src\components\RibbonToolbar.tsx:
  Line 40: interface RibbonToolbarProps {

```

---

## Assistant (Plan · DeepSeek V4 Flash Free · 4.0s)

_Thinking:_

Let me see the rest of the RibbonToolbar props interface and also understand the complete layout. Let me also check the StatusBar for the bell icon and notification panel it mentions.

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\Dev\\Projects\\Timetable\\src\\components\\RibbonToolbar.tsx",
  "offset": 80,
  "limit": 80
}
```

**Output:**
```
<path>C:\Dev\Projects\Timetable\src\components\RibbonToolbar.tsx</path>
<type>file</type>
<content>
80: 
81:   // Dynamic Data Actions
82:   dynamicData: DynamicData[];
83:   addDynamicData: (dataType: string, value: string, displayAs: string) => Promise<void>;
84:   deleteDynamicData: (id: string) => Promise<void>;
85:   updateDynamicData: (id: string, dataType: string, value: string, displayAs: string) => Promise<void>;
86: 
87:   // Cell sizing
88:   globalColWidth: number;
89:   globalRowHeight: number;
90:   onApplyGlobalCellSizing: (width: number, height: number) => void;
91: }
92: 
93: export function RibbonToolbar({
94:   onSave,
95:   onSaveAs,
96:   onImportMerge,
97:   canUndo,
98:   canRedo,
99:   onUndo,
100:   onRedo,
101: 
102:   filterType,
103:   onFilterTypeChange,
104:   selectedStudentKey,
105:   onSelectedStudentKeyChange,
106:   studentSchedules,
107:   selectedTeacher,
108:   onSelectedTeacherChange,
109:   teacherOptions,
110:   selectedRooms,
111:   onSelectedRoomsChange,
112:   roomOptions,
113:   theme,
114:   onThemeChange,
115:   bandedRows,
116:   onBandedRowsChange,
117: 
118:   hiddenDays,
119:   onToggleDay,
120:   viewStart,
121:   onViewStartChange,
122:   viewEnd,
123:   onViewEndChange,
124:   timeOptions,
125: 
126:   onAddSubjectEntry,
127:   linkingModeActive,
128:   onToggleLinkingMode,
129: 
130:   dynamicData,
131:   addDynamicData,
132:   deleteDynamicData,
133:   updateDynamicData,
134:   globalColWidth,
135:   globalRowHeight,
136:   onApplyGlobalCellSizing,
137: }: RibbonToolbarProps) {
138:   const [drawerOpen, setDrawerOpen] = useState(false);
139:   const [form] = Form.useForm();
140:   const [editingDynamicId, setEditingDynamicId] = useState<string | null>(null);
141:   const [activeTab, setActiveTab] = useState<string>('department');
142:   const [sortOrder, setSortOrder] = useState<'created' | 'name-asc' | 'name-desc'>('created');
143: 
144:   // Local inputs for cell sizing – applied on blur or Enter
145:   const [colWidthInput, setColWidthInput] = useState<number>(globalColWidth);
146:   const [rowHeightInput, setRowHeightInput] = useState<number>(globalRowHeight);
147: 
148:   useEffect(() => { setColWidthInput(globalColWidth); }, [globalColWidth]);
149:   useEffect(() => { setRowHeightInput(globalRowHeight); }, [globalRowHeight]);
150: 
151:   const applySizing = () => {
152:     const w = Math.max(60, colWidthInput);
153:     const h = Math.max(18, rowHeightInput);
154:     onApplyGlobalCellSizing(w, h);
155:   };
156: 
157:   const isCustom = theme && theme.startsWith('custom:');
158:   const customHex = isCustom ? theme.split(':')[1] : '#2B4C7E';
159: 

(Showing lines 80-159 of 803. Use offset=160 to continue.)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\Dev\\Projects\\Timetable\\src\\components\\StatusBar.tsx",
  "limit": 100
}
```

**Output:**
```
<path>C:\Dev\Projects\Timetable\src\components\StatusBar.tsx</path>
<type>file</type>
<content>
1: import { Button, Select, Typography, Drawer, List, ConfigProvider, Space, Badge } from 'antd';
2: import { LinkOutlined, BellFilled, CloseCircleFilled, ReloadOutlined } from '@ant-design/icons';
3: import type { SubjectEntry, ConflictInfo } from '../types';
4: import { useState, useMemo } from 'react';
5: 
6: const { Text } = Typography;
7: 
8: /** Fixed Academic Blue background for the status bar — not affected by theme dropdown */
9: const STATUS_BAR_BG = '#1E3560';
10: 
11: interface StatusBarProps {
12:   fileName: string | null;
13:   linkingModeActive: boolean;
14:   onToggleLinkingMode: () => void;
15:   roomOptions: Array<{ label: string; value: string }>;
16:   activeRoom: string | null;
17:   onActiveRoomChange: (room: string) => void;
18:   linkingFirstBlockKey: string | null;
19:   allConflictsList: Array<{ entry: SubjectEntry; conflict: ConflictInfo }>;
20:   onHighlightSchedule: (entryId: string, scheduleId: string) => void;
21:   isDirty: boolean;
22:   statusMessage?: string;
23: 
24:   importNotifications?: string[];
25:   roomConflictSummary?: Array<{ room: string; conflictCount: number; roomValue: string }>;
26:   onRefreshRoomConflicts?: () => void;
27: }
28: 
29: export function StatusBar({
30:   fileName,
31:   linkingModeActive,
32:   onToggleLinkingMode,
33:   roomOptions,
34:   activeRoom,
35:   onActiveRoomChange,
36:   linkingFirstBlockKey,
37:   allConflictsList,
38:   onHighlightSchedule,
39:   isDirty,
40:   statusMessage,
41:   importNotifications = [],
42:   roomConflictSummary = [],
43:   onRefreshRoomConflicts,
44: }: StatusBarProps) {
45:   const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);
46: 
47:   const bgColor = STATUS_BAR_BG;
48: 
49:   const latestConflict = allConflictsList.length > 0 ? allConflictsList[allConflictsList.length - 1] : null;
50:   const totalConflicts = useMemo(() => roomConflictSummary.reduce((sum, r) => sum + r.conflictCount, 0), [roomConflictSummary]);
51:   const checkedRooms = roomConflictSummary.length;
52:   const roomsWithConflicts = roomConflictSummary.filter(r => r.conflictCount > 0).length;
53: 
54:   return (
55:     <div
56:       style={{
57:         background: bgColor,
58:         borderTop: '1px solid rgba(255,255,255,0.15)',
59:         padding: '0 8px',
60:         display: 'flex',
61:         alignItems: 'center',
62:         flexShrink: 0,
63:         zIndex: 10,
64:         height: 28,
65:         fontSize: 10,
66:       }}
67:     >
68:       {/* Left: Filename + status message */}
69:       <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, marginRight: 8 }}>
70:         <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)' }}>
71:           {fileName && isDirty && (
72:             <Text style={{ fontSize: 14, lineHeight: '10px', color: 'rgba(255,255,255,0.85)' }}>●</Text>
73:           )}{' '}
74:           {fileName || 'Unsaved Timetable'}
75:           {statusMessage && (
76:             <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic' }}>
77:               {' '}({statusMessage})
78:             </Text>
79:           )}
80:         </Text>
81:       </div>
82: 
83:       {/* Left-center: Latest conflict message */}
84:       {latestConflict && (
85:         <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginRight: 8, color: '#ff6b6b', fontWeight: 500, flexShrink: 0 }}>
86:           <CloseCircleFilled style={{ fontSize: 10 }} />
87:           <Text style={{ fontSize: 10, color: '#ff6b6b' }}>
88:             {latestConflict.entry.offerCode} × {latestConflict.conflict.conflictingEntry.offerCode} ({latestConflict.conflict.type})
89:           </Text>
90:         </div>
91:       )}
92: 
93:       {/* Spacer */}
94:       <div style={{ flex: 1 }} />
95: 
96:       {/* Center: Link Mode status/button */}
97:       <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginRight: 8 }}>
98:         {linkingModeActive && (
99:           <Text style={{ fontSize: 10, color: '#85C1E9', fontWeight: 600 }}>
100:             <LinkOutlined style={{ marginRight: 3 }} />

(Showing lines 1-100 of 286. Use offset=101 to continue.)
</content>
```

---

## Assistant (Plan · DeepSeek V4 Flash Free · 63.9s)

_Thinking:_

Now I have a thorough understanding. Let me present the final, refined plan based on all clarifications.

Key changes from the previous plan:
1. Commit history is a tab in the right panel (alongside PlacedSchedules / ScheduleProperties)
2. Commit history works ALL the time, not just collab
3. Locking is at the individual entry level (not blueprints)
4. Share history checkbox controls what clients see
5. Hostname via Tauri command

Let me present the comprehensive plan now.

Good. Here's the complete refined plan with all clarifications integrated:

---

## Final Plan — Collaboration Feature

### 1. Rust Backend

**Cargo.toml additions:**
```toml
tokio-tungstenite = "0.24"
futures-util = "0.3"
```

**New file: `src-tauri/src/collab_server.rs`** — WebSocket server module
- `CollabServer` struct with `HashMap<usize, mpsc::UnboundedSender<Message>>`
- `join(client_id, sender)` / `leave(client_id)` / `broadcast(msg, exclude_client_id)`
- Background tokio task: accept connections, spawn per-connection handler
- Tauri state managed via `app.manage(CollabServer)` with `Mutex`

**New Tauri commands in `lib.rs`:**

| Command | Description |
|---|---|
| `start_collab_server(port)` | Spawns WS listener, returns OK |
| `stop_collab_server()` | Shuts down via cancellation token |
| `get_collab_status()` | `{ running, port, peer_count }` |
| `get_local_ips()` | Returns `Vec<String>` of LAN IPs |
| `get_hostname()` | Returns `COMPUTERNAME` (Windows) or `HOSTNAME` (Unix) |

**New migrations V8–V9:**
```sql
-- V8: commit_history
CREATE TABLE IF NOT EXISTS commit_history (
  id            TEXT PRIMARY KEY,
  timetable_id  TEXT NOT NULL,
  action_type   TEXT NOT NULL,      -- 'addBlueprint', 'undo', etc.
  action_json   TEXT NOT NULL,
  author        TEXT NOT NULL,      -- display name
  author_id     TEXT NOT NULL,
  timestamp     TEXT NOT NULL,      -- ISO 8601
  description   TEXT NOT NULL,      -- e.g. "Alice added blueprint CS101"
  is_undo       INTEGER DEFAULT 0,  -- 1 if this is an undo action
  undone_commit_id TEXT             -- if is_undo, references the original commit
);

-- V9: locks (first-writer-wins)
CREATE TABLE IF NOT EXISTS locks (
  item_id       TEXT PRIMARY KEY,
  client_id     TEXT NOT NULL,
  user_name     TEXT NOT NULL,
  acquired_at   TEXT NOT NULL
);
```

---

### 2. Dependencies

```
npm install react-use-websocket queue
```

---

### 3. Types (`src/types.ts` additions)

```typescript
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
}

export interface CommitRecord {
  id: string;
  timetableId: string;
  actionType: string;
  description: string;
  author: string;
  authorId: string;
  timestamp: number;
  isUndo: boolean;
  undoneCommitId: string | null;
}

export interface CollabAction {
  op: 'addBlueprint' | 'addInstance' | 'addInstances' | 'updateInstance'
     | 'deleteBlueprint' | 'deleteBlueprints' | 'deleteInstance'
     | 'setHiddenDays' | 'updateTheme' | 'updateBandedRows'
     | 'addDynamicData' | 'deleteDynamicData' | 'updateDynamicData'
     | 'addLinksBatched' | 'mergeEntries' | 'mergeBlueprints'
     | 'addBlueprints' | 'addBlueprintsAndInstances' | 'undo';
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
```

---

### 4. Queue System (`src/hooks/useCommitQueue.ts`)

```
Action occurs → enqueueCommit()
                  ↓
Queue (async, concurrency 1, FIFO)
                  ↓
processCommit():
  1. Apply to React state (via store callback)
  2. Insert row into commit_history SQLite table
  3. Broadcast via WebSocket (if collab)
  4. Fire event 'commit:applied' for UI update
```

**API:**
```typescript
function useCommitQueue(timetableId: string) {
  const enqueue = useCallback((action: CollabAction, isRemote: boolean) => {
    // Wrap in a Queue job
    // Stores action + metadata + status
  }, []);

  return {
    enqueueCommit: enqueue,
    isProcessing: boolean,        // true when a commit is being processed
    pendingCount: number,          // items waiting in queue
  };
}
```

**Store integration point:** Each store action method (e.g., `addBlueprint`) will:
1. Not call `commitState` directly
2. Instead, call `enqueueCommit({ op, payload })`
3. The queue job calls `commitState` internally
4. `commitState` retains its `isUndoRedoOperation` and gets a new `isRemoteOperation` flag
5. When `isRemoteOperation=true`: skip history push, skip broadcast, skip SQL write

---

### 5. Commit History (`src/hooks/useCommitHistory.ts`)

```typescript
function useCommitHistory(timetableId: string) {
  // Loads from SQLite on mount: SELECT * FROM commit_history WHERE timetable_id = $1
  // Appends on each 'commit:applied' event

  return {
    commits: CommitRecord[],
    addCommit(record): Promise<void>,   // INSERT into SQLite + state
    getUndoDescription(commitId): string | null,  // "Undone by Alice"
  };
}
```

**`commit_history_dao.ts`** helper with typed SQL operations:
- `loadHistory(timetableId) → CommitRecord[]`
- `insertCommit(record) → void`
- `getCommitsSince(timetableId, timestamp) → CommitRecord[]` (for partial sync)

---

### 6. Collaboration Hook (`src/hooks/useCollaboration.ts`)

Uses `react-use-websocket`:

```typescript
function useCollaboration(timetableId: string, commitQueue: CommitQueue) {
  // State
  const [isHost, setIsHost] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<CollabUser[]>([]);
  const [sessionInfo, setSessionInfo] = useState<{ ip: string; port: number } | null>(null);
  const [clientPermissions, setClientPermissions] = useState<Map<string, PermissionSet>>(new Map());
  const [shareFullHistory, setShareFullHistory] = useState(false);

  // WebSocket from react-use-websocket
  // Handles reconnect, message parsing, JSON encoding

  // Actions
  const hostSession = async (port: number, userName: string) => { ... };
  const joinSession = async (hostIp: string, port: number, userName: string) => { ... };
  const leaveSession = async () => { ... };
  const broadcastAction = (action: CollabAction) => { ... };
  const setClientPermission = (clientId: string, perms: PermissionSet) => { ... };

  // State sync handler:
  // On 'state:request' → host sends current store state + commit_history
  // On 'state:full' → client applies state locally

  // Permission enforcement:
  const checkPermission = (required: 'write' | 'delete' | 'create') => boolean;

  return {
    isHost, isConnected, connectedUsers, sessionInfo,
    hostSession, joinSession, leaveSession,
    broadcastAction,
    clientPermissions, setClientPermission,
    shareFullHistory, setShareFullHistory,
    checkPermission,
  };
}
```

**Message relay:** The Rust WS server is a dumb relay. All message routing is done by the host's React app:
- `state:request` → host's React app responds with `state:full` directed to that client
- `action` → broadcast to all (dedup via `actionId`)
- `permissions:update` → host broadcasts permission changes
- `lock:acquire` → host's React app checks and responds

---

### 7. Right Panel Tab System

**Current layout** (TimetablePage.tsx lines 2504–2554):
```tsx
{docxTemplate ? <DocxTemplatePreview /> 
 : activeSelectedBlock ? <SchedulePropertiesPanel />
 : <PlacedSchedules />}
```

**New layout** with tabs:
```tsx
<RightPanelTabs
  tabs={[
    { key: 'schedules', label: 'Schedules', component: <PlacedSchedules ... /> },
    { key: 'properties', label: 'Properties', component: <SchedulePropertiesPanel ... /> },
    { key: 'history', label: 'History', component: <CommitHistorySidebar ... /> },
  ]}
  activeTab={activeRightTab}
  onTabChange={setActiveRightTab}
  badgeCounts={{ history: unreadCommitCount }}
/>
```

**New file: `src/components/RightPanelTabs.tsx`** — wraps antd `Tabs` with fixed right-side layout (260px, border-left, flex-shrink-0).

**Behavior:**
- Default tab: "Schedules" (always shows PlacedSchedules)
- When a schedule block is clicked → auto-switch to "Properties" tab
- "History" tab is always manually selectable
- Each tab preserves its scroll position when switching

---

### 8. CommitHistorySidebar (`src/components/CommitHistorySidebar.tsx`)

- Receives `CommitRecord[]` from useCommitHistory
- Renders a virtualized list (or simple scroll for manageable size)
- Each item shows:
  - Colored dot: 🟢 add / 🔵 update / 🔴 delete / ↩ undo (gray)
  - Description: e.g., `Alice added "CS101" blueprint`
  - Timestamp: relative (`2m ago`) + absolute on hover
  - If `isUndo`: strikethrough + "Undone by Bob" in italic
- **Filters at top:**
  - Dropdown: "All authors" | "Me" | by specific user
  - Dropdown: "All types" | "Add" | "Update" | "Delete" | "Undo"
- Auto-scrolls to top on new commits
- Empty state: "No commits yet. Changes you make will appear here."

---

### 9. Permission Checkboxes (`src/components/PermissionCheckboxes.tsx`)

**Logic:**
```
All checked  →  write=on, delete=on, create=on, all three disabled
All unchecked → write=on, delete=on, create=on, all three enabled
All checked, user unchecks one → All=off (but now manual)
User manually checks all three → All=on
```

**Props:**
```typescript
interface PermissionCheckboxesProps {
  value: PermissionSet;
  onChange: (perms: PermissionSet) => void;
  disabled?: boolean;  // e.g. can't edit own permissions
  label?: string;      // "Default permissions for new clients"
}
```

---

### 10. CollabUserMenu (`src/components/CollabUserMenu.tsx`) — TitleBar Profile

New component placed in the TitleBar's window controls area, **after maximize button, before close button**.

```
[Minimize] [Maximize] [👤] [Close]
```

- Icon: `TeamOutlined` or `UserOutlined` (antd icons)
- Visible when collaboration is active
- `Dropdown` on click showing:
  - **Header:** "Collaboration Session" + connection status (🟢 3 connected)
  - **User list:** each entry shows:
    - Colored circle avatar (first letter of name)
    - User name
    - Badge: "Host" / role / permissions
    - If host: click → submenu to edit that user's permissions (opens `PermissionCheckboxes` modal)
  - **Divider**
  - **"Share full history"** checkbox (host only), or indicator if client
  - **"Leave Session"** button (danger)

**TitleBar.tsx changes:**
```typescript
interface TitleBarProps {
  // ... existing props
  collabUsers?: CollabUser[];
  isCollabActive?: boolean;
  isCollabHost?: boolean;
  onOpenPermissionEditor?: (clientId: string) => void;
  onLeaveSession?: () => void;
  shareFullHistory?: boolean;
  onShareFullHistoryChange?: (v: boolean) => void;
}
```

---

### 11. Host/Join Modals

**`src/components/CollabSetupModals.tsx`** — Modal component (used in TimetablePage)

**Host Modal:**
- Name input (default: from `invoke('get_hostname')`)
- Port input (default: 9182)
- "Start Session" button
- On success: shows green banner with IP:port and QR code (qrcode library or simple text)

**Join Modal:**
- Name input (default: `get_hostname()`)
- Host IP input (with placeholder "192.168.1.xxx" hint)
- Port input (default: 9182)
- "Join Session" button
- On error: inline error message

**`RibbonToolbar.tsx` changes:**
- New "Collaboration" section with buttons:
  - `TeamOutlined` icon dropdown:
    - "Host Session..." → opens HostModal
    - "Join Session..." → opens JoinModal
    - (when connected) "Leave Session" → danger item

---

### 12. Lock System (First-Writer-Wins)

**Lock flow:**
```
User clicks to edit item (schedule block or blueprint form)
  → broadcast 'lock:acquire { itemId: "entryId:scheduleId", clientId }'
  → host checks locks Map
  → if available: add lock, broadcast confirmation to all
  → if locked: respond 'lock:denied { lockedBy }' to requester

User saves/cancels edit
  → broadcast 'lock:release { itemId }'
  → host removes from locks Map, broadcasts to all

User disconnects
  → host removes all locks for that clientId, broadcasts releases
```

**Integration in TimetableGrid.tsx:**
- Each block receives a `lockedBy: string | null` prop
- If locked by another user: reduced opacity, lock icon overlay, tooltip "Editing by Alice"
- If locked by self: slightly different visual (blue border)
- Prevent click/edit/drag on locks held by others

**Integration in BlueprintList.tsx:**
- Each entry in the list takes a `lockedBy` prop
- If locked: show lock icon + user name, disable edit/delete buttons

**Integration in SchedulePropertiesPanel.tsx:**
- If locked by another: show "🔒 Currently being edited by Alice" message
- Save button disabled, fields disabled
- If host disconnects: auto-release all locks

---

### 13. Store Integration (`useTimetableStore.ts`)

**`commitState` signature:**
```typescript
commitState(
  newBlueprints, newInstances, newEditingEntryId, newFormState,
  isUndoRedoOperation = false,
  newHiddenDays, newColumnWidths, newRowHeights, newGlobalColWidth, newGlobalRowHeight,
  source: 'local' | 'remote' | 'undo' = 'local'   // NEW
)
```

- When `source = 'remote'`: skip history push, skip broadcast, skip SQL entries_json write (since the queue already triggered the SQL write from the action commit)
- When `source = 'undo'`: same as `isUndoRedoOperation = true` + record in commit_history as undo
- When `source = 'local'`: existing behavior + queue for commit_history

**New methods on TimetableStore:**
```typescript
// Called by useCollaboration when receiving remote actions
applyRemoteAction(action: CollabAction): void;

// Returns current full state for syncing new clients
getFullState(): CollabState;

// Applies full state (used when joining a session)
applyFullState(state: CollabState): void;
```

**Queue integration in store actions:**
Each action method changes from:
```typescript
addBlueprint(entry) {
  const next = [...];
  commitState(next, instances, null, DEFAULT_FORM_STATE);
  return [];
}
```
To:
```typescript
addBlueprint(entry) {
  const next = [entry, ...blueprints];
  // Apply immediately to React state for responsiveness
  commitState(next, instances, null, DEFAULT_FORM_STATE, false, hiddenDays, 
    columnWidthsRef.current, rowHeightsRef.current, globalColWidthRef.current, globalRowHeightRef.current,
    'local', true /* skipDbWrite, skipHistory */);
  // Queue the DB persistence + history recording + broadcast
  enqueueCommit({ op: 'addBlueprint', payload: { entry } }, false);
  return [];
}
```

Wait, this double-apply is problematic. Better approach:

**Simpler approach:** Most mutations go through a new `commitWithQueue` wrapper:

```typescript
const commitWithQueue = useCallback((
  action: CollabAction,
  stateUpdater: () => { blueprints: SubjectEntry[]; instances: SubjectEntry[]; ... }
) => {
  // Apply to React state immediately (optimistic)
  const newState = stateUpdater();
  commitState(newState.blueprints, newState.instances, ..., 'local', true);  // skipDbWrite=true no longer exists
  // Queue the DB persistence
  enqueueCommit(action);
}, [blueprints, instances, ...]);
```

Actually this is getting complicated. Let me simplify:

**Simplest correct approach:**

The store methods only change the React state (no more SQLite writes inside commitState). The queue handles all persistence:

```typescript
commitState(..., source: 'local' | 'remote' | 'undo' = 'local') {
  // Update React state
  setBlueprints(newBlueprints);
  setInstances(newInstances);
  // ...
  
  // Only manage history stack for local non-undo operations
  if (source === 'local') {
    pushHistory(...);
  }
  
  // NO SQLite write here anymore
  // SQLite writes happen in the queue
}
```

The store action:
```typescript
addBlueprint(entry) {
  const next = [entry, ...blueprints];
  commitState(next, instances, null, DEFAULT_FORM_STATE, false, hiddenDays, ..., 'local');
  enqueueCommit({ op: 'addBlueprint', payload: { entry } }, false);
  return [];
}
```

The queue processes `enqueueCommit`:
```typescript
async function processCommit(action, isRemote) {
  // 1. Persist to SQLite entries_json
  const combinedJson = JSON.stringify({ blueprints: state.blueprints, instances: state.instances });
  await db.execute('UPDATE timetables SET entries_json = $1 ...');
  
  // 2. Persist to commit_history
  await db.execute('INSERT INTO commit_history ...');
  
  // 3. Broadcast
  if (collab && !isRemote) broadcastAction(action);
}
```

This cleanly separates concerns:
- React state updates synchronously (for UI responsiveness)
- Queue handles all persistence (SQLite + history) asynchronously but sequentially
- Queue also handles broadcast for collab

**For remote actions:**
```typescript
applyRemoteAction(action: CollabAction) {
  // Call the appropriate store method with source='remote'
  // This updates React state directly (no queue needed for the state)
  switch (action.op) {
    case 'addBlueprint':
      addBlueprint(action.payload.entry as SubjectEntry);
      break;
    // ...
  }
  // No need to enqueue - the host already persisted via the queue
}
```

Wait, but `addBlueprint` calls `commitState` which does history push. We need a way to suppress that for remote actions.

**Solution:** The store methods accept an optional `source` parameter. All store methods check this:

```typescript
const addBlueprint = useCallback((entry: SubjectEntry, source: 'local' | 'remote' = 'local') => {
  const next = [entry, ...blueprints];
  commitState(next, instances, null, DEFAULT_FORM_STATE, false, hiddenDays, ..., source);
  
  if (source === 'local') {
    enqueueCommit({ op: 'addBlueprint', payload: { entry } });
  }
  return [];
}, [...]);
```

This is clean and minimal. The `source` parameter flows through to `commitState` which uses it to decide:
- `'local'`: push history, queue persistence
- `'remote'`: skip history, skip persistence (persisted by host)
- `'undo'`: skip history (already handled), record in commit_history

Let me revise the `commitState` param:
```typescript
commitState(
  newBlueprints, newInstances, newEditingEntryId, newFormState,
  isUndoRedoOperation = false,
  newHiddenDays, newColumnWidths, newRowHeights, newGlobalColWidth, newGlobalRowHeight,
  source: 'local' | 'remote' = 'local'
)
```

- `source='remote'` AND `!isUndoRedoOperation`: skip history push, skip SQL write
- `source='local'` AND `!isUndoRedoOperation`: do history push, queue SQL write
- `isUndoRedoOperation`: existing behavior (skip history push)

Got it. This is clean.

---

### 14. Summary of All New/Modified Files

| File | Status | Description |
|---|---|---|
| `src-tauri/Cargo.toml` | Modified | Add `tokio-tungstenite`, `futures-util` |
| `src-tauri/src/collab_server.rs` | **New** | WebSocket server module |
| `src-tauri/src/lib.rs` | Modified | Add new Tauri commands + migrations V8/V9 |
| `package.json` | Modified | Add `react-use-websocket`, `queue` |
| `src/types.ts` | Modified | Add `PermissionSet`, `CollabUser`, `CommitRecord`, `CollabAction`, `CollabState` |
| `src/hooks/useCommitQueue.ts` | **New** | Queue system for sequential commits |
| `src/hooks/useCommitHistory.ts` | **New** | Commit history state + SQLite persistence |
| `src/hooks/useCollaboration.ts` | **New** | WebSocket collab hook |
| `src/hooks/useTimetableStore.ts` | Modified | Add `source` param, `applyRemoteAction`, `applyFullState`, `getFullState` |
| `src/components/RightPanelTabs.tsx` | **New** | Tab container for right panel |
| `src/components/CommitHistorySidebar.tsx` | **New** | Commit history sidebar panel |
| `src/components/PermissionCheckboxes.tsx` | **New** | All/Write/Delete/Create checkbox group |
| `src/components/CollabUserMenu.tsx` | **New** | Profile icon dropdown in TitleBar |
| `src/components/CollabSetupModals.tsx` | **New** | Host/Join session modals |
| `src/components/TitleBar.tsx` | Modified | Add collab profile icon + props |
| `src/components/RibbonToolbar.tsx` | Modified | Add collaboration section |
| `src/components/TimetableGrid.tsx` | Modified | Add lock indicators |
| `src/components/BlueprintList.tsx` | Modified | Add lock indicators |
| `src/pages/TimetablePage.tsx` | Modified | Wire everything together |
| `src/App.tsx` | Modified | Pass collab state to TitleBar |

---

### 15. Implementation Order

| Phase | Task | Effort |
|---|---|---|
| **1** | Rust WS server + Tauri commands | Medium |
| **2** | DB migrations (commit_history, locks) | Small |
| **3** | `npm install` deps | Small |
| **4** | Types additions | Small |
| **5** | `useCommitQueue` + store integration | Medium |
| **6** | `useCommitHistory` + SQLite DAO | Medium |
| **7** | `useCollaboration` + `react-use-websocket` | Large |
| **8** | RightPanelTabs + CommitHistorySidebar | Medium |
| **9** | PermissionCheckboxes component | Small |
| **10** | CollabSetupModals (Host/Join) | Small |
| **11** | CollabUserMenu (TitleBar profile) | Medium |
| **12** | RibbonToolbar collaboration section | Small |
| **13** | Lock system (broadcast + UI indicators) | Medium |
| **14** | TimetablePage integration + wiring | Large |
| **15** | Permissions enforcement + edge cases | Medium |

---

Ready to proceed when you are. One quick confirmation: for the right panel tabs — should the **Properties** tab behave as a transient tab that auto-switches when a schedule block is clicked (and auto-switches back to Schedules when deselected), or should clicking a block just open Properties as a one-time overlay and the user manually manages tabs?

---

## User

are there any QoL features and improvements to the implementation?

---

## Assistant (Plan · DeepSeek V4 Flash Free · 44.7s)

_Thinking:_

The user is asking about QoL features and improvements to the implementation. Let me think about this holistically - both for the collaboration feature specifically and for the overall application improvements that could be made alongside the collaboration feature.

Let me think about:

1. **Collaboration-specific QoL features**
2. **General QoL improvements that could be bundled**
3. **Optimization improvements**
4. **Edge cases and robustness**

Let me be thorough here.

### Collaboration QoL

1. **Auto-discovery (mDNS/SSDP)** - Instead of manually typing IP:port, clients automatically discover hosts on the LAN. This could use a simple UDP broadcast where the host broadcasts its presence periodically, or we could use a library. Simpler version: show the host IP in large text + generate a QR code that clients can scan with their phone (since this is a desktop app, not sure how useful QR scanning is on another desktop). Actually, a simpler approach: the host modal shows the IP prominently with a copy button; the join modal could show a "Scanning network..." button that probes common ports on the LAN.

2. **Connection quality indicator** - Show signal strength / latency in the status bar. Green = good, yellow = slow, red = disconnected. Include reconnection count.

3. **Visual activity indicators** - When a remote user selects or hovers over a schedule block, briefly show a colored ripple/glow on other clients' screens. This gives a sense of presence.

4. **Conflict toast notifications** - When a remote user's edit conflicts with your edit (e.g., they changed the same item), show a notification with details.

5. **Session history export** - Export the commit history as JSON or CSV.

6. **Undo for remote changes** - Currently undo is per-user. But what if you want to revert a change made by someone else? Could add an "admin undo" option for hosts.

7. **User mute/block** - Host can temporarily mute a user (their edits don't get applied), useful if someone is spamming.

8. **Session auto-end on host close** - When the host closes the timetable or app, gracefully disconnect all clients and show a "Session ended by host" message.

### General QoL Improvements (not collab-specific)

1. **SQLite write batching** - Currently every mutation writes to SQLite immediately. Even with the queue, we could batch writes: collect changes over 200ms, write once. This is a significant optimization.

2. **Virtual list for commit history** - If the history gets long (hundreds or thousands of entries), rendering all of them will be slow. Use a virtualized list (react-window or similar, or antd's built-in virtual list).

3. **Commit history search** - Search/filter within the commit history by keyword.

4. **Smart conflict detection for remote edits** - When receiving a remote action, detect if it conflicts with local unsaved changes and notify the user.

5. **Session restore** - If the host's app crashes, provide a way to restore the session (re-connect, get latest state). Not easily doable with current architecture since the WS server is embedded in Rust and dies with the app.

6. **Offline queue** - Queue local edits if the connection drops, then replay when reconnected.

7. **Permissions presets** - Instead of per-checkbox permissions, offer presets: "Viewer" (read-only), "Editor" (write + create), "Admin" (all). The per-checkbox UI is still there for fine-tuning.

8. **Audit trail** - The commit history already serves this purpose, but we could add a "Export audit trail" button that generates a report.

9. **Snapshot/checkpoint** - Allow creating named checkpoints in the commit history that can be reverted to.

10. **Diff view** - Show what changed in a commit (e.g., "Before: Room 101, After: Room 102"). This would require storing the previous state alongside the action.

### Performance Optimizations

1. **Differential state sync** - Instead of sending the full state to new joiners, send a diff from a baseline. For large timetables with thousands of entries, this matters.

2. **Compression** - Compress WebSocket messages (especially full state syncs) using zlib or similar.

3. **History pruning** - Allow setting a maximum commit history size (e.g., keep last 1000 commits) to prevent the SQLite table from growing unbounded.

4. **Lazy loading commit history** - Load commit history in pages of 50, not all at once.

5. **Debounced broadcast** - For rapid edits (e.g., dragging a schedule block which fires many events), debounce the broadcast to send at most once per 100ms.

### UX Improvements

1. **Onboarding tooltips** - When first hosting/joining, show a brief tooltip explaining the session controls.

2. **User avatar colors** - Auto-assign a distinct color to each user. Store the assignment so it's consistent across reconnects.

3. **Keyboard shortcuts for collab** - Ctrl+Shift+H to host, Ctrl+Shift+J to join, etc.

4. **Collab status in window title** - Show "(Hosting)" or "(Connected to X)" in the window title bar text area.

5. **Auto-scroll to latest commit** - When viewing the history tab and a new commit arrives, auto-scroll to the top (where the latest is). But allow manual scrolling to pause auto-scroll.

6. **Commit history grouping** - Group commits by time (Today, Yesterday, This Week) for easier browsing.

7. **Commit detail expansion** - Click on a commit to expand and see the full action JSON payload.

8. **Notification sounds** - Optional sound when a remote user makes a change (configurable in preferences).

9. **Presence indicators in the grid** - Show small colored dots on schedule blocks that are currently being viewed/hovered by remote users (not just edited/locked).

10. **Host transfer** - The host can designate another user as the new host before leaving.

### Code Quality Improvements

1. **Action type safety** - Use discriminated unions for CollabAction to get type narrowing in the reducer.

2. **Error boundaries** - Wrap collab components in error boundaries to prevent WS errors from crashing the app.

3. **Logging** - Add structured logging for collab events (connect, disconnect, action received, action broadcast) for debugging.

4. **Queue health monitoring** - Expose queue stats (pending count, processing time, error count) for debugging.

Let me now think about which of these are the most valuable and practical.

### Top QoL Features to Recommend

**Must-have (high impact, low effort):**
1. Connection status indicator in StatusBar (green/yellow/red dot)
2. User avatar colors (auto-assign)
3. Copy IP button in host modal
4. Auto-scroll in commit history
5. Commit history detail expansion (click to see JSON)
6. Keyboard shortcuts for collab actions
7. Offline queue (queue local edits while disconnected, replay on reconnect)

**Nice-to-have (medium impact, medium effort):**
1. Visual activity indicators (colored glow on items being viewed)
2. Conflict toast notifications for remote edits
3. Permissions presets (Viewer/Editor/Admin)
4. Commit history search
5. Diff view in commit details
6. Auto-discovery (network scan for hosts)
7. Debounced broadcasts for rapid edits

**Future considerations (higher effort):**
1. Host transfer
2. Session restore on crash
3. Snapshot/checkpoints
4. Notification sounds

Let me present these in a structured way.

Good question. Here are QoL features and improvements organized by value and effort:

---

### High Value — Low Effort (Should Do)

| # | Feature | Why |
|---|---|---|
| **1** | **Connection status indicator** | Green/yellow/red dot in StatusBar. Shows latency in ms on hover. Gives immediate confidence about session health. |
| **2** | **Auto-assign user colors** | Each user gets a distinct color from a preset palette. Used for avatars, lock indicators, and grid highlights. Consistent across reconnects (hash clientId). |
| **3** | **Copy IP button** | In Host modal, show IP in large monospace text with a copy icon. Saves users from having to manually select and copy. |
| **4** | **Auto-scroll in CommitHistory** | New commits appear at top. If user scrolls down to browse history, auto-scroll pauses. One click to "Jump to latest" resumes it. |
| **5** | **Commit detail expansion** | Click any commit row to expand/collapse showing the raw action JSON. Useful for debugging and power users. |
| **6** | **Collab keyboard shortcuts** | `Ctrl+Shift+H` → Host modal, `Ctrl+Shift+J` → Join modal, `Ctrl+Shift+L` → Leave session. Documented in the UI. |
| **7** | **Graceful disconnect/reconnect** | `react-use-websocket` reconnects automatically. Show a brief toast "Reconnecting..." with a count. Queue local edits offline, replay on reconnect. |
| **8** | **History grouping** | Group commits by date headers: "Today", "Yesterday", "July 12, 2026". Makes browsing history much easier. |

---

### High Value — Medium Effort (Should Consider)

| # | Feature | Why |
|---|---|---|
| **9** | **Diff view** | In commit detail expansion, show what changed: `"John Smith" → "Jane Doe"` for teacher, `Room 101 → Room 204` for room. Requires storing a lightweight diff alongside the action. |
| **10** | **Permissions presets** | Add a dropdown alongside checkboxes: "Viewer" (read-only), "Editor" (write+create), "Admin" (all). The checkboxes update to match the preset. Users can then fine-tune. |
| **11** | **Debounced rapid edits** | If a user rapidly makes many small changes (e.g., batch import, drag-resizing cells), debounce the broadcast to once per 150ms. Prevents flooding the WS with near-identical messages. |
| **12** | **Commit history search** | Search bar at top of history tab. Filters by keyword in description, author, action type. Instantly narrows down large histories. |
| **13** | **Live presence glow** | When a remote user's cursor is over a schedule block, show a subtle colored glow on that block in other clients' grids. Gives a sense of "someone is looking at this." Not just locked items — livelier. |
| **14** | **History pagination** | Load 50 commits at a time, "Load more" at bottom. Prevents UI freeze on huge histories. |
| **15** | **Session end notification** | When host closes the timetable or disconnects, clients see a clear "Session ended by host" message rather than a cryptic WS close. |

---

### Lower Priority (Future)

| Feature | Note |
|---|---|
| **Snapshot/checkpoints** | Named save points in history that can be reverted to. Useful but complex undo semantics. |
| **Host transfer** | Designate another user as host. Requires migrating WS server responsibility. Tough with embedded Rust server. |
| **Notification sounds** | Small quality bump but adds audio dependency and preferences complexity. |
| **Audit trail export** | Export commit history as CSV/JSON. Straightforward once history system is built. |

---

### Optimization Improvements

| # | Improvement | Description |
|---|---|---|
| **1** | **SQLite write batching** | The queue already serializes writes. Further improvement: batch multiple small schema writes (entries_json updates) within a short window. |
| **2** | **Differential state sync** | When sending full state to a new joiner, only send the data, not the schema/metadata. For very large timetables (5000+ entries), this matters. |
| **3** | **History pruning** | Optional setting: "Keep last N commits" (default: unlimited). Prunes old entries from commit_history on a schedule or on session end. |
| **4** | **React.memo on grid cells** | Not collab-specific, but relevant: remote lock status changes will re-render the grid. `React.memo` on individual cells prevents cascading re-renders. |

---

### My Top Recommendations (If You Want to Prioritize)

If I had to pick the **5 most impactful** items for v1:

1. **Auto-assign colors** — makes the multi-user experience visible and friendly immediately
2. **Connection indicator + graceful reconnect** — users trust the system when they see it's healthy
3. **Offline queue with replay** — prevents data loss during brief disconnections
4. **Debounced broadcasts** — keeps the WS channel from being saturated
5. **History grouping + expand detail** — makes the commit history immediately useful and browsable

Want me to incorporate any of these into the final plan?

---

## User

incorporate the 5 most impactful improvements to the final plan.

---

## Assistant (Plan · DeepSeek V4 Flash Free · 51.9s)

_Thinking:_

The user wants me to incorporate the 5 most impactful QoL improvements into the final plan. I'm in read-only/plan mode, so I'll update the plan but won't make any edits.

Let me update the plan with the 5 improvements:

1. **Auto-assign user colors** — distinct color per user from a preset palette
2. **Connection indicator + graceful reconnect** — green/yellow/red dot, reconnection with offline queue
3. **Offline queue with replay** — buffer local edits during disconnection, replay on reconnect
4. **Debounced broadcasts** — 150ms debounce for rapid edits
5. **History grouping + expand detail** — date headers in history, click to expand raw action JSON

I'll integrate these into the relevant sections of the plan.

Updated the final plan with the 5 improvements integrated into each relevant section:

---

## Final Plan v2 — Collaboration Feature (with QoL)

---

### 1. Rust Backend

**Cargo.toml additions:**
```toml
tokio-tungstenite = "0.24"
futures-util = "0.3"
```

**New file: `src-tauri/src/collab_server.rs`** — WebSocket server module
- `CollabServer` struct with `HashMap<usize, mpsc::UnboundedSender<Message>>`
- `join(client_id, sender)` / `leave(client_id)` / `broadcast(msg, exclude_client_id)`
- Background tokio task: accept connections, spawn per-connection handler
- Tauri state managed via `app.manage(CollabServer)` with `Mutex`

**New Tauri commands in `lib.rs`:**

| Command | Description |
|---|---|
| `start_collab_server(port)` | Spawns WS listener, returns OK |
| `stop_collab_server()` | Shuts down via cancellation token |
| `get_collab_status()` | `{ running, port, peer_count }` |
| `get_local_ips()` | Returns `Vec<String>` of LAN IPs |
| `get_hostname()` | Returns `COMPUTERNAME` (Windows) or `HOSTNAME` (Unix) |

**New migrations V8–V9:**
```sql
-- V8: commit_history
CREATE TABLE IF NOT EXISTS commit_history (
  id            TEXT PRIMARY KEY,
  timetable_id  TEXT NOT NULL,
  action_type   TEXT NOT NULL,
  action_json   TEXT NOT NULL,
  author        TEXT NOT NULL,
  author_id     TEXT NOT NULL,
  timestamp     TEXT NOT NULL,
  description   TEXT NOT NULL,
  is_undo       INTEGER DEFAULT 0,
  undone_commit_id TEXT
);

-- V9: locks
CREATE TABLE IF NOT EXISTS locks (
  item_id       TEXT PRIMARY KEY,
  client_id     TEXT NOT NULL,
  user_name     TEXT NOT NULL,
  acquired_at   TEXT NOT NULL
);
```

---

### 2. Dependencies

```
npm install react-use-websocket queue
```

---

### 3. Types (`src/types.ts` additions)

```typescript
export interface PermissionSet {
  all: boolean;
  write: boolean;
  delete: boolean;
  create: boolean;
}

export interface CollabUser {
  clientId: string;
  userName: string;
  color: string;              // QoL: auto-assigned from preset palette
  permissions: PermissionSet;
  joinedAt: number;
}

export interface CommitRecord {
  id: string;
  timetableId: string;
  actionType: string;
  description: string;
  author: string;
  authorId: string;
  timestamp: number;
  isUndo: boolean;
  undoneCommitId: string | null;
}

export interface CollabAction {
  op: 'addBlueprint' | 'addInstance' | 'addInstances' | 'updateInstance'
     | 'deleteBlueprint' | 'deleteBlueprints' | 'deleteInstance'
     | 'setHiddenDays' | 'updateTheme' | 'updateBandedRows'
     | 'addDynamicData' | 'deleteDynamicData' | 'updateDynamicData'
     | 'addLinksBatched' | 'mergeEntries' | 'mergeBlueprints'
     | 'addBlueprints' | 'addBlueprintsAndInstances' | 'undo';
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
```

**QoL — User color palette** (`src/utils/userColors.ts`):
```typescript
export const USER_COLORS = [
  '#E06C75', '#61AFEF', '#98C379', '#E5C07B', '#C678DD',
  '#56B6C2', '#D19A66', '#7EC8E3', '#B392F0', '#F97583',
];

// Deterministic from clientId hash
export function hashColor(clientId: string): string {
  let hash = 0;
  for (let i = 0; i < clientId.length; i++) {
    hash = ((hash << 5) - hash) + clientId.charCodeAt(i);
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}
```

---

### 4. Queue System (`src/hooks/useCommitQueue.ts`)

**QoL: Debounced rapid edits** — queue detects rapid-fire actions (e.g., batch import, resizing) and coalesces/debounces:
```typescript
// Debounce window: 150ms
// If the same op type arrives within 150ms, batch their payloads
// Only applies to bulk/import-like ops, not singular edits
```

```
Store action → enqueueCommit(action, isRemote)
                  ↓
Queue (async, concurrency 1, FIFO, autostart)
                  ↓
processCommit():
  1. Apply to React state (via store callback)
  2. Insert row into commit_history SQLite table
  3. Broadcast via WebSocket (if collab, debounced)
  4. Fire event 'commit:applied' for UI
```

**QoL: Offline queue with replay** — when WS disconnects, edits queue locally:
```typescript
interface OfflineBuffer {
  id: string;
  action: CollabAction;
  timestamp: number;
}

// On disconnect: start accumulating in offlineBuffer
// On reconnect: replay all offlineBuffer entries through the queue in order
// After replay complete: show toast "Your offline edits have been synced (X changes)"
```

---

### 5. Commit History (`src/hooks/useCommitHistory.ts`)

```typescript
function useCommitHistory(timetableId: string) {
  const [commits, setCommits] = useState<CommitRecord[]>([]);

  // Load from SQLite on mount
  useEffect(() => {
    const rows = await db.select('SELECT * FROM commit_history WHERE timetable_id = $1 ORDER BY timestamp DESC');
    setCommits(rows.map(mapToRecord));
  }, [timetableId]);

  // Listen for new commits
  useEffect(() => {
    const handler = (e: Event) => {
      const record = (e as CustomEvent<CommitRecord>).detail;
      setCommits(prev => [record, ...prev]);
    };
    window.addEventListener('commit:applied', handler);
    return () => window.removeEventListener('commit:applied', handler);
  }, []);

  // QoL: getCommitsSince for partial history sync to clients
  const getCommitsSince = useCallback(async (since: number): Promise<CommitRecord[]> => {
    const rows = await db.select(
      'SELECT * FROM commit_history WHERE timetable_id = $1 AND timestamp > $2 ORDER BY timestamp ASC',
      [timetableId, new Date(since).toISOString()]
    );
    return rows.map(mapToRecord);
  }, [timetableId]);

  return { commits, addCommit, getCommitsSince };
}
```

---

### 6. Collaboration Hook (`src/hooks/useCollaboration.ts`)

Uses `react-use-websocket`:

```typescript
function useCollaboration(timetableId: string, commitQueue: CommitQueue) {
  const [isHost, setIsHost] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<CollabUser[]>([]);
  const [sessionInfo, setSessionInfo] = useState<...>(null);
  const [clientPermissions, setClientPermissions] = useState<Map<...>>(new Map());
  const [shareFullHistory, setShareFullHistory] = useState(false);

  // QoL: connection quality state
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'degraded' | 'disconnected'>('disconnected');
  const [latency, setLatency] = useState<number>(0);
  // Periodic ping/pong: host measures response time
  // >200ms = degraded, >1000ms or no response = disconnected

  // QoL: offline buffer for replay
  const offlineBufferRef = useRef<OfflineBuffer[]>([]);
  const localActionCounterRef = useRef(0);

  // QoL: debounced broadcast
  const broadcastThrottleRef = useRef<Record<string, number>>({});
  const broadcastAction = useCallback((action: CollabAction) => {
    const now = Date.now();
    const last = broadcastThrottleRef.current[action.op] || 0;
    if (now - last < 150) return;  // skip — debounce
    broadcastThrottleRef.current[action.op] = now;
    sendJsonMessage({ type: 'action', ... });
  }, []);

  // Offline replay on reconnect
  useEffect(() => {
    if (readyState === 1 && offlineBufferRef.current.length > 0) {
      const buffer = offlineBufferRef.current;
      offlineBufferRef.current = [];
      for (const entry of buffer) {
        enqueueCommit(entry.action, true);  // isRemote = true (these are our own actions)
      }
      // Show notification: "Synced X offline changes"
    }
  }, [readyState]);

  const hostSession = async (port, userName) => { ... };
  const joinSession = async (hostIp, port, userName) => { ... };
  const leaveSession = async () => { ... };

  return {
    isHost, isConnected, connectedUsers, sessionInfo,
    connectionQuality, latency,     // QoL
    hostSession, joinSession, leaveSession,
    broadcastAction,
    clientPermissions, setClientPermission,
    shareFullHistory, setShareFullHistory,
    checkPermission,
  };
}
```

**State sync flow:**
- `state:request` → host sends `state:full` (CollabState) + if `shareFullHistory`, sends commit_history since epoch
- If `!shareFullHistory`, host sends commit_history from connection timestamp only
- Client receives `state:full` → `store.applyFullState(state)` → loads commit_history into sidebar

---

### 7. Right Panel Tab System

**New file: `src/components/RightPanelTabs.tsx`**

```tsx
<RightPanelTabs
  tabs={[
    { key: 'schedules',   label: 'Schedules',   component: <PlacedSchedules ... /> },
    { key: 'properties',  label: 'Properties',  component: <SchedulePropertiesPanel ... /> },
    { key: 'history',     label: 'History',      component: <CommitHistorySidebar ... /> },
  ]}
  activeTab={activeRightTab}
  onTabChange={setActiveRightTab}
  badgeCounts={{ history: unreadCount }}
/>
```

260px width, `border-left: 1px solid #D0D7E3`, `flexShrink: 0`, `overflow: hidden`.

**Behavior:**
- Default tab: "Schedules"
- Clicking a schedule block auto-switches to "Properties"
- "History" tab is manual only
- Each tab preserves scroll state on switch

---

### 8. CommitHistorySidebar (`src/components/CommitHistorySidebar.tsx`)

**QoL: History grouping + expand detail**

```
┌──────────────────────────┐
│ 🔍 Search...              │
│ Author: [All ▼]  Type: [All ▼] │
├──────────────────────────┤
│ ─── Today ───             │
│                           │
│ ● "Alice added CS101 bp"  │
│   by Alice · 2m ago       │
│   [click to expand]       │
│   ▼                       │
│   { "op": "addBlueprint", │
│     "payload": { ... } }  │
│                           │
│ ↶ "Bob undid: CS101 add"  │
│   by Bob · 5m ago         │
│   (strikethrough style)   │
│                           │
│ ─── Yesterday ───         │
│ ● "Alice updated CS201"   │
│   by Alice · 1d ago       │
└──────────────────────────┘
```

- **Grouping:** date headers — "Today", "Yesterday", "July 12, 2026"
- **Expand:** click any row to toggle expansion showing raw action JSON in a `<pre>` block
- **Search:** filters by keyword across description + author
- **Filters:** author dropdown, action type dropdown
- **Undo styling:** strikethrough + italic "Undone by X" label
- **Auto-scroll:** new commits insert at top. If user has scrolled down, a "⬆ New commit" chip appears at top to click back up.

---

### 9. Permission Checkboxes (`src/components/PermissionCheckboxes.tsx`)

**Logic:**
```
All checked  → write=on, delete=on, create=on (all disabled)
All unchecked → write, delete, create enabled individually
All checked, user unchecks one → All=off (individual mode)
User manually checks all three → All=on (all disabled)
```

**QoL: Permission presets dropdown** alongside the checkboxes:
```
[Viewer ▼]  [☑ All]  [☑ Write]  [☑ Delete]  [☑ Create]
```
- **Viewer** → all unchecked (read-only)
- **Editor** → write + create checked
- **Admin** → all checked

Selecting a preset updates the checkboxes accordingly; manual checkbox changes reset the preset selection to "Custom".

---

### 10. CollabUserMenu (`src/components/CollabUserMenu.tsx`) — TitleBar Profile

```
[Minimize] [Maximize] [👥 3] [Close]
```

- **Icon:** `TeamOutlined` with a badge showing connected count
- **Dropdown on click:**
  - **Header:** "Collaboration" + connection quality indicator:
    ```
    🟢 Good    <50ms
    🟡 Degraded  50-200ms
    🔴 Disconnected
    ```
  - **Your info:** "You: Alice" + assigned color chip
  - **User list:**
    ```
    🟥 Alice (Host)      [Admin ▼]
    🟦 Bob               [Editor ▼]
    🟩 Carol             [Viewer ▼]
    ```
    - Each user shows: colored circle (first letter), name, host badge
    - Host can click permission preset dropdown per user
    - Non-host users only see the list (no edit)
  - **Divider**
  - **☑ Share full history with clients** (host only)
  - **"Disconnect"** button (red)

**TitleBar.tsx changes:** Insert button between maximize and close in the window controls div.

---

### 11. Host/Join Modals (`src/components/CollabSetupModals.tsx`)

**Host Modal:**
```
┌──────────────────────────────┐
│  Host Collaboration Session   │
│                              │
│  Your Name: [Alice        ]  │
│  Port:      [9182         ]  │
│                              │
│  ┌──────────────────────────┐│
│  │  Your IP: 192.168.1.42  ││
│  │     [📋 Copy IP]         ││
│  └──────────────────────────┘│
│                              │
│  [   Start Session   ]       │
└──────────────────────────────┘
```

- Name default from `invoke('get_hostname')`
- **QoL: Copy IP button** — renders IP in large monospace text with a clipboard copy icon. Click copies to clipboard, shows brief "Copied!" tooltip.

**Join Modal:**
```
┌──────────────────────────────┐
│  Join Collaboration Session  │
│                              │
│  Your Name:  [Bob         ]  │
│  Host IP:    [192.168.1.42]  │
│  Port:       [9182        ]  │
│                              │
│  [   Join Session   ]        │
└──────────────────────────────┘
```

---

### 12. Lock System (First-Writer-Wins)

**Flow:**
```
User clicks to edit item (schedule block or blueprint form)
  → broadcast lock:acquire { itemId: "entryId:scheduleId", clientId }
  → host checks locks Map (in-memory + SQLite locks table)
  → if available: add lock, broadcast confirmation to all
  → if locked: respond lock:denied { lockedBy: "Alice" }

User saves/cancels edit
  → broadcast lock:release { itemId }
  → host removes lock, broadcasts to all

User disconnects
  → host removes all locks for that clientId, broadcasts releases
```

**Integration in TimetableGrid.tsx:**
- Each block receives `lockedBy: string | null`
- If locked by another: reduced opacity + lock icon overlay + tooltip
- If locked by self: blue border indicator
- Prevent click/edit/drag on others' locks

**Integration in BlueprintList.tsx:**
- Each entry receives `lockedBy`
- Show lock icon + user name next to locked items
- Disable edit/delete buttons

**Integration in SchedulePropertiesPanel.tsx:**
- If locked by another: show banner "🔒 Being edited by Alice" — all fields disabled

---

### 13. Connection Indicator (QoL) — StatusBar

**StatusBar.tsx changes:**

Add a connection indicator to the far left of the StatusBar:
```
[🟢 12ms]  Filename ●  |  (conflict info)  |  [Link Mode]  |  [Room]  |  🔔
```

- Green dot + latency when connected and latency < 50ms
- Yellow dot when latency 50–200ms
- Red dot when disconnected / >200ms
- Pulse animation when reconnecting
- Tooltip on hover: "Connected to 192.168.1.42:9182 (3 users)"

---

### 14. Store Integration (`useTimetableStore.ts`)

**`commitState` signature updated:**
```typescript
commitState(
  newBlueprints, newInstances, newEditingEntryId, newFormState,
  isUndoRedoOperation = false,
  newHiddenDays, newColumnWidths, newRowHeights, newGlobalColWidth, newGlobalRowHeight,
  source: 'local' | 'remote' = 'local'
)
```

- `source='remote'`: skip history push, skip SQL write
- `source='local'`: push history, trigger queue for SQL persistence

**All store action methods accept optional `source` param:**
```typescript
const addBlueprint = useCallback((entry: SubjectEntry, source: 'local' | 'remote' = 'local') => {
  const next = [entry, ...blueprints];
  commitState(next, instances, null, DEFAULT_FORM_STATE, false, hiddenDays, ..., source);
  if (source === 'local') enqueueCommit({ op: 'addBlueprint', payload: { entry } });
  return [];
}, [...]);
```

**New methods:**
```typescript
applyRemoteAction(action: CollabAction): void;
getFullState(): CollabState;
applyFullState(state: CollabState): void;
```

**QoL: Responsive local state** — React state updates synchronously (no waiting for queue). The queue only handles persistence + broadcast. This means the UI never lags behind user input.

---

### 15. Summary of All New/Modified Files

| File | Status |
|---|---|
| `src-tauri/Cargo.toml` | Modified |
| `src-tauri/src/collab_server.rs` | **New** |
| `src-tauri/src/lib.rs` | Modified |
| `src/utils/userColors.ts` | **New** (QoL) |
| `package.json` | Modified |
| `src/types.ts` | Modified |
| `src/hooks/useCommitQueue.ts` | **New** |
| `src/hooks/useCommitHistory.ts` | **New** |
| `src/hooks/useCollaboration.ts` | **New** |
| `src/hooks/useTimetableStore.ts` | Modified |
| `src/components/RightPanelTabs.tsx` | **New** |
| `src/components/CommitHistorySidebar.tsx` | **New** |
| `src/components/PermissionCheckboxes.tsx` | **New** |
| `src/components/CollabUserMenu.tsx` | **New** |
| `src/components/CollabSetupModals.tsx` | **New** |
| `src/components/TitleBar.tsx` | Modified |
| `src/components/RibbonToolbar.tsx` | Modified |
| `src/components/TimetableGrid.tsx` | Modified |
| `src/components/BlueprintList.tsx` | Modified |
| `src/components/StatusBar.tsx` | Modified |
| `src/pages/TimetablePage.tsx` | Modified |
| `src/App.tsx` | Modified |

---

### 16. Implementation Order

| Phase | Task | Dependencies |
|---|---|---|
| **1** | Rust WS server + Tauri commands | None |
| **2** | DB migrations (commit_history, locks) | None |
| **3** | `npm install` deps | None |
| **4** | Types + userColors | None |
| **5** | PermissionCheckboxes component | #4 |
| **6** | `useCommitQueue` + store integration | #2, #4 |
| **7** | `useCommitHistory` + SQLite DAO | #2, #4 |
| **8** | `useCollaboration` (includes offline buffer, debounced broadcasts, ping/pong) | #1, #6, #7 |
| **9** | RightPanelTabs + CommitHistorySidebar (grouping, expand, search, filters) | #4, #7 |
| **10** | CollabSetupModals (Host/Join with copy IP, hostname default) | #1 |
| **11** | CollabUserMenu (TitleBar profile with color palette, quality indicator) | #4, #8, #9 |
| **12** | RibbonToolbar collab section | #8 |
| **13** | StatusBar connection indicator | #8 |
| **14** | Lock system (broadcast + grid/list indicators) | #8 |
| **15** | TimetablePage integration + wiring | All above |
| **16** | Permission enforcement + edge case handling | #8, #5 |

Ready to implement whenever you are.

---

