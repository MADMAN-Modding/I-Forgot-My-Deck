use std::sync::Arc;

use axum::{
    Json,
    extract::{Path, State},
};
use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::{database, deck::user_deck::UserDeck, routes::accounts, state::AppState};

pub async fn add_deck(
    Path((deck, name, token)): Path<(String, String, String)>,
    State(state): State<Arc<AppState>>,
) -> Result<(StatusCode, String), (StatusCode, String)> {
    let owner = accounts::get_owner_from_token(&state.database, token).await?;

    let deck = deck.replace("\"", "");

    let mut json_deck = json!({});

    let lines: Vec<&str> = deck.lines().collect();

    for line in lines {
        let split_pos = line.find(":");

        let command_split_pos = line.find("|");

        let split_pos = match split_pos {
            Some(v) => v,
            None => return Err((StatusCode::BAD_REQUEST, "Invalid deck data".to_string())),
        };

        let command_split_pos = match command_split_pos {
            Some(v) => v,
            None => return Err((StatusCode::BAD_REQUEST, "Invalid deck data".to_string())),
        };

        let (id, amount_is_commander) = line.split_at(split_pos);

        let (amount, is_commander) = amount_is_commander.split_at(command_split_pos - split_pos);

        let amount = amount[1..].to_string();
        let is_commander = is_commander[1..].to_string() == "true";

        println!("{}|||{}|||{}", id, amount, is_commander);

        json_deck[id] = json!({"amount": Value::String(amount),"isCommander": is_commander});
    }

    let deck_id = Uuid::new_v4().to_string();

    let user_deck = UserDeck::new(json_deck.to_string(), deck_id, owner, name);

    match database::insert_struct(&state.database, user_deck).await {
        Ok(_) => Ok((StatusCode::OK, "Deck Created".to_string())),
        Err(_) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            "Error inserting deck".to_string(),
        )),
    }
}

pub async fn get_user_decks(
    Path(token): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<(StatusCode, Json<Value>), (StatusCode, String)> {
    let owner = accounts::get_owner_from_token(&state.database, token).await?;

    let sql_decks = database::search_table(&state.database, "decks", &owner, "owner")
        .await
        .unwrap();

    let mut decks: Vec<Vec<String>> = Vec::new();

    // Gets the values in the "id" column of each row
    for deck in sql_decks {
        let deck: UserDeck = sqlx::FromRow::from_row(&deck).unwrap();

        let mut deck_vec: Vec<String> = Vec::new();

        deck_vec.push(deck.id);
        deck_vec.push(deck.name);

        decks.push(deck_vec);
    }

    Ok((StatusCode::OK, Json(json!(decks))))
}

pub async fn get_deck_list(
    Path((token, id)): Path<(String, String)>,
    State(state): State<Arc<AppState>>,
) -> Result<(StatusCode, Json<Value>), (StatusCode, String)> {
    let owner = accounts::get_owner_from_token(&state.database, token).await?;

    let row = &database::search_table(&state.database, "decks", &id, "id")
        .await
        .unwrap()[0];

    let deck: UserDeck = sqlx::FromRow::from_row(row).unwrap();

    if deck.owner != owner {
        return Err((
            StatusCode::BAD_REQUEST,
            "you don't own this deck".to_string(),
        ));
    }

    Ok((StatusCode::OK, Json(deck.to_json(&state.database).await)))
}
