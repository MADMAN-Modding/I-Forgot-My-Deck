use crate::database::Insertable;

#[tsync::tsync]
#[derive(sqlx::FromRow, Clone, Debug, sqlx::Decode, sqlx::Encode)]
pub struct UserDeck {
    /// ID of the deck
    pub deck_id: String,
    /// ID of the deck's owner
    pub owner: String,
    /// Name of the deck
    pub name: String,
    /// Cards in the deck {id: "", count: 0}
    pub cards: String,
}

impl UserDeck {
    pub fn new(cards: String, deck_id: String, owner: String, name: String) -> UserDeck {
        UserDeck {
            cards,
            deck_id,
            owner,
            name,
        }
    }
}

impl Insertable for UserDeck {
    async fn insert(self, database: &sqlx::Pool<sqlx::Sqlite>) -> Result<(), anyhow::Error> {
        let mut query_builder: sqlx::QueryBuilder<sqlx::Sqlite> = sqlx::QueryBuilder::new(
            "INSERT INTO decks(id, owner, name, cards) VALUES(",
        );

        query_builder.push_bind(self.deck_id);
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
