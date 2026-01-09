use serde_json::Value;

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
    fn insert_type(self) -> Vec<Value> {
        let mut values: Vec<Value> = Vec::new();
        
        values.push(Value::String(self.deck_id));
        values.push(Value::String(self.owner));
        values.push(Value::String(self.name));
        values.push(Value::String(self.cards));

        values
    }
}
