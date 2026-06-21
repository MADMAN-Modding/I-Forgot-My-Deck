use std::sync::Arc;

use axum::{
    Json,
    extract::{Path, State},
};
use reqwest::StatusCode;
use serde_json::{Value, json};
use sqlx::{Pool, Sqlite};
use uuid::Uuid;

use crate::{database, deck::user_deck::UserDeck, routes::accounts, state::AppState};

pub async fn add_deck(
    Path((deck, name, token)): Path<(String, String, String)>,
    State(state): State<Arc<AppState>>,
) -> Result<(StatusCode, String), (StatusCode, String)> {
    if name.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Deck must have a name.".to_string()))
    }

    let owner = accounts::get_owner_from_token(&state.database, token).await?;

    let deck = deck.replace("\"", "");

    let mut json_deck = json!({});

    let lines: Vec<&str> = deck.lines().collect();

    // For every card
    for line in lines {
        // Split between card id and the card data
        let split_pos = line.find(":");

        // Split between card amount and if the card is the commander
        let command_split_pos = line.find("|");

        let split_pos = match split_pos {
            Some(v) => v,
            None => return Err((StatusCode::BAD_REQUEST, "Invalid deck data".to_string())),
        };

        let command_split_pos = match command_split_pos {
            Some(v) => v,
            None => return Err((StatusCode::BAD_REQUEST, "Invalid deck data".to_string())),
        };

        // Split the card and data
        let (id, amount_is_commander) = line.split_at(split_pos);

        // Split the amount and commander bool
        let (amount, is_commander) = amount_is_commander.split_at(command_split_pos - split_pos);

        let amount = amount.split_at(1).1;

        let amount = amount.parse::<i32>().unwrap_or(1);
        let is_commander = is_commander[1..].to_string() == "true";

        // Make the json for the card
        json_deck[id] = json!({"amount": Value::Number(amount.into()),"isCommander": is_commander});
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
    let deck = match get_deck_from_db(token, id, &state.database).await {
        Ok(v) => v,
        Err(e) => return Err(e),
    };

    Ok((StatusCode::OK, Json(deck.to_json(&state.database).await)))
}

pub async fn delete_deck(
    Path((token, id)): Path<(String, String)>,
    State(state): State<Arc<AppState>>,
) -> Result<(StatusCode, Json<Value>), (StatusCode, String)> {
    let deck = match get_deck_from_db(token, id, &state.database).await {
        Ok(v) => v,
        Err(e) => return Err(e),
    };

    match database::delete_row(&state.database, "decks", &deck).await {
        Ok(_) => Ok((StatusCode::OK, Json(json!({"msg":"Deck Deleted"})))),
        Err(_) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to Delete Deck".to_string(),
        )),
    }
}

async fn get_deck_from_db(
    token: String,
    id: String,
    database: &Pool<Sqlite>,
) -> Result<UserDeck, (StatusCode, String)> {
    let owner = accounts::get_owner_from_token(database, token).await?;

    let deck = &database::search_table(database, "decks", &id, "id")
        .await.map(|deck| {
            if deck.len() != 1 {
                return Err((
                StatusCode::BAD_REQUEST,
                "you don't own this deck".to_string(),
            )) } else {
                Ok(deck)
            }
        })
        .map_err(|_| {
            (
                StatusCode::BAD_REQUEST,
                "you don't own this deck".to_string(),
            )
        })??;

    let deck: UserDeck = sqlx::FromRow::from_row(&deck[0]).unwrap();

    if deck.owner != owner {
        return Err((
            StatusCode::BAD_REQUEST,
            "you don't own this deck".to_string(),
        ));
    }

    Ok(deck)
}
