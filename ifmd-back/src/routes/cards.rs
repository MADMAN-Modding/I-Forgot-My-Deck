use axum::{
    extract::{Path, State},
    response::IntoResponse,
    http::StatusCode,
};
use std::sync::Arc;
use crate::{cache, state::AppState};

pub async fn get_card_by_id(
    Path(card_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    match cache::get_or_fetch_card_by_id(&card_id, state).await {
        Ok(card) => (StatusCode::OK, card.card_id),
        Err(err) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Error: {err}")),
    }
}

pub async fn get_card_by_exact_name (
    Path(card_name): Path<String>,
    State(state): State<Arc<AppState>>
) -> impl IntoResponse {
    match cache::get_or_fetch_card_by_exact_name(&card_name, state).await {
        Ok(card) => (StatusCode::OK, format!("{}", card)),
        Err(err) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Error: {err}"))
    }
}