use std::sync::Arc;

use axum::{
    Json,
    extract::{Path, State},
};
use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::{
    database::{self, add_account, check_account_exists, get_account}, email::{self, send_email}, state::AppState
};

#[tsync::tsync]
#[derive(sqlx::FromRow, Clone, Debug, serde::Serialize, serde::Deserialize, sqlx::Decode, sqlx::Encode)]
pub struct Account {
    pub display_name: String,
    pub id: String,
    pub pass: String,
    pub email: String,
    pub salt: String,
    pub verified: bool,
}

impl Account {
    pub fn new(display_name: &str, id: &str, pass: &str, email: &str, salt: &str, verified: bool) -> Account {
        Account {
            display_name: display_name.to_string(),
            id: id.to_string(),
            pass: pass.to_string(),
            email: email.to_string(),
            salt: salt.to_string(),
            verified
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


#[derive(sqlx::FromRow, Clone, Debug, serde::Serialize, serde::Deserialize, sqlx::Decode, sqlx::Encode)]
pub struct Code {
    pub code: String,
    pub action: String,
    pub data: String
}

impl Code {
    fn parse_id(&self) -> String {
        let arguments = self.parse_data();

        for arg in arguments {
            if arg.contains("id") {
                // Unwrap as the server is generating the args
                let key_break = arg.find(":").unwrap();

                return arg[key_break+1..].to_string();
            }
        }

        "".to_string()
    }

    fn parse_data(&self) -> Vec<String> {
        let mut arguments: Vec<String> = Vec::new();

        let mut data = self.data.clone();

        loop {
            let delimiter_pos = data.find(",");

            if delimiter_pos.is_none() {
                break;
            }

            let delimiter_pos = delimiter_pos.unwrap();

            arguments.push(data[0..delimiter_pos].to_string());

            data = data[(delimiter_pos+1)..].to_owned();
        }

        arguments
    }

    /// Makes a new Code
    fn new(code: &str, action: Action, data: &str) -> Code {
        Code {
            code: code.to_string(),
            action: action.to_string(),
            data: data.to_string()
        }
    } 
}

enum Action {
    VERIFY
}

impl Action {
    /// Convert the Action to a String
    fn to_string(&self) -> String {
        let val = match self {
            Action::VERIFY => "VERIFY"
        };

        val.to_string()
    }
}

pub async fn make_account(
    Path((display_name, id, email, pass)): Path<(String, String, String, String)>,
    State(state): State<Arc<AppState>>,
) -> Result<(StatusCode, Json<serde_json::Value>), (StatusCode, Json<String>)> {
    let display_name: &str = &display_name;
    let id: &str = &id.to_lowercase();
    let email: &str = &email;

    let mut salt = [0u8; 22];

    rand::fill(&mut salt);

    let salt = String::from_utf8_lossy(&salt).to_string();

    let hash_pass = sha256::digest(format!("{}{}", salt, pass));

    let account = Account::new(display_name, id, &hash_pass, email, &salt, false);

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
        return Err((StatusCode::BAD_REQUEST, axum::Json("Error Making Account".to_string())))
    }

    let action = Action::VERIFY;

    let code = Uuid::new_v4().to_string();

    let data = format!("id:{},", id);

    let code_struct = Code::new(&code, action, &data);

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

    let account = get_account(&state.database, &id).await.map_err(|_| (StatusCode::BAD_REQUEST, Json(json!({"msg":"Account doesn't exist or invalid login credentials"}))))?;

    let salt = account.salt;
    let hash_pass = account.pass;

    let pass = sha256::digest(format!("{}{}", salt, pass));

    if pass == hash_pass {
        if account.verified {
            Ok((StatusCode::OK, Json(json!({"token": "TOKEN"}))))
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