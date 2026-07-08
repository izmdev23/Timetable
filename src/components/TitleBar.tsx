import { useState, useEffect } from "react";
import { Dropdown, Modal, Input, message } from "antd";
import type { MenuProps } from "antd";
import {
  FileOutlined,
  PlusOutlined,
  FolderOpenOutlined,
  CloseOutlined,
  SaveOutlined,
  DownloadOutlined,
  SettingOutlined,
  MinusOutlined,
  BorderOutlined,
  UndoOutlined,
  RedoOutlined,
  ImportOutlined,
} from "@ant-design/icons";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";
import type { TimetableMeta } from "../types";

interface TitleBarProps {
  /** Current page — controls which File items are enabled */
  page: "home" | "timetable" | "preferences";
  /** Name of the open timetable (timetable page only) */
  timetableName?: string;
  /** Called to open a timetable for editing */
  onOpenTimetable?: (meta: TimetableMeta) => void;
  /** Called to close the open timetable (go back to home) */
  onCloseTimetable?: () => void;
  /** Called to trigger File > Save As (XLSX export) */
  onSaveAs?: () => void;
  /** Called to trigger File > Save (JSON export) */
  onSave?: () => void;
  /** Called to trigger Import and Merge */
  onImportMerge?: () => void;
  /** Called to open the Preferences page */
  onOpenPreferences?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

/** Custom frameless title bar with a File dropdown menu and window controls. */
export function TitleBar({
  page,
  timetableName,
  onOpenTimetable,
  onCloseTimetable,
  onSaveAs,
  onSave,
  onImportMerge,
  onOpenPreferences,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: TitleBarProps) {
  const [messageApi, contextHolder] = message.useMessage();

  // New timetable modal state
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const isTimetable = page === "timetable";

  // Listen for keyboard shortcut events dispatched by App.tsx
  useEffect(() => {
    function onNew() { setNewName(""); setNewModalOpen(true); }
    function onOpen() { void handleOpen(); }
    window.addEventListener("titlebar:new", onNew);
    window.addEventListener("titlebar:open", onOpen);
    return () => {
      window.removeEventListener("titlebar:new", onNew);
      window.removeEventListener("titlebar:open", onOpen);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreateTimetable(): Promise<void> {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      // Directly create the timetable via SQLite — avoids needing useTimetableList here
      const db = await Database.load("sqlite:timetable.db");
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await db.execute(
        "INSERT INTO timetables (id, name, entries_json, entry_count, created_at, updated_at, hidden_days) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [id, trimmed, "[]", 0, now, now, "[\"Sun\"]"],
      );
      const meta: TimetableMeta = { id, name: trimmed, entryCount: 0, createdAt: now, updatedAt: now, hiddenDays: ["Sun"] };
      setNewModalOpen(false);
      onOpenTimetable?.(meta);
    } catch (e: unknown) {
      messageApi.error(`Failed to create: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleOpen(): Promise<void> {
    try {
      const filePath = await openDialog({
        title: "Open Timetable JSON",
        filters: [{ name: "JSON", extensions: ["json"] }],
        multiple: false,
        directory: false,
      });
      if (!filePath || typeof filePath !== "string") return;

      const content = await invoke<string>("read_text_file", { path: filePath });
      const entries = JSON.parse(content) as unknown[];
      if (!Array.isArray(entries)) throw new Error("Invalid timetable JSON");

      const fileName = filePath.split(/[\\\/]/).pop()?.replace(/\.json$/i, "") ?? "Imported";
      const db = await Database.load("sqlite:timetable.db");
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await db.execute(
        "INSERT INTO timetables (id, name, entries_json, entry_count, created_at, updated_at, hidden_days) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [id, fileName, JSON.stringify(entries), entries.length, now, now, "[\"Sun\"]"],
      );
      const meta: TimetableMeta = { id, name: fileName, entryCount: entries.length, createdAt: now, updatedAt: now, hiddenDays: ["Sun"] };
      onOpenTimetable?.(meta);
    } catch (e: unknown) {
      messageApi.error(`Open failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function handleWindowControl(action: "minimize" | "maximize" | "close"): Promise<void> {
    const win = getCurrentWindow();
    if (action === "minimize") await win.minimize();
    else if (action === "maximize") {
      const isMax = await win.isMaximized();
      if (isMax) await win.unmaximize();
      else await win.maximize();
    } else {
      await win.close();
    }
  }

  // Render a menu label with an optional right-aligned shortcut hint
  function label(text: string, shortcut?: string): React.ReactNode {
    return (
      <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 32 }}>
        <span>{text}</span>
        {shortcut && (
          <span style={{ fontSize: 11, color: "rgba(0,0,0,0.38)", letterSpacing: 0.3 }}>{shortcut}</span>
        )}
      </span>
    );
  }

  const fileMenuItems: MenuProps["items"] = [
    { key: "new",       label: label("New",          "Ctrl+N"), icon: <PlusOutlined />,       onClick: () => { setNewName(""); setNewModalOpen(true); } },
    { key: "open",      label: label("Open",         "Ctrl+O"), icon: <FolderOpenOutlined />, onClick: () => { void handleOpen(); } },
    { type: "divider" },
    { key: "close",     label: label("Close",        "Ctrl+Q"), icon: <CloseOutlined />,      disabled: !isTimetable, onClick: onCloseTimetable },
    { key: "save",      label: label("Save",         "Ctrl+S"), icon: <SaveOutlined />,       disabled: !isTimetable, onClick: onSave },
    { key: "save-as",   label: label("Save As…", "Ctrl+Shift+S"), icon: <DownloadOutlined />,   disabled: !isTimetable, onClick: onSaveAs },
    { key: "import-merge", label: label("Import & Merge JSON…"), icon: <ImportOutlined />,       disabled: !isTimetable, onClick: onImportMerge },
    { type: "divider" },
    { key: "undo",      label: label("Undo",         "Ctrl+Z"), icon: <UndoOutlined />,       disabled: !canUndo, onClick: onUndo },
    { key: "redo",      label: label("Redo",         "Ctrl+Shift+Z"), icon: <RedoOutlined />, disabled: !canRedo, onClick: onRedo },
    { type: "divider" },
    { key: "prefs",     label: label("Preferences"),            icon: <SettingOutlined />,    onClick: onOpenPreferences },
  ];

  const winBtnStyle: React.CSSProperties = {
    width: 38,
    height: 32,
    background: "transparent",
    border: "none",
    color: "#8BA8D4",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    transition: "background 0.15s, color 0.15s",
    flexShrink: 0,
  };

  return (
    <>
      {contextHolder}

      <div
        data-tauri-drag-region
        style={{
          height: 32,
          background: "#1E3560",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          userSelect: "none",
          flexShrink: 0,
          cursor: "default",
          boxShadow: "0 1px 6px rgba(0,0,0,0.3)",
        }}
      >
        {/* Left: File menu + breadcrumb */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div onMouseDown={(e) => e.stopPropagation()}>
            <Dropdown menu={{ items: fileMenuItems }} trigger={["click"]} placement="bottomLeft">
              <button
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#C8D8F0",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  padding: "0 12px",
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.1)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <FileOutlined style={{ fontSize: 11 }} /> File
              </button>
            </Dropdown>
          </div>

          {/* Breadcrumb — pointer-events none so drag falls through to bar background */}
          <div style={{ paddingLeft: 8, display: "flex", alignItems: "center", gap: 5, pointerEvents: "none" }}>
            <span style={{ color: "#8BA8D4", fontSize: 12, fontWeight: 600 }}>Timetable</span>
            {timetableName && (
              <>
                <span style={{ color: "#4A6A9A", fontSize: 12 }}>›</span>
                <span style={{ color: "#D0E0F5", fontSize: 12, fontWeight: 500 }}>{timetableName}</span>
              </>
            )}
          </div>
        </div>

        {/* Right: window controls */}
        <div style={{ display: "flex", alignItems: "center" }} onMouseDown={(e) => e.stopPropagation()}>
          {(["minimize", "maximize", "close"] as const).map((action) => (
            <button
              key={action}
              onClick={() => void handleWindowControl(action)}
              aria-label={action}
              style={winBtnStyle}
              onMouseEnter={(e) => {
                const btn = e.currentTarget as HTMLButtonElement;
                btn.style.background = action === "close" ? "#C42B1C" : "rgba(255,255,255,0.1)";
                btn.style.color = "#FFFFFF";
              }}
              onMouseLeave={(e) => {
                const btn = e.currentTarget as HTMLButtonElement;
                btn.style.background = "transparent";
                btn.style.color = "#8BA8D4";
              }}
            >
              {action === "minimize" && <MinusOutlined />}
              {action === "maximize" && <BorderOutlined />}
              {action === "close"    && <CloseOutlined style={{ fontSize: 11 }} />}
            </button>
          ))}
        </div>
      </div>

      {/* New Timetable modal */}
      <Modal
        title="New Timetable"
        open={newModalOpen}
        onOk={handleCreateTimetable}
        onCancel={() => setNewModalOpen(false)}
        okText="Create"
        okButtonProps={{ loading: creating, disabled: !newName.trim() }}
        destroyOnClose
      >
        <div style={{ paddingTop: 8 }}>
          <Input
            id="titlebar-new-timetable-name"
            placeholder="Timetable name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onPressEnter={handleCreateTimetable}
            maxLength={80}
            autoFocus
          />
        </div>
      </Modal>
    </>
  );
}
