use crate::{database, state::AppState};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
};
use tokio::sync::oneshot;
use std::sync::Arc;
    
pub async fn get_card_by_exact_name(
    Path((card_name, card_set)): Path<(String, String)>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    println!(
        "Queued exact name lookup for card: {} from set: {}",
        card_name, card_set
    );

    if database::check_card_exists_by_name(&card_name, &card_set, &state.database).await {
        println!("Card found in database: {}", card_name);
        let card_id = database::get_card_id_from_name(&state.database, &card_name).await;

        let card = database::get_card_by_id(&state.database, &card_id).await;

        return (StatusCode::OK, format!("{}", card.card_url));
    }

    // Add task to queue
    let fetch_queue = &state.fetch_queue;

    let (tx, rx) = oneshot::channel::<std::result::Result<String, anyhow::Error>>();

    fetch_queue
        .push_back(crate::queue::QueueTask {
            queue_type: crate::queue::QueueType::ArtNameLookup,
            identifier: card_name.clone(),
            set: card_set.clone(),
            response: tx,
        })
        .await;

    // Wait for the result
    println!("Waiting for queue result for card: {} from set: {}", card_name, card_set);

    let mut result = rx.await;

    println!("{}", result.as_mut().unwrap().as_ref().map_err(|e| format!("Oneshot receive error: {}", e)).unwrap_or(&"No result".to_string()));

    match result {
        Ok(Ok(card_url)) => {
            println!("Successfully fetched card from queue: {} from set: {}", card_name, card_set);
            return (StatusCode::OK, format!("{}", card_url));
        }
        Ok(Err(e)) => {
            eprintln!("Error fetching card: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, format!("Error fetching card: {}", e));
        }
        Err(e) => {
            eprintln!("Error receiving from queue: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, format!("Error receiving from queue: {}", e));
        }
    }
}
