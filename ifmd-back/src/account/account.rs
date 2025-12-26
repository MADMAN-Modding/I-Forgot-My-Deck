use serde_json::{Value, json};

#[tsync::tsync]
#[derive(
    sqlx::FromRow, Clone, Debug, serde::Serialize, serde::Deserialize, sqlx::Decode, sqlx::Encode,
)]
pub struct Account {
    /// Name that will be displayed to other users
    pub display_name: String,
    /// ID of the account to authenticate with
    pub id: String,
    /// Password to the account
    pub pass: String,
    /// Email associated with the account
    pub email: String,
    /// Salt for the password
    pub salt: String,
    /// Verified Status of the user
    pub verified: bool,
}

pub struct StrippedAccount {
    /// Name that will be displayed to other users
    pub display_name: String,
    /// ID of the account to authenticate with
    pub id: String,
    /// Email associated with the account
    pub email: String,
}

impl StrippedAccount {
    pub fn to_json(&self) -> Value {
        json!({
            "displayName": self.display_name,
            "id": self.id,
            "email": self.email,
        })
    }
}

impl Account {
    pub fn new(
        display_name: &str,
        id: &str,
        pass: &str,
        email: &str,
        salt: &str,
        verified: bool,
    ) -> Account {
        Account {
            display_name: display_name.to_string(),
            id: id.to_string(),
            pass: pass.to_string(),
            email: email.to_string(),
            salt: salt.to_string(),
            verified,
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
    
    /// Converts the Account into a StrippedAccount, removing the password and salt
    pub fn strip(self) -> StrippedAccount {
        StrippedAccount {
            display_name: self.display_name,
            id: self.id,
            email: self.email,
        }
    }

    pub fn print(&self) {
        println!(
            "UserName: {}\nDisplayName: {}\nEmail: {}\nPassword: {}",
            self.id, self.display_name, self.email, self.display_name
        );
    }
}
