use core::fmt;

#[derive(sqlx::FromRow, Clone, Debug, serde::Serialize, serde::Deserialize)]
#[tsync::tsync]
pub struct Card {
    /// Name of the card
    pub name: String,
    /// Display name of the card
    pub display_name: Option<String>,
    /// Scryfall ID of the card
    pub id: String,
    /// Path to the card image on scryfall
    pub url: String,
    /// Set the card belongs to
    pub set_id: Option<String>,
}

/// Represents a card in the system
impl Card {
    /// Create a new Card instance
    /// # Arguments
    /// * `card_name: String` - Name of the card
    /// * `card_id: String` - Scryfall ID of the card
    /// * `card_img_path: String` - Path to the card image on scryfall
    /// # Returns
    /// `Card` - New Card instance
    pub fn new(name: String, display_name: Option<String>, id: String, card_img_path: String, set_id: Option<String>) -> Self {
        Self {
            name,
            display_name,
            id,
            url: card_img_path,
            set_id,
        }
    }

    pub fn to_json(&self) -> serde_json::Value {
        serde_json::to_value(self).unwrap()
    }
}

/// Implement Display trait for Card
impl fmt::Display for Card {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Card(Name: {:?}, Set: {:?}, ID: {}, Image Path: {})", self.display_name, self.set_id.as_deref().unwrap_or("N/A"), self.id, self.url)
    }
}