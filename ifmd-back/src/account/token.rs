#[tsync::tsync]
#[derive(sqlx::FromRow, Clone, Debug, serde::Serialize, serde::Deserialize, sqlx::Decode, sqlx::Encode)]
pub struct Token {
    /// ID of the account to associate with the token
    pub id: String,
    /// Token to associate with the account
    pub token: String
}

impl Token {
    pub fn new(id: &str, token: &str) -> Token {
        Token {
            id: id.to_string(),
            token: token.to_string()
        }
    }
}