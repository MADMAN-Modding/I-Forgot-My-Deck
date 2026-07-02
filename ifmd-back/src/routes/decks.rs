use std::sync::Arc;

use axum::{
    Json,
    extract::{Path, State},
};
use reqwest::StatusCode;
use serde_json::{Value, json};
use sqlx::{Pool, Sqlite};
use uuid::Uuid;

use crate::{
    database::{self, search_table, token_exists},
    deck::user_deck::UserDeck,
    routes::{accounts, cards::get_card_image_base64},
    state::AppState,
};

pub async fn add_deck(
    Path((deck, name, token)): Path<(String, String, String)>,
    State(state): State<Arc<AppState>>,
) -> Result<(StatusCode, String), (StatusCode, String)> {
    if !token_exists(&state.database, &token).await {
        return Err((StatusCode::BAD_REQUEST, "Invalid Token".to_string()));
    }

    if name.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Deck must have a name.".to_string(),
        ));
    }

    let owner = accounts::get_owner_from_token(&state.database, token).await?;

    let deck = deck.replace("\"", "");

    let mut json_deck = json!({});

    let lines: Vec<&str> = deck.lines().collect();

    let mut commander_id: String = String::new();

    // For every card
    for (index, line) in lines.iter().enumerate() {
        if index >= 100 {
            break;
        }

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

        if is_commander {
            commander_id = id.to_owned();
        }

        // Make the json for the card
        json_deck[id] = json!({"amount": Value::Number(amount.into()),"isCommander": is_commander});
    }

    let deck_id = Uuid::new_v4().to_string();

    let user_deck = UserDeck::new(json_deck.to_string(), deck_id, owner, name, commander_id);

    match database::insert_struct(&state.database, user_deck).await {
        Ok(_) => Ok((StatusCode::OK, "Deck Created".to_string())),
        Err(e) => {
            eprintln!("{e:?}");
            Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            "Error inserting deck".to_string(),
        ))},
    }
}

pub async fn get_user_decks(
    Path(token): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<(StatusCode, Json<Value>), (StatusCode, String)> {
    if !token_exists(&state.database, &token).await {
        return Err((StatusCode::BAD_REQUEST, "Invalid Token".to_string()));
    }

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
    Path((id, token)): Path<(String, String)>,
    State(state): State<Arc<AppState>>,
) -> Result<(StatusCode, Json<Value>), (StatusCode, String)> {
    if !token_exists(&state.database, &token).await {
        return Err((StatusCode::BAD_REQUEST, "Invalid Token".to_string()));
    }

    let deck = match get_deck_from_db(token, id, &state.database).await {
        Ok(v) => v,
        Err(e) => return Err(e),
    };

    Ok((StatusCode::OK, Json(deck.to_json(&state.database).await)))
}

pub async fn delete_deck(
    Path((id, token)): Path<(String, String)>,
    State(state): State<Arc<AppState>>,
) -> Result<(StatusCode, Json<Value>), (StatusCode, String)> {
    if !token_exists(&state.database, &token).await {
        return Err((StatusCode::BAD_REQUEST, "Invalid Token".to_string()));
    }

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

pub async fn get_commander_img_from_deck_id(
    Path((deck_id, token)): Path<(String, String)>,
    State(state): State<Arc<AppState>>,
) -> Result<(StatusCode, String), (StatusCode, String)> {
    if !token_exists(&state.database, &token).await {
        return Err((StatusCode::BAD_REQUEST, "Invalid Token".to_string()));
    }

    let deck_row = match search_table(&state.database, "decks", &deck_id, "id").await {
        Ok(v) => v,
        Err(_) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to retrieve deck from database.".to_string(),
            ));
        }
    };

    let deck: UserDeck = sqlx::FromRow::from_row(&deck_row[0]).unwrap();

    match get_card_image_base64(&deck.commander, true).await {
        Ok(v) => Ok(v),
        Err(_) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to generate base64 of image".to_string(),
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
        .await
        .map(|deck| {
            if deck.len() != 1 {
                return Err((
                    StatusCode::BAD_REQUEST,
                    "you don't own this deck".to_string(),
                ));
            } else {
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
