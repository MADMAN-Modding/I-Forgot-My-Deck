use chrono::NaiveDateTime;

use crate::database::{Deletable, Insertable};

#[derive(sqlx::FromRow, Clone, Debug, sqlx::Decode, sqlx::Encode)]
pub struct Code {
    /// Code to be used to search the database
    pub code: String,
    /// Action to perform once the code is found
    pub action: String,
    /// Data to use for the action
    pub data: String,
    /// Time the code was created
    pub time: String
}

impl Code {
    pub fn parse_id(&self) -> String {
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
    pub fn new(code: &str, action: Action, data: &str, time: NaiveDateTime) -> Code {
        Code {
            code: code.to_string(),
            action: action.to_string(),
            data: data.to_string(),
            time: time.to_string()
        }
    }

    /// Parse the SQLite timestamp to NaiveDateTIme (UTC)
    pub fn created_datetime(&self) -> NaiveDateTime {
        NaiveDateTime::parse_from_str(&self.time, "%Y-%m-%d %H:%M:%S").expect("Invalid timestamp in DB")
    }
}

impl Deletable for Code {
    fn delete_key(&self) -> (&str, &str) {
        ("code", &self.code)
    }
}

impl Insertable for Code {
    async fn insert(self, database: &sqlx::Pool<sqlx::Sqlite>) -> Result<(), anyhow::Error> {
        let mut query_builder: sqlx::QueryBuilder<sqlx::Sqlite> = sqlx::QueryBuilder::new(

        "INSERT INTO codes (code, action, data) VALUES(",
        );

        query_builder.push_bind(self.code);
        query_builder.push("1, ");
        query_builder.push_bind(self.action);
        query_builder.push("2, ");
        query_builder.push_bind(self.data);
        query_builder.push("3)");

        query_builder.build().execute(database).await?;

        Ok(())
    }
}

pub enum Action {
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