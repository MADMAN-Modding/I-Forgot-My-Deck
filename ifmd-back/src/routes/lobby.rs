use axum::{
    Json,
    extract::{Path, State, WebSocketUpgrade},
    http::StatusCode,
    response::IntoResponse,
};
use axum::extract::ws::{Message, WebSocket};
use tokio::sync::broadcast;
use futures::{StreamExt, SinkExt};
use serde_json::json;
use std::{collections::HashSet, sync::Arc};
use crate::{
    database,
    lobby::client::{Client, ClientData, ClientType, PlayerData, TableData},
    state::{AppState, LobbyState, WaitingPlayer},
};

// ── Waiting room HTTP endpoint ─────────────────────────────────────────────

/// Register a new lobby.  Called by the creator before the waiting room WS connects.
pub async fn create_lobby(
    Path((lobby_id, token)): Path<(String, String)>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let account_id = match database::get_account_from_token(&state.database, token.clone()).await {
        Ok(id) => id,
        Err(_) => return (StatusCode::UNAUTHORIZED, Json(json!({"error": "invalid token"}))).into_response(),
    };
    match database::get_account(&state.database, &account_id).await {
        Ok(_) => {}
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "account not found"}))).into_response(),
    };

    let mut lobby_states = state.lobby_states.lock().unwrap();
    if lobby_states.contains_key(&lobby_id) {
        return (StatusCode::CONFLICT, Json(json!({"error": "lobby already exists"}))).into_response();
    }
    let (waiting_tx, _) = broadcast::channel::<String>(64);
    lobby_states.insert(lobby_id.clone(), LobbyState {
        creator_token: token,
        started: false,
        allowed_tokens: HashSet::new(),
        waiting_players: Vec::new(),
        waiting_tx,
    });

    (StatusCode::OK, Json(json!({"lobby_id": lobby_id}))).into_response()
}

// ── Waiting room WebSocket ─────────────────────────────────────────────────

pub async fn ws_waiting_handler(
    ws: WebSocketUpgrade,
    Path((lobby_id, token)): Path<(String, String)>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_waiting_socket(socket, state, lobby_id, token))
}

async fn handle_waiting_socket(stream: WebSocket, state: Arc<AppState>, lobby_id: String, token: String) {
    // Validate token
    let account_id = match database::get_account_from_token(&state.database, token.clone()).await {
        Ok(id) => id,
        Err(_) => return,
    };
    let display_name = match database::get_account(&state.database, &account_id).await {
        Ok(a) => a.display_name,
        Err(_) => return,
    };

    // Check lobby exists and hasn't started yet
    enum LobbyCheck {
        Ok { waiting_tx: broadcast::Sender<String>, is_creator: bool },
        Started,
        NotFound,
    }
    let check = {
        let ls = state.lobby_states.lock().unwrap();
        match ls.get(&lobby_id) {
            Some(l) if l.started => LobbyCheck::Started,
            Some(l) => LobbyCheck::Ok {
                waiting_tx: l.waiting_tx.clone(),
                is_creator: l.creator_token == token,
            },
            None => LobbyCheck::NotFound,
        }
        // MutexGuard dropped here
    };

    let (waiting_tx, is_creator) = match check {
        LobbyCheck::Ok { waiting_tx, is_creator } => (waiting_tx, is_creator),
        LobbyCheck::Started => {
            let (mut sender, _) = stream.split();
            let _ = sender.send(Message::Text(
                json!({"type": "rejected", "reason": "game_started"}).to_string().into()
            )).await;
            return;
        }
        LobbyCheck::NotFound => {
            let (mut sender, _) = stream.split();
            let _ = sender.send(Message::Text(
                json!({"type": "rejected", "reason": "lobby_not_found"}).to_string().into()
            )).await;
            return;
        }
    };

    // Add player to waiting list (dedup)
    {
        let mut ls = state.lobby_states.lock().unwrap();
        if let Some(lobby) = ls.get_mut(&lobby_id) {
            if !lobby.waiting_players.iter().any(|p| p.token == token) {
                lobby.waiting_players.push(WaitingPlayer {
                    token: token.clone(),
                    display_name: display_name.clone(),
                });
            }
        }
    }

    // Broadcast updated player list to everyone in waiting room
    let _ = waiting_tx.send(build_waiting_update(&state, &lobby_id));

    let mut rx = waiting_tx.subscribe();
    let (mut sender, mut receiver) = stream.split();

    // Send personalised welcome so the client knows if it is the creator
    let welcome = json!({"type": "welcome", "is_creator": is_creator}).to_string();
    if sender.send(Message::Text(welcome.into())).await.is_err() {
        return;
    }

    // Send the current player list directly to this client (the broadcast above was
    // sent before we subscribed, so this client would otherwise miss it)
    let initial_update = build_waiting_update(&state, &lobby_id);
    if sender.send(Message::Text(initial_update.into())).await.is_err() {
        return;
    }

    // Spawn: read messages from this client
    let tx_clone = waiting_tx.clone();
    let lobby_clone = lobby_id.clone();
    let token_clone = token.clone();
    let state_clone = state.clone();
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let Message::Text(text) = msg {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&text) {
                    if parsed["type"] == "start_game" {
                        let is_creator = {
                            let ls = state_clone.lobby_states.lock().unwrap();
                            ls.get(&lobby_clone).map(|l| l.creator_token == token_clone).unwrap_or(false)
                        };
                        if is_creator {
                            // Lock in the player list and mark the lobby started
                            {
                                let mut ls = state_clone.lobby_states.lock().unwrap();
                                if let Some(lobby) = ls.get_mut(&lobby_clone) {
                                    lobby.allowed_tokens = lobby.waiting_players.iter()
                                        .map(|p| p.token.clone())
                                        .collect();
                                    lobby.started = true;
                                }
                            }
                            let _ = tx_clone.send(json!({"type": "game_started"}).to_string());
                        }
                    }
                }
            }
        }
    });

    // Forward waiting-room broadcasts to this client
    while let Ok(msg) = rx.recv().await {
        if sender.send(Message::Text(msg.into())).await.is_err() {
            break;
        }
    }
    recv_task.abort();

    // Remove from waiting list if game hasn't started yet and rebroadcast
    {
        let mut ls = state.lobby_states.lock().unwrap();
        if let Some(lobby) = ls.get_mut(&lobby_id) {
            if !lobby.started {
                lobby.waiting_players.retain(|p| p.token != token);
                let players: Vec<serde_json::Value> = lobby.waiting_players.iter()
                    .map(|p| json!({"name": p.display_name}))
                    .collect();
                let msg = json!({"type": "waiting_update", "players": players}).to_string();
                let _ = lobby.waiting_tx.send(msg);
            }
        }
    }
}

