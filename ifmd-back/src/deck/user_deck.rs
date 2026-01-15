use std::collections::HashMap;

use futures::future::join_all;
use serde_json::{Value, json};
use sqlx::{Pool, Sqlite};

use crate::database::{self, Insertable};

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
}

impl UserDeck {
    pub fn new(cards: String, id: String, owner: String, name: String) -> UserDeck {
        UserDeck {
            cards,
            id,
            owner,
            name,
        }
    }

    pub async fn to_json(&self, database: &Pool<Sqlite>) -> Value {
        let parsed_cards: HashMap<String, String> =
            serde_json::from_str(&self.cards).unwrap_or_default();

        // Parse all the cards from their ids to their name
        let futures = parsed_cards
            .iter()
            .map(|(id, count)| async move {
                let mut card = database::get_card_by_id(database, id).await;

                let count = count.parse::<i32>().unwrap();

                card.card_amount = count;

                json!(card)
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
            sqlx::QueryBuilder::new("INSERT INTO decks(id, owner, name, cards) VALUES(");

        query_builder.push_bind(self.id);
        query_builder.push("1, ");
        query_builder.push_bind(self.owner);
        query_builder.push("2, ");
        query_builder.push_bind(self.name);
        query_builder.push("3, ");
        query_builder.push_bind(self.cards);
        query_builder.push("4)");

        query_builder.build().execute(database).await?;

        Ok(())
    }
}
