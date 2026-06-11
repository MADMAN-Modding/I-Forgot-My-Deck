use axum::{
    extract::{Path, State, WebSocketUpgrade},
    response::IntoResponse,
};
use axum::extract::ws::{Message, WebSocket};
use tokio::sync::broadcast;
use futures::{StreamExt, SinkExt};
use std::sync::Arc;
use crate::{lobby::client::{Client, ClientData, PlayerData, TableData}, state::AppState};

/// Handle WebSocket connections
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Path((lobby_id, client_type)): Path<(String, String)>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| async move {
        match client_type.to_uppercase().as_str() {
            "MAT" => handle_socket(socket, state, lobby_id, Client::<PlayerData>::from_str(&client_type)).await,
            "TABLE" => handle_socket(socket, state, lobby_id, Client::<TableData>::from_str(&client_type)).await,
            _ => (),
        }
    })
}

async fn handle_socket<T>(stream: WebSocket, state: Arc<AppState>, lobby_id: String, client_struct: Client<T>) where T: ClientData {
    println!("Client for lobby {} connected as {}.", lobby_id, client_struct.client_type.to_string());

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

    sender.send(Message::Text(format!("{}", client_struct.client_type.to_string()).into())).await.unwrap();

    // Task 1: receive messages from client then broadcast to lobby
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

    // Task 2: receive broadcasts then send to client
    while let Ok(msg) = rx.recv().await {
        if sender.send(Message::Text(msg.into())).await.is_err() {
            break;
        }
    }
}