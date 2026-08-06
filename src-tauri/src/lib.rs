mod commands;
mod db;
mod export;
mod report;
mod xlsx;

use std::path::PathBuf;
use std::sync::Mutex;
use tauri::path::BaseDirectory;
use tauri::AppHandle;
use tauri::Manager;

pub struct AppState {
    pub db: Mutex<db::Db>,
}

const PRODUSE_FILE: &str = "Grupa corespunzatoare.xlsx";
const AGENTI_FILE: &str = "Raport agent.xlsx";

#[cfg(target_os = "macos")]
fn set_macos_dock_icon() {
    use objc2::{AllocAnyThread, MainThreadMarker};
    use objc2_app_kit::{NSApplication, NSImage};
    use objc2_foundation::NSData;

    let marker = unsafe { MainThreadMarker::new_unchecked() };
    let application = NSApplication::sharedApplication(marker);
    let data = NSData::with_bytes(include_bytes!("../icons/icon.png"));

    if let Some(icon) = NSImage::initWithData(NSImage::alloc(), &data) {
        unsafe { application.setApplicationIconImage(Some(&icon)) };
    }
}

fn resolve_resource(app: &AppHandle, rel: &str) -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(p) = app
        .path()
        .resolve(format!("resources/{rel}"), BaseDirectory::Resource)
    {
        candidates.push(p);
    }
    if let Ok(rd) = app.path().resource_dir() {
        candidates.push(rd.join("resources").join(rel));
        candidates.push(rd.join(rel));
    }
    candidates.push(PathBuf::from("resources").join(rel));
    candidates.push(PathBuf::from("src-tauri/resources").join(rel));
    candidates.push(PathBuf::from("../src-tauri/resources").join(rel));

    candidates.into_iter().find(|p| p.exists())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            set_macos_dock_icon();

            let app_dir = app
                .path()
                .app_data_dir()
                .expect("nu pot rezolva app data dir");
            std::fs::create_dir_all(&app_dir).ok();
            let db_path = app_dir.join("reports.db");

            let produse_seed = resolve_resource(app.handle(), PRODUSE_FILE);
            let agenti_seed = resolve_resource(app.handle(), AGENTI_FILE);

            let db = db::init(&db_path, produse_seed, agenti_seed).expect("init bază de date");

            app.manage(AppState {
                db: Mutex::new(db),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_stats,
            commands::get_produse,
            commands::get_produs,
            commands::get_grupe,
            commands::get_produse_coloana,
            commands::get_agenti,
            commands::get_agenti_distinct,
            commands::get_agenti_coloana,
            commands::import_produse,
            commands::import_agenti,
            commands::export_produse,
            commands::export_agenti,
            commands::adauga_produs,
            commands::adauga_produse_lipsa,
            commands::filtreaza_produse_lipsa,
            commands::get_produse_lipsa,
            commands::adauga_agent,
            commands::update_produs,
            commands::delete_produs,
            commands::delete_all_produse,
            commands::delete_produse,
            commands::update_agent,
            commands::delete_agent,
            commands::delete_all_agenti,
            commands::delete_agenti,
            commands::genereaza_raport,
            commands::export_raport_data,
            commands::salveaza_raport,
            commands::lista_rapoarte,
            commands::incarca_raport,
            commands::sterge_raport,
        ])
        .run(tauri::generate_context!())
        .expect("eroare la pornirea aplicației");
}
