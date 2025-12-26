use std::sync::Arc;

use axum::{
    Json,
    extract::{Path, State},
};
use chrono::Utc;
use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::{
    account::{account::Account, code::{Action, Code}, email::{self, send_email}, token::Token}, database::{self, add_account, add_token, check_account_exists, check_token, get_account, reset_token_time}, state::AppState
};

pub async fn make_account(
    Path((display_name, id, email, pass)): Path<(String, String, String, String)>,
    State(state): State<Arc<AppState>>,
) -> Result<(StatusCode, Json<serde_json::Value>), (StatusCode, Json<String>)> {
    let display_name: &str = &display_name;
    let id: &str = &id.to_lowercase();
    let email: &str = &email;

    // Validate email
    if !email::validate_email(email) {
        return Err((StatusCode::BAD_REQUEST, Json("Invalid Email".to_string())));
    }

    let mut salt = [0u8; 22];

    rand::fill(&mut salt);

    let salt = String::from_utf8_lossy(&salt).to_string();

    let hash_pass = sha256::digest(format!("{}{}", salt, pass));

    let account = Account::new(display_name, id, &hash_pass, email, &salt, false);


    if !check_account_exists(&state.database, &account).await {
        match add_account(&state.database, &account).await {
            Ok(_) => {},
            Err(_) => return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json("Failed to input data".to_string()),
            )),
        };
    } else {
        return Err((StatusCode::BAD_REQUEST, axum::Json("Error Making Account".to_string())))
    }

    let action = Action::VERIFY;

    let code = Uuid::new_v4().to_string();

    let data = format!("id:{},", id);

    let time = Utc::now().naive_utc();

    let code_struct = Code::new(&code, action, &data, time);

    // Add the code to the database
    database::add_code(&state.database, code_struct).await.unwrap();

    // Message to be emailed
    let message = format!("<h1>Hello, {display_name}!</h1>\n<p>I hope you enjoy I Forgot My Deck!</p>\n<a href='http://localhost:5173/verify/{code}'>Verify your account here</a>");
    
    // Send email
    match send_email(&state.email_config, &message, email) {
        Ok(_) => Ok((
            StatusCode::OK,
            Json(json!({"msg": "Account Created"}))
        )),
        Err(_) => Err((
            StatusCode::NOT_ACCEPTABLE,
            Json("Account Email Failed".to_string()),
        )),
    }
}

pub async fn auth_account(Path((id, pass)): Path<(String, String)>,
    State(state): State<Arc<AppState>>,
) -> Result<(StatusCode, Json<Value>), (StatusCode, Json<Value>)> {
    let id = id.to_lowercase();

    let account = get_account(&state.database, &id).await.map_err(|_| (StatusCode::BAD_REQUEST, Json(json!({"msg":"Account doesn't exist or invalid login credentials"}))))?;

    let salt = account.salt;
    let hash_pass = account.pass;

    let pass = sha256::digest(format!("{}{}", salt, pass));

    if pass == hash_pass {
        if account.verified {
            let token = Uuid::new_v4();

            let time = Utc::now().naive_utc();

            let token = Token::new(&id, &token.to_string(), time);

            match add_token(&state.database, token.clone()).await {
                Ok(_) => {},
                Err(_) => return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": "failed generating token"}))))
            };

            Ok((StatusCode::OK, Json(json!({"token": token.token}))))
        } else {
            Err((StatusCode::BAD_REQUEST, Json(json!({"msg":"Account not yet verified, please check your email, including the spam and trash."}))))
        }
    } else {
        Err((StatusCode::BAD_REQUEST, Json(json!({"msg":"Account doesn't exist or invalid login credentials"}))))
    }


}

pub async fn verify_account(Path(code): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<(StatusCode, Json<Value>), (StatusCode, Json<Value>)> {
    let code: Code = match database::get_code(&state.database, &code).await {
        Ok(v) => v,
        Err(_) => return Err((StatusCode::BAD_REQUEST, Json(json!({"msg":"Code not found"})))) 
    };

    let id = code.parse_id();

    match database::verify_account(&state.database, &id, code.code).await {
        Ok(_) => Ok((StatusCode::OK, Json(json!({"msg": "verified"})))),        
        Err(_)=> Err((StatusCode::BAD_REQUEST, Json(json!({"msg":"Invalid code"}))))
    }
}

/// Authenticate with a token
pub async fn token_auth(Path(token): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<(StatusCode, Json<Value>), (StatusCode, Json<Value>)> {

    match check_token(&state.database, token).await {
        Ok(token) => {
            reset_token_time(&state.database, &token.token).await.unwrap();

            let account = get_account(&state.database, &token.id).await.unwrap();

            let payload = account.strip().to_json();

            Ok((StatusCode::OK, Json(payload)))
        },
        Err(_) => Err((StatusCode::BAD_REQUEST, Json(json!({"msg":"invalid_token"}))) ),
    }
} 