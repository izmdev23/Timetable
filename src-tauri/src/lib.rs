use tauri_plugin_sql::{Migration, MigrationKind};

/// Schema migration: creates the timetables table on first run.
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

#[tauri::command]
async fn save_file_bytes(path: String, bytes: Vec<u8>) -> Result<(), String> {
    tokio::fs::write(&path, bytes).await.map_err(|e| e.to_string())
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
            file_exists,
            resolve_default_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
