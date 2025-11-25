use crate::{database, state::AppState};
use axum::{
    Json, extract::{Path, State}, http::StatusCode
};
use tokio::sync::oneshot;
use std::sync::Arc;
    
pub async fn get_card_by_exact_name(
    Path((card_name, card_set)): Path<(String, String)>,
    State(state): State<Arc<AppState>>,
) -> Result<(StatusCode, Json<serde_json::Value>), (StatusCode, Json<String>)> {
    println!(
        "Queued exact name lookup for card: {} from set: {}",
        card_name, card_set
    );

    if database::check_card_exists_by_name(&card_name, &card_set, &state.database).await {
        println!("Card found in database: {}", card_name);
        let card_id = database::get_card_id_from_name(&state.database, &card_name).await;

        let card = database::get_card_by_id(&state.database, &card_id).await;

        return Ok((StatusCode::OK, Json(serde_json::to_value(card).unwrap())));
    }

    // Add task to queue
    let fetch_queue = &state.fetch_queue;

    let (tx, rx) = oneshot::channel::<std::result::Result<serde_json::Value, anyhow::Error>>();

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

    let result = rx.await;

    match result {
        Ok(Ok(card)) => {
            println!("Successfully fetched card from queue: {} from set: {}", card_name, card_set);
            return Ok((StatusCode::OK, Json(card)));
        }
        Ok(Err(e)) => {
            eprintln!("Error fetching card: {}", e);
            return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(format!("Error fetching card: {}", e))));
        }
        Err(e) => {
            eprintln!("Error receiving from queue: {}", e);
            return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(format!("Error receiving from queue: {}", e))));
        }
    }
}
