use axum::{
    extract::{Path, State, WebSocketUpgrade},
    response::IntoResponse,
};
use axum::extract::ws::{Message, WebSocket};
use tokio::sync::broadcast;
use futures::{StreamExt, SinkExt};
use std::sync::Arc;
use crate::state::AppState;

/// Handle WebSocket connections at /ws/:lobby_id
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Path(lobby_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state, lobby_id))
}

async fn handle_socket(stream: WebSocket, state: Arc<AppState>, lobby_id: String) {
    // Ensure a broadcast channel exists for the lobby
    let tx = {
        let mut lobbies = state.lobbies.lock().unwrap();
        lobbies
            .entry(lobby_id.clone())
            .or_insert_with(|| broadcast::channel::<String>(64).0.clone())
            .clone()
    };

    let mut rx = tx.subscribe();
    let (mut sender, mut receiver) = stream.split();

    // Task 1: receive messages from client then broadcast to lobby
    let tx_clone = tx.clone();
    let lobby_clone = lobby_id.clone();
    tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let Message::Text(text) = msg {
                if tx_clone.send(text.clone()).is_err() {
                    eprintln!("No active listeners in lobby {lobby_clone}");
                }
            }
        }
    });

    // Task 2: receive broadcasts then send to client
    while let Ok(msg) = rx.recv().await {
        if sender.send(Message::Text(msg)).await.is_err() {
            break;
        }
    }
}
