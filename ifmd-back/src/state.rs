use std::{
    collections::{HashMap, HashSet},
    sync::Mutex,
    time::{Duration, Instant},
};

use serde_json::Value;
use tokio::sync::broadcast;

use crate::{account::email::EmailConfig, json_handler::get_email_config, queue::QueueManager};

pub const GAME_STATE_RETENTION: Duration = Duration::from_secs(20 * 60);

#[derive(Clone)]
pub struct CachedGameState {
    pub payload: Value,
    pub disconnected_at: Option<Instant>,
}

impl CachedGameState {
    pub fn new(payload: Value) -> Self {
        Self {
            payload,
            disconnected_at: None,
        }
    }

    pub fn mark_disconnected(&mut self) {
        self.disconnected_at = Some(Instant::now());
    }

    pub fn mark_connected(&mut self) {
        self.disconnected_at = None;
    }

    pub fn is_expired(&self, now: Instant) -> bool {
        self.disconnected_at
            .is_some_and(|disconnected_at| now.duration_since(disconnected_at) >= GAME_STATE_RETENTION)
    }
}

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
    pub game_states: Mutex<HashMap<String, HashMap<String, CachedGameState>>>,
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

    pub fn prune_expired_game_states(&self) {
        let now = Instant::now();
        let mut game_states = self.game_states.lock().unwrap();

        game_states.retain(|_, player_states| {
            player_states.retain(|_, cached_state| !cached_state.is_expired(now));
            !player_states.is_empty()
        });
    }
}