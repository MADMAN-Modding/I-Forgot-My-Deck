use std::{collections::HashMap, sync::Mutex};

use tokio::sync::broadcast;

use crate::{account::email::EmailConfig, json_handler::get_email_config, queue::QueueManager};

pub struct AppState {
    pub fetch_queue: QueueManager,
    /// Active WebSocket lobbies
    pub lobbies: Mutex<HashMap<String, broadcast::Sender<String>>>,
    pub database: sqlx::Pool<sqlx::Sqlite>,
    pub email_config: EmailConfig,
}

impl AppState {
    pub fn new(database: sqlx::Pool<sqlx::Sqlite>) -> Self {
        let email_config = get_email_config();

        Self { 
            fetch_queue: QueueManager::new(),
            lobbies: Mutex::new(HashMap::new()),
            database,
            email_config
        }
    }
}