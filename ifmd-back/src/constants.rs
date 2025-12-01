use std::fs::create_dir_all;

use directories::ProjectDirs;
use once_cell::sync::OnceCell;

static PROJ_DIRS: OnceCell<ProjectDirs> = OnceCell::new();

// Client
pub const LOOP_TIME_SECONDS: u64 = 120;

//Server
pub const DOWN_SAMPLE_POINTS: u16 = 40;
pub const OUTLIER_THRESHOLD: f64 = 0.5;
pub const DO_INTERPOLATION: bool = true;
pub const INTERPOLATION_STEPS: u16 = 64;

pub const BUFFER_SIZE: usize = 4096;


pub fn setup() {
    PROJ_DIRS
        .set(
            ProjectDirs::from("com", "MADMAN-Modding", "IFMD")
                .expect("Failed to create ProjectDirs"),
        )
        .unwrap();

    // Make the config directory
    let _ = create_dir_all(
        PROJ_DIRS
            .get()
            .expect("Failed to make config dir")
            .config_dir(),
    );

    let _ = create_dir_all(PROJ_DIRS.get().expect("Failed to make config dir").data_dir());

    // Make the data directory (will be used eventually to store the database, during testing I'm keeping it on the project root for ease of access, I could symlink it though...)
    let _ = create_dir_all(PROJ_DIRS.get().expect("Failed to make data dir").data_dir());
}

/// Returns the location of the config directory
pub fn get_config_dir() -> String {
    let proj_dir = PROJ_DIRS.get().expect("ProjectDirs is not initialized :(");

    proj_dir.config_dir();

    let config_dir = ProjectDirs::config_dir(&proj_dir).to_str().unwrap();

    config_dir.to_string()
}

/// Returns the path to client configuration JSON file
pub fn get_client_config_path() -> String {
    format!("{}/client-config.json", get_config_dir())
}

/// Returns the path to server configuration JSON file
pub fn get_server_config_path() -> String {
    format!("{}/server-config.json", get_config_dir())
}

pub fn get_email_config_path() -> String {
    format!("{}/email-config.json", get_config_dir())
}

pub fn get_data_dir() -> String {
    let proj_dir = PROJ_DIRS.get().expect("ProjectDirs is not initialized :(");

    proj_dir.data_dir();

    let data_dir = ProjectDirs::data_dir(&proj_dir).to_str().unwrap();

    data_dir.to_string()
} 

pub fn get_db_path() -> String {
    format!("{}/database.sqlite", get_data_dir())
}
