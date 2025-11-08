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
        Ok(path) => (StatusCode::OK, path),
        Err(err) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Error: {err}")),
    }
}
