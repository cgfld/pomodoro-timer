const SERVICE: &str = "app.tomodo.auth";

fn checked_key(key: &str) -> Result<(), String> {
    if key.starts_with("sb-") && key.len() < 200 {
        Ok(())
    } else {
        Err("Invalid account storage key".into())
    }
}

#[tauri::command]
fn auth_read(key: String) -> Result<Option<String>, String> {
    checked_key(&key)?;
    match security_framework::passwords::get_generic_password(SERVICE, &key) {
        Ok(bytes) => String::from_utf8(bytes).map(Some).map_err(|_| "Invalid saved session".into()),
        Err(error) if error.code() == -25300 => Ok(None),
        Err(_) => Err("Unable to read your session from Keychain".into()),
    }
}

#[tauri::command]
fn auth_write(key: String, value: String) -> Result<(), String> {
    checked_key(&key)?;
    security_framework::passwords::set_generic_password(SERVICE, &key, value.as_bytes())
        .map_err(|_| "Unable to save your session to Keychain".into())
}

#[tauri::command]
fn auth_remove(key: String) -> Result<(), String> {
    checked_key(&key)?;
    match security_framework::passwords::delete_generic_password(SERVICE, &key) {
        Ok(()) => Ok(()),
        Err(error) if error.code() == -25300 => Ok(()),
        Err(_) => Err("Unable to remove your session from Keychain".into()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![auth_read, auth_write, auth_remove])
        .run(tauri::generate_context!())
        .expect("Unable to launch Tomodo");
}
