use std::{collections::HashMap, fmt};

use futures::future::join_all;
use serde_json::{Value, json};
use sqlx::{Pool, Sqlite};

use crate::database::{self, Deletable, Insertable};

#[tsync::tsync]
#[derive(sqlx::FromRow, Clone, Debug, sqlx::Decode, sqlx::Encode)]
pub struct UserDeck {
    /// ID of the deck
    pub id: String,
    /// ID of the deck's owner
    pub owner: String,
    /// Name of the deck
    pub name: String,
    /// Cards in the deck {id: "", count: 0}
    pub cards: String,
    /// ID of the commander
    pub commander: String
}

impl UserDeck {
    pub fn new(cards: String, id: String, owner: String, name: String, commander: String) -> UserDeck {
        UserDeck {
            cards,
            id,
            owner,
            name,
            commander
        }
    }

    pub fn default() -> UserDeck {
        UserDeck {
            id: "".to_string(),
            owner: "".to_string(),
            name: "".to_string(),
            cards: "".to_string(),
            commander: "".to_string()
        }
    }

    pub async fn to_json(&self, database: &Pool<Sqlite>) -> Value {
        let parsed_cards: HashMap<String, Value> = match serde_json::from_str(&self.cards) {
            Ok(v) => v,
            Err(e) => {eprintln!("Parse {e:?}"); return Value::Null;}
        };

        // Parse all the cards from their ids to their name
        let futures = parsed_cards
            .iter()
            .map(|(id, card_data)| async move {
                let mut card = database::get_card_by_id(database, id).await;

                let count = card_data["amount"].as_i64().unwrap_or(1) as i32;
                let is_commander = card_data["isCommander"].as_bool().unwrap_or(false);

                card.card_amount = count;
                card.is_commander = is_commander;
                
                let json = json!(card);

                json
            })
            .collect::<Vec<_>>();

        let cards: Vec<Value> = join_all(futures).await;

        json!({
            "id": self.id,
            "owner": self.owner,
            "name": self.name,
            "cards": cards
        })
    }
}

impl Insertable for UserDeck {
    async fn insert(self, database: &sqlx::Pool<sqlx::Sqlite>) -> Result<(), anyhow::Error> {
        let mut query_builder: sqlx::QueryBuilder<sqlx::Sqlite> =
            sqlx::QueryBuilder::new("INSERT INTO decks(id, owner, name, cards, commander) VALUES(");

        query_builder.push_bind(self.id);
        query_builder.push("1, ");
        query_builder.push_bind(self.owner);
        query_builder.push("2, ");
        query_builder.push_bind(self.name);
        query_builder.push("3, ");
        query_builder.push_bind(self.cards);
        query_builder.push("4, ");
        query_builder.push_bind(self.commander);
        query_builder.push("5)");

        query_builder.build().execute(database).await?;

        Ok(())
    }
}

impl Deletable for UserDeck {
    fn delete_key(&self) -> (&str, &str) {
        ("id", &self.id)
    }
}

impl fmt::Display for UserDeck {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}\n{}\n{}\n{}\n", self.id, self.owner, self.name, self.commander)
    }
}