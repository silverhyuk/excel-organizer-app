use std::fs;
use tauri::Manager;

const REPORT_CONFIG_FILE: &str = "report-categories.json";

#[tauri::command]
fn load_report_config(app: tauri::AppHandle) -> Result<Option<String>, String> {
  let config_dir = app.path().app_config_dir().map_err(|error| error.to_string())?;
  let config_path = config_dir.join(REPORT_CONFIG_FILE);
  if !config_path.exists() {
    return Ok(None);
  }
  fs::read_to_string(config_path)
    .map(Some)
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_report_config(app: tauri::AppHandle, config: String) -> Result<(), String> {
  serde_json::from_str::<serde_json::Value>(&config)
    .map_err(|error| format!("잘못된 설정 형식입니다: {error}"))?;
  let config_dir = app.path().app_config_dir().map_err(|error| error.to_string())?;
  fs::create_dir_all(&config_dir).map_err(|error| error.to_string())?;
  fs::write(config_dir.join(REPORT_CONFIG_FILE), config).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![load_report_config, save_report_config])
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
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
