use std::sync::Arc;

use axum::{
    Json,
    extract::{Path, State},
};
use reqwest::StatusCode;
use serde_json::{Value, json};

use crate::{
    database::{add_account, check_account_exists},
    email::{self, send_email},
    state::AppState,
};

#[tsync::tsync]
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
    let pass: &str = &pass;

    let account = Account::new(display_name, id, pass, email, "SALT");

    let message = format!("Hello, {display_name}!\n I hope you enjoy I Forgot My Deck!");

    // Check if the account exists
    if check_account_exists(&state.database, &account).await {
        // Account already exists
        return Err((StatusCode::CONFLICT, Json("Account Exists".to_string())));
    }

    // Validate email
    if !email::validate_email(email) {
        return Err((StatusCode::BAD_REQUEST, Json("Invalid Email".to_string())));
    }

    // Send email
    match send_email(&state.email_config, &message, email) {
        Ok(_) => {
            // Email sent successfully, now add the account to the database
            match add_account(&state.database, &account).await {
                Ok(_) => Ok((StatusCode::OK, Json(json!({"msg": "Account Created"})))),
                Err(_) => Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json("Failed to input data".to_string()),
                )),
            }
        }
        Err(_) => Err((
            StatusCode::NOT_ACCEPTABLE,
            Json("Account Email Failed".to_string()),
        )),
    }
}
