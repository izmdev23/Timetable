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
  ExportOutlined,
} from "@ant-design/icons";
import type { CollabUser, ConnectionQuality, PermissionSet } from "../types";
import { CollabUserMenu } from "./CollabUserMenu";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import Database from "@tauri-apps/plugin-sql";
import type { TimetableMeta } from "../types";

interface TitleBarProps {
  /** Current page — controls which File items are enabled */
  page: "home" | "timetable" | "preferences";
  /** Name of the open timetable (timetable page only) */
  timetableName?: string;
  /** Called to open a timetable for editing */
  onOpenTimetable?: (meta: TimetableMeta) => void;
  /** Called to open a .ttcl collection file */
  onOpenCollection?: () => void;
  /** Called to close the open timetable (go back to home) */
  onCloseTimetable?: () => void;
  /** Called to trigger File > Save As (XLSX export) */
  onSaveAs?: () => void;
  /** Called to trigger File > Save (JSON export) */
  onSave?: () => void;
  /** Called to trigger Export JSON Data */
  onExportJson?: () => void;
  /** Called to trigger Export Room Excel */
  onExportExcelRoom?: () => void;
  /** Called to trigger Export Word (Docx) */
  onExportDocx?: () => void;
  /** Called to trigger Import and Merge */
  onImportMerge?: () => void;
  /** Called to trigger Import Blueprints from Excel */
  onImportExcel?: () => void;
  /** Called to open the Preferences page */
  onOpenPreferences?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;

  // Collaboration
  collabConnected?: boolean;
  collabUsers?: CollabUser[];
  collabQuality?: ConnectionQuality;
  collabLatency?: number;
  collabMyName?: string;
  collabMyColor?: string;
  collabSessionInfo?: { ip: string; port: number } | null;
  collabShareHistory?: boolean;
  collabIsHost?: boolean;
  onCollabSetPermission?: (clientId: string, perms: PermissionSet) => void;
  onCollabLeaveSession?: () => void;
  onCollabShareHistoryChange?: (v: boolean) => void;
}

/** Custom frameless title bar with a File dropdown menu and window controls. */
export function TitleBar({
  page,
  timetableName,
  onOpenTimetable,
  onCloseTimetable,
  onSaveAs,
  onSave,
  onExportJson,
  onExportExcelRoom,
  onExportDocx,
  onImportMerge,
  onImportExcel,
  onOpenPreferences,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,

  collabConnected,
  collabUsers,
  collabQuality,
  collabLatency,
  collabMyName,
  collabMyColor,
  collabSessionInfo,
  collabShareHistory,
  collabIsHost,
  onCollabSetPermission,
  onCollabLeaveSession,
  onCollabShareHistoryChange,
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
        title: "Open Timetable Collection",
        filters: [{ name: "Timetable Collection", extensions: ["ttcl"] }],
        multiple: false,
        directory: false,
      });
      if (!filePath || typeof filePath !== "string") return;
      // The parent (App.tsx) handles the actual open via collection context
      window.dispatchEvent(new CustomEvent('titlebar:open-collection', { detail: { path: filePath } }));
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
      window.dispatchEvent(new CustomEvent('titlebar:before-close'));
    }
  }

  useEffect(() => {
    const handleConfirmClose = () => {
      const win = getCurrentWindow();
      win.close();
    };
    window.addEventListener('titlebar:confirm-close', handleConfirmClose);
    return () => window.removeEventListener('titlebar:confirm-close', handleConfirmClose);
  }, []);

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
    {
      key: "import", label: label("Import"), icon: <ImportOutlined />, disabled: !isTimetable,
      children: [
        { key: "import-json", label: label("Import Collection Data (JSON)"), onClick: onImportMerge },
        { key: "import-excel", label: label("Import Blueprints from Excel"), onClick: onImportExcel },
      ],
    },
    {
      key: "export", label: label("Export"), icon: <ExportOutlined />, disabled: !isTimetable,
      children: [
        { key: "export-json", label: label("Export Collection Data (JSON)"), onClick: onExportJson },
        { key: "export-excel-room", label: label("Export Room Timetable (Excel)"), onClick: onExportExcelRoom },
        { key: "export-docx", label: label("Export Timetable (Word/Docx)"), onClick: onExportDocx },
      ],
    },
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
    color: "#7A8BA8",
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
          background: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          userSelect: "none",
          flexShrink: 0,
          cursor: "default",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
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
                  color: "#1A2640",
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
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.05)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <FileOutlined style={{ fontSize: 11 }} /> File
              </button>
            </Dropdown>
          </div>

          {/* Breadcrumb — pointer-events none so drag falls through to bar background */}
          <div style={{ paddingLeft: 8, display: "flex", alignItems: "center", gap: 5, pointerEvents: "none" }}>
            <span style={{ color: "#7A8BA8", fontSize: 12, fontWeight: 600 }}>Timetable</span>
            {timetableName && (
              <>
                <span style={{ color: "#D0D7E3", fontSize: 12 }}>›</span>
                <span style={{ color: "#1A2640", fontSize: 12, fontWeight: 500 }}>{timetableName}</span>
              </>
            )}
          </div>
        </div>

        {/* Right: collab user menu + window controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }} onMouseDown={(e) => e.stopPropagation()}>
          {collabConnected && (
            <CollabUserMenu
              isConnected={collabConnected}
              connectedUsers={collabUsers ?? []}
              myUserName={collabMyName ?? ''}
              myColor={collabMyColor ?? '#61AFEF'}
              connectionQuality={collabQuality ?? 'disconnected'}
              latency={collabLatency ?? 0}
              sessionInfo={collabSessionInfo ?? null}
              isHost={collabIsHost ?? false}
              shareFullHistory={collabShareHistory ?? false}
              onSetPermission={onCollabSetPermission ?? (() => {})}
              onLeaveSession={onCollabLeaveSession ?? (() => {})}
              onShareFullHistoryChange={onCollabShareHistoryChange ?? (() => {})}
            />
          )}
          {(["minimize", "maximize", "close"] as const).map((action) => (
            <button
              key={action}
              onClick={() => void handleWindowControl(action)}
              aria-label={action}
              style={winBtnStyle}
              onMouseEnter={(e) => {
                const btn = e.currentTarget as HTMLButtonElement;
                btn.style.background = action === "close" ? "#C42B1C" : "rgba(0,0,0,0.06)";
                btn.style.color = action === "close" ? "#FFFFFF" : "#1A2640";
              }}
              onMouseLeave={(e) => {
                const btn = e.currentTarget as HTMLButtonElement;
                btn.style.background = "transparent";
                btn.style.color = "#7A8BA8";
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
