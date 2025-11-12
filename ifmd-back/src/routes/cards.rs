use axum::{
    extract::{Path, State},
    response::IntoResponse,
    http::StatusCode,
};
use std::sync::Arc;
use crate::state::AppState;

pub async fn get_card_by_id(
    Path(card_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    // Add task to queue
    let fetch_queue = &state.fetch_queue;
    fetch_queue.push_back(crate::queue::QueueTask {
        queue_type: crate::queue::QueueType::ArtIDLookup,
        identifier: card_id.clone(),
        set: "".to_string(),
    }).await;

    (StatusCode::OK, format!("Requested card ID: {}", card_id))
}

pub async fn get_card_by_exact_name (
    Path((card_name, card_set)): Path<(String, String)>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    println!("Queued exact name lookup for card: {} from set: {}", card_name, card_set);

    
    // Add task to queue
    let fetch_queue = &state.fetch_queue;
    
    fetch_queue.push_back(crate::queue::QueueTask {
        queue_type: crate::queue::QueueType::ArtNameLookup,
        identifier: card_name.clone(),
        set: card_set.clone(),
    }).await;

    (StatusCode::OK, format!("Requested card name: {} Set: {}", card_name, card_set))
}