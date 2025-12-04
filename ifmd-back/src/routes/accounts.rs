use std::sync::Arc;

use axum::{
    Json,
    extract::{Path, State},
};
use reqwest::StatusCode;
use serde_json::{Value, json};

use crate::{
    database::{add_account, check_account_exists, get_account}, email, state::AppState
};

#[tsync::tsync]
#[derive(sqlx::FromRow, Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct Account {
    pub display_name: String,
    pub id: String,
    pub pass: String,
    pub email: String,
    pub salt: String,
}

impl Account {
    pub fn new(display_name: &str, id: &str, pass: &str, email: &str, salt: &str) -> Account {
        Account {
            display_name: display_name.to_string(),
            id: id.to_string(),
            pass: pass.to_string(),
            email: email.to_string(),
            salt: salt.to_string(),
        }
    }

    pub fn to_json(&self) -> Value {
        json!({
            "displayName": self.display_name,
            "id": self.id,
            "email": self.email,
            "pass": self.pass
        })
    }

    pub fn print(&self) {
            println!("UserName: {}\nDisplayName: {}\nEmail: {}\nPassword: {}", self.id, self.display_name, self.email, self.display_name);
    }
}

pub async fn make_account(
    Path((display_name, id, email, pass)): Path<(String, String, String, String)>,
    State(state): State<Arc<AppState>>,
) -> Result<(StatusCode, Json<serde_json::Value>), (StatusCode, Json<String>)> {
    let display_name: &str = &display_name;
    let id: &str = &id;
    let email: &str = &email;

    let mut salt = [0u8; 22];

    rand::fill(&mut salt);

    let salt = String::from_utf8_lossy(&salt).to_string();

    let hash_pass = sha256::digest(format!("{}{}", salt, pass));

    let account = Account::new(display_name, id, &hash_pass, email, &salt);

    let _message = format!("Hello, {display_name}!\n I hope you enjoy I Forgot My Deck!");

    // Validate email
    if !email::validate_email(email) {
        return Err((StatusCode::BAD_REQUEST, Json("Invalid Email".to_string())));
    }

    if !check_account_exists(&state.database, &account).await {
        match add_account(&state.database, &account).await {
            Ok(_) => {},
            Err(_) => return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json("Failed to input data".to_string()),
            )),
        };
    } else {
        return Err((StatusCode::INTERNAL_SERVER_ERROR, axum::Json("Error Making Account".to_string())))
    }

    Ok((StatusCode::OK, Json(json!({"msg": "Account Created"}))))
    // // Send email
    // match send_email(&state.email_config, &message, email) {
    //     Ok(_) => Ok((
    //         StatusCode::OK,
    //         Json(json!({"msg": "Account Created"}))
    //     )),
    //     Err(_) => Err((
    //         StatusCode::NOT_ACCEPTABLE,
    //         Json("Account Email Failed".to_string()),
    //     )),
    // }
}

pub async fn auth_account(Path((id, pass)): Path<(String, String)>,
    State(state): State<Arc<AppState>>,
) -> Result<(StatusCode, Json<Value>), (StatusCode, Json<Value>)> {

    let account = get_account(&state.database, &id).await.map_err(|_| (StatusCode::BAD_REQUEST, Json(json!({"msg":"Account doesn't exist or invalid login credentials"}))))?;

    let salt = account.salt;
    let hash_pass = account.pass;

    let pass = sha256::digest(format!("{}{}", salt, pass));

    if  pass == hash_pass {
        Ok((StatusCode::OK, Json(json!({"token": "TOKEN"}))))
    } else {
        Err((StatusCode::BAD_REQUEST, Json(json!({"msg":"Account doesn't exist or invalid login credentials"}))))
    }


}