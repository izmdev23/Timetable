use std::sync::Arc;
use tauri_plugin_sql::{Migration, MigrationKind};

mod collab_server;
mod discovery;

const MIGRATION_V1: Migration = Migration {
    version: 1,
    description: "create_timetables_table",
    sql: "CREATE TABLE IF NOT EXISTS timetables (
        id           TEXT PRIMARY KEY,
        name         TEXT NOT NULL,
        entries_json TEXT NOT NULL DEFAULT '[]',
        entry_count  INTEGER NOT NULL DEFAULT 0,
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL
    );",
    kind: MigrationKind::Up,
};

const MIGRATION_V2: Migration = Migration {
    version: 2,
    description: "add_hidden_days",
    sql: "ALTER TABLE timetables ADD COLUMN hidden_days TEXT NOT NULL DEFAULT '[]';",
    kind: MigrationKind::Up,
};

const MIGRATION_V3: Migration = Migration {
    version: 3,
    description: "add_file_path",
    sql: "ALTER TABLE timetables ADD COLUMN file_path TEXT;",
    kind: MigrationKind::Up,
};

const MIGRATION_V4: Migration = Migration {
    version: 4,
    description: "add_theme",
    sql: "ALTER TABLE timetables ADD COLUMN theme TEXT DEFAULT 'blue';",
    kind: MigrationKind::Up,
};

const MIGRATION_V5: Migration = Migration {
    version: 5,
    description: "add_banded_rows",
    sql: "ALTER TABLE timetables ADD COLUMN banded_rows INTEGER DEFAULT 1;",
    kind: MigrationKind::Up,
};

const MIGRATION_V6: Migration = Migration {
    version: 6,
    description: "create_dynamic_data_table",
    sql: "CREATE TABLE IF NOT EXISTS dynamic_data (
        id          TEXT PRIMARY KEY,
        data_type   TEXT NOT NULL,
        value       TEXT NOT NULL,
        display_as  TEXT NOT NULL
    );",
    kind: MigrationKind::Up,
};

const MIGRATION_V7: Migration = Migration {
    version: 7,
    description: "add_timetable_id_to_dynamic_data",
    sql: "ALTER TABLE dynamic_data ADD COLUMN timetable_id TEXT;",
    kind: MigrationKind::Up,
};

const MIGRATION_V8: Migration = Migration {
    version: 8,
    description: "create_commit_history_table",
    sql: "CREATE TABLE IF NOT EXISTS commit_history (
        id              TEXT PRIMARY KEY,
        timetable_id    TEXT NOT NULL,
        action_type     TEXT NOT NULL,
        action_json     TEXT NOT NULL,
        author          TEXT NOT NULL,
        author_id       TEXT NOT NULL,
        timestamp       TEXT NOT NULL,
        description     TEXT NOT NULL,
        is_undo         INTEGER NOT NULL DEFAULT 0,
        undone_commit_id TEXT
    );",
    kind: MigrationKind::Up,
};

const MIGRATION_V9: Migration = Migration {
    version: 9,
    description: "create_locks_table",
    sql: "CREATE TABLE IF NOT EXISTS locks (
        item_id     TEXT PRIMARY KEY,
        client_id   TEXT NOT NULL,
        user_name   TEXT NOT NULL,
        acquired_at TEXT NOT NULL
    );",
    kind: MigrationKind::Up,
};

#[tauri::command]
async fn save_file_bytes(path: String, bytes: Vec<u8>) -> Result<(), String> {
    tokio::fs::write(&path, bytes).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    tokio::fs::read(&path).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn read_text_file(path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&path).await.map_err(|e| e.to_string())
}

#[tauri::command]
fn file_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

#[tauri::command]
fn resolve_default_path(app: tauri::AppHandle, filename: String) -> Result<String, String> {
    use tauri::Manager;
    let doc_dir = app.path().document_dir().map_err(|e| e.to_string())?;
    let full_path = doc_dir.join(filename);
    Ok(full_path.to_string_lossy().to_string())
}

#[tauri::command]
fn get_opened_file() -> Option<String> {
    let args: Vec<String> = std::env::args().collect();
    for arg in args.iter().skip(1) {
        if arg.to_lowercase().ends_with(".ttcl") {
            return Some(arg.clone());
        }
        if let Some(value) = arg.strip_prefix("--file=") {
            return Some(value.to_string());
        }
    }
    None
}

#[tauri::command]
async fn start_collab_server(
    state: tauri::State<'_, Arc<collab_server::CollabServerState>>,
    discovery: tauri::State<'_, discovery::DiscoveryState>,
    port: u16,
    hostname: String,
) -> Result<(), String> {
    state.start(port).await?;
    let ips = get_local_ips_inner();
    discovery.start_host_advertisement(&hostname, port, &ips)?;
    Ok(())
}

#[tauri::command]
async fn stop_collab_server(
    state: tauri::State<'_, Arc<collab_server::CollabServerState>>,
    discovery: tauri::State<'_, discovery::DiscoveryState>,
) -> Result<(), String> {
    discovery.stop_host_advertisement();
    state.stop().await
}

#[tauri::command]
async fn get_collab_status(
    state: tauri::State<'_, Arc<collab_server::CollabServerState>>,
) -> Result<collab_server::CollabStatus, String> {
    Ok(state.get_status().await)
}

#[tauri::command]
fn get_local_ips() -> Vec<String> {
    get_local_ips_inner()
}

fn get_local_ips_inner() -> Vec<String> {
    local_ip_address::list_afinet_netifas()
        .unwrap_or_default()
        .into_iter()
        .map(|(name, ip)| format!("{} ({})", ip.to_string(), name))
        .filter(|s| !s.starts_with("127.") && !s.starts_with("::1"))
        .collect()
}

#[tauri::command]
fn start_collab_discovery(
    discovery: tauri::State<'_, discovery::DiscoveryState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    discovery.start_browsing(app)
}

#[tauri::command]
fn stop_collab_discovery(
    discovery: tauri::State<'_, discovery::DiscoveryState>,
) -> Result<(), String> {
    discovery.stop_browsing();
    Ok(())
}

#[tauri::command]
fn get_hostname() -> String {
    std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "Unknown".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let collab_state = Arc::new(collab_server::CollabServerState::new());
    let discovery_state = discovery::DiscoveryState::new();

    tauri::Builder::default()
        .manage(collab_state)
        .manage(discovery_state)
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:timetable.db",
                    vec![
                        MIGRATION_V1,
                        MIGRATION_V2,
                        MIGRATION_V3,
                        MIGRATION_V4,
                        MIGRATION_V5,
                        MIGRATION_V6,
                        MIGRATION_V7,
                        MIGRATION_V8,
                        MIGRATION_V9,
                    ],
                )
                .build(),
        )
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_file_bytes,
            read_text_file,
            read_file_bytes,
            file_exists,
            resolve_default_path,
            get_opened_file,
            start_collab_server,
            stop_collab_server,
            get_collab_status,
            get_local_ips,
            get_hostname,
            start_collab_discovery,
            stop_collab_discovery,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
