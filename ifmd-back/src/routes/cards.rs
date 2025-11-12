use crate::{cache, database, state::AppState};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
};
use std::sync::Arc;

pub async fn get_card_by_id(
    Path(card_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    // Add task to queue
    let fetch_queue = &state.fetch_queue;
    fetch_queue
        .push_back(crate::queue::QueueTask {
            queue_type: crate::queue::QueueType::ArtIDLookup,
            identifier: card_id.clone(),
            set: "".to_string(),
        })
        .await;

    (StatusCode::OK, format!("Requested card ID: {}", card_id))
}

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

        let mut card = database::get_card_by_id(&state.database, &card_id).await;

        card.card_url = cache::build_path(&card.card_id).await.unwrap_or_default();

        return (StatusCode::OK, format!("Card found in database: {}", card));
    }

    // Add task to queue
    let fetch_queue = &state.fetch_queue;

    fetch_queue
        .push_back(crate::queue::QueueTask {
            queue_type: crate::queue::QueueType::ArtNameLookup,
            identifier: card_name.clone(),
            set: card_set.clone(),
        })
        .await;

    (
        StatusCode::OK,
        format!("Requested card name: {} Set: {}", card_name, card_set),
    )
}
