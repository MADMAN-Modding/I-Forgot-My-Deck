use std::{collections::{HashMap, HashSet}, sync::Mutex};

use serde_json::Value;
use tokio::sync::broadcast;

use crate::{account::email::EmailConfig, json_handler::get_email_config, queue::QueueManager};

/// A player waiting in the lobby waiting room
pub struct WaitingPlayer {
    pub token: String,
    pub display_name: String,
}

/// Per-lobby state for the waiting room and game access control
pub struct LobbyState {
    /// Token of the player who created the lobby
    pub creator_token: String,
    /// Whether the game has been started by the creator
    pub started: bool,
    /// Tokens that are allowed to connect as MAT (set when game starts)
    pub allowed_tokens: HashSet<String>,
    /// Players currently in the waiting room
    pub waiting_players: Vec<WaitingPlayer>,
    /// Broadcast channel for waiting room messages
    pub waiting_tx: broadcast::Sender<String>,
    /// Number of TABLE (spectator) clients currently connected to this lobby
    pub table_count: usize,
}

pub struct AppState {
    pub fetch_queue: QueueManager,
    /// Active WebSocket game lobbies (broadcast channels for MAT/TABLE)
    pub lobbies: Mutex<HashMap<String, broadcast::Sender<String>>>,
    /// Waiting room state per lobby
    pub lobby_states: Mutex<HashMap<String, LobbyState>>,
    /// Saved game state per lobby per player token (for reconnection)
    pub game_states: Mutex<HashMap<String, HashMap<String, Value>>>,
    pub database: sqlx::Pool<sqlx::Sqlite>,
    pub email_config: EmailConfig,
}

impl AppState {
    pub fn new(database: sqlx::Pool<sqlx::Sqlite>) -> Self {
        let email_config = get_email_config();

        Self { 
            fetch_queue: QueueManager::new(),
            lobbies: Mutex::new(HashMap::new()),
            lobby_states: Mutex::new(HashMap::new()),
            game_states: Mutex::new(HashMap::new()),
            database,
            email_config,
        }
    }
}