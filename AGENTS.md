---
name: coding-skills
description: Describe what this skill does and when to use it. Include keywords that help agents identify relevant tasks.
---

# Timetable Project Context

## Quick start

```bash
npm run dev          # Vite dev server on http://localhost:5173
npm run dev:tauri    # Full Tauri desktop dev (auto-runs `npm run dev`)
npm run build        # tsc -b && vite build
npm run lint         # oxlint (not eslint)
npm run preview      # vite preview
```

- `npm run build` is the typecheck step (`tsc -b`). There is no separate `typecheck` script.
- There are **no tests** — no test framework is installed.

## Architecture

- **Simple state-based routing** in `src/App.tsx` (no React Router). Pages: `home`, `timetable`, `preferences`.
- **Two Tauri windows**: `main` and `subject-form` (see `tauri.conf.json` and `capabilities/default.json`). The `App` component detects which window it's in via `getCurrentWindow().label`.
- **SQLite via `@tauri-apps/plugin-sql`** — the frontend runs SQL directly; Rust only provides the connection pool and 4 thin commands (`save_file_bytes`, `read_text_file`, `file_exists`, `resolve_default_path`).
- **Path alias**: `@/` → `src/` (configured in `tsconfig.app.json`).

## Data & state

- **`timetable.db`** SQLite file, auto-created with migrations defined in `src-tauri/src/lib.rs` (7 migrations).
- **Undo/redo** is in-memory only via a history stack in `useTimetableStore`. It does not persist undo history across sessions.
- **Imported suggestions** stored in `localStorage` (per timetable ID).
- **Preferences** stored in `localStorage`.

## Key quirks

- **Right-click disabled** via `document.addEventListener('contextmenu', e => e.preventDefault())` in `src/main.tsx`.
- **Keyboard shortcuts** (all require Ctrl/Meta): `N` new, `O` open, `Q` close timetable, `S` save, `Shift+S` export, `Z` undo, `Shift+Z`/`Y`/`R` redo.
- **TypeScript ~6.0**, React 19, antd 6, Vite 8.
- **Oxlint only** — no ESLint, no Prettier config found.
- **No CI workflows** (empty `.github/`).
- **No React Compiler** enabled.
- `tsconfig.json` uses project references (`tsconfig.app.json` + `tsconfig.node.json`).
- `verbatimModuleSyntax` is enabled — use `import type` for type-only imports.

## Export

- XLSX export via exceljs + Tauri IPC (`save_file_bytes` command in Rust).
- Teacher names parsed from comma-separated format via `parseTeacherName` utility.

---

# Global Coding Best Practices

You are an expert coding assistant. Provide concise, direct answers. Avoid filler phrases such as 'Certainly, I can help you with that,' 'That's a great question,' or any unnecessary conversational padding.

## 1. Interaction and Communication Policy
* Skip all greetings, polite apologies, or chatty meta-commentary.
* Provide highly objective, technical, and direct outputs.
* Focus primarily on providing code diffs and execution logs.

## 2. Exploration and Planning Phrase
* Do not edit files immediately upon receiving a prompt.
* First, explore the existing codebase to locate target files or interfaces.
* Second, present a brief implementation plan before executing file changes.

## 3. Strict Verification Loops
* Always locate or initialize a local test suite before writing new features.
* Prioritize writing missing unit tests prior to main application logic.
* Run the project's testing command immediately after applying edits.
* Automatically iterate and fix code if the test output indicates a failure.

## 4. Code Quality and Styling
* **Keep it Simple:** Write straightforward implementations and avoid overly complex abstractions.
* **Pragmatic Components:** Do not break down components too much. Keep related logic together unless the fragment is genuinely reused in multiple contexts.
* **No Recursion:** The use of recursive algorithms or function calls is strictly prohibited. Always favor iterative loops (e.g., `for`, `while`, or standard array methods) for clarity and predictability.
* **Styling:** Use `theme.css` as the single source of truth for all styling. Avoid hard-coded CSS properties within components.
* Document every exported class, function, or component property.
* Use inline comments to explain "why" a block is written, not "what" it does.
* Constrain files to single features or tightly bounded modular responsibilities.
* Provide minimal code blocks or diffs instead of re-writing healthy code blocks.

## 5. Security & Terminal Command Gatekeeping
* Never hardcode sensitive environment parameters, passwords, or API keys.
* Request explicit human verification before running infrastructure destruction scripts.
* Do not run file-deletion commands without interactive confirmation.

## 6. Type Safety & Static Typing (Antigravity IDE)
* Always enforce strict static typing across the codebase.
* Prioritize explicit type declarations for all variables, parameters, and return types.
* Never use the `any` type under any circumstances.
* If a type is truly indeterminate, use the `unknown` type instead of `any`.