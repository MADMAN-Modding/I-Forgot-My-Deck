use chrono::NaiveDateTime;

use crate::database::Deletable;

#[tsync::tsync]
#[derive(sqlx::FromRow, Clone, Debug, sqlx::Decode, sqlx::Encode)]
pub struct Token {
    /// ID of the account to associate with the token
    pub id: String,
    /// Token to associate with the account
    pub token: String,
    /// Time the token was created
    pub time: String
}

impl Token {
    pub fn new(id: &str, token: &str, time: NaiveDateTime) -> Token {
        Token {
            id: id.to_string(),
            token: token.to_string(),
            time: time.to_string()
        }
    }

    /// Parse the SQLite timestamp to NaiveDateTIme (UTC)
    pub fn created_datetime(&self) -> NaiveDateTime {
        NaiveDateTime::parse_from_str(&self.time, "%Y-%m-%d %H:%M:%S").expect("Invalid timestamp in DB")
    }
}

impl Deletable for Token {
    fn delete_key(&self) -> (&str, &str) {
        ("token", &self.token)
    }
}