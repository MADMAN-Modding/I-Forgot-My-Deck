use std::{collections::{HashMap, VecDeque}, sync::Mutex};

use tokio::sync::broadcast;

pub struct AppState {
    pub fetch_queue: Mutex<VecDeque<String>>,
    /// Active WebSocket lobbies
    pub lobbies: Mutex<HashMap<String, broadcast::Sender<String>>>,
    pub database: sqlx::Pool<sqlx::Sqlite>,
}

impl AppState {
    pub fn new(database: sqlx::Pool<sqlx::Sqlite>) -> Self {
        Self { 
            fetch_queue: Mutex::new(VecDeque::new()),
            lobbies: Mutex::new(HashMap::new()),
            database
        }
    }
}