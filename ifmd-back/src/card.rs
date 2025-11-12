use core::fmt;

#[derive(sqlx::FromRow, Clone)]
pub struct Card {
    /// Name of the card
    pub card_name: String,
    /// Scryfall ID of the card
    pub card_id: String,
    /// Path to the card image on scryfall
    pub card_url: String,
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
    pub fn new(card_name: String, card_id: String, card_img_path: String) -> Self {
        Self {
            card_name,
            card_id,
            card_url: card_img_path,
        }
    }
}

/// Implement Display trait for Card
impl fmt::Display for Card {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Card(Name: {}, ID: {}, Image Path: {})", self.card_name, self.card_id, self.card_url)
    }
}