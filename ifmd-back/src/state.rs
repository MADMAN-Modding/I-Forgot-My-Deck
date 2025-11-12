use std::{collections::HashMap, sync::Mutex};

use tokio::sync::broadcast;

use crate::queue::QueueManager;

pub struct AppState {
    pub fetch_queue: QueueManager,
    /// Active WebSocket lobbies
    pub lobbies: Mutex<HashMap<String, broadcast::Sender<String>>>,
    pub database: sqlx::Pool<sqlx::Sqlite>,
}

impl AppState {
    pub fn new(database: sqlx::Pool<sqlx::Sqlite>) -> Self {
        Self { 
            fetch_queue: QueueManager::new(),
            lobbies: Mutex::new(HashMap::new()),
            database
        }
    }
}