use std::sync::Arc;

use axum::{
    extract::{Path, State},
};
use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::{database, deck::user_deck::UserDeck, state::AppState};

pub async fn add_deck   (
    Path((deck, name, token)): Path<(String, String, String)>,
    State(state): State<Arc<AppState>>,
) -> Result<(StatusCode, String), (StatusCode, String)> {
    let owner = match database::get_account_from_token(&state.database, token).await {
        Ok(v) => v,
        Err(_) => return Err((StatusCode::BAD_REQUEST, "Token does not match an account, try logging out and then back in".to_string()))
    };

    let deck = deck.replace("\"", "");

    let mut json_deck = json!({});

    let lines: Vec<&str> = deck.lines().collect();

    for line in lines {
        let split_pos = line.find(":");

        let split_pos = match split_pos {
            Some(v) => v,
            None => return Err((StatusCode::BAD_REQUEST, "Invalid deck data".to_string()))
        };

        let (id, amount) = line.split_at(split_pos);

        json_deck[id] = Value::String(amount[1..].to_string());
    }

    let deck_id = Uuid::new_v4().to_string();

    let user_deck = UserDeck::new(json_deck.to_string(), deck_id, owner, name);

    match database::insert_struct(&state.database, user_deck).await {
        Ok(_) => Ok((StatusCode::OK, "Deck Created".to_string())),
        Err(_) => Err((StatusCode::INTERNAL_SERVER_ERROR, "Error inserting deck".to_string()))
    }
}