fn build_waiting_update(state: &Arc<AppState>, lobby_id: &str) -> String {
    let ls = state.lobby_states.lock().unwrap();
    let players: Vec<serde_json::Value> = ls.get(lobby_id)
        .map(|l| l.waiting_players.iter().map(|p| json!({"name": p.display_name})).collect())
        .unwrap_or_default();
    json!({"type": "waiting_update", "players": players}).to_string()
}

// ── Game WebSocket ─────────────────────────────────────────────────────────

/// Unauthenticated handler (TABLE clients or lobbies created without the waiting room)
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Path((lobby_id, client_type)): Path<(String, String)>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| async move {
        match client_type.to_uppercase().as_str() {
            "MAT"   => handle_socket(socket, state, lobby_id, Client::<PlayerData>::from_str(&client_type), None).await,
            "TABLE" => handle_socket(socket, state, lobby_id, Client::<TableData>::from_str(&client_type), None).await,
            _ => (),
        }
    })
}

/// Authenticated handler (MAT clients that went through the waiting room)
pub async fn ws_handler_auth(
    ws: WebSocketUpgrade,
    Path((lobby_id, client_type, token)): Path<(String, String, String)>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| async move {
        match client_type.to_uppercase().as_str() {
            "MAT"   => handle_socket(socket, state, lobby_id, Client::<PlayerData>::from_str(&client_type), Some(token)).await,
            "TABLE" => handle_socket(socket, state, lobby_id, Client::<TableData>::from_str(&client_type), None).await,
            _ => (),
        }
    })
}

async fn handle_socket<T>(
    stream: WebSocket,
    state: Arc<AppState>,
    lobby_id: String,
    client_struct: Client<T>,
    token: Option<String>,
) where T: ClientData {
    println!("Client for lobby {} connected as {}.", lobby_id, client_struct.client_type.to_string());

    // MAT connections: reject if the lobby has started and this token wasn't in the waiting room
    if matches!(client_struct.client_type, ClientType::MAT) {
        let reject = {
            let ls = state.lobby_states.lock().unwrap();
            match ls.get(&lobby_id) {
                Some(lobby) if lobby.started => {
                    !token.as_ref().map(|t| lobby.allowed_tokens.contains(t)).unwrap_or(false)
                }
                _ => false,
            }
        };
        if reject {
            let (mut sender, _) = stream.split();
            let _ = sender.send(Message::Text(
                json!({"type": "rejected", "reason": "not_allowed"}).to_string().into()
            )).await;
            return;
        }
    }

    // Ensure a broadcast channel exists for this game lobby
    let tx = {
        let mut lobbies = state.lobbies.lock().unwrap();
        lobbies
            .entry(lobby_id.clone())
            .or_insert_with(|| broadcast::channel::<String>(64).0.clone())
            .clone()
    };

    let mut rx = tx.subscribe();
    let (mut sender, mut receiver) = stream.split();

    sender.send(Message::Text(client_struct.client_type.to_string().into())).await.unwrap();

    // Task 1: receive from client, broadcast to lobby
    let tx_clone = tx.clone();
    let lobby_clone = lobby_id.clone();
    tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let Message::Text(text) = msg {
                if tx_clone.send(text.to_string()).is_err() {
                    eprintln!("No active listeners in lobby {lobby_clone}");
                }
            }
        }
    });

    // Task 2: receive broadcasts, forward to client
    while let Ok(msg) = rx.recv().await {
        if sender.send(Message::Text(msg.into())).await.is_err() {
            break;
        }
    }
}