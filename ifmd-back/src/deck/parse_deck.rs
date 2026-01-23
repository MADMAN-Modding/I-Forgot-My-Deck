use core::fmt;

use crate::deck::card::Card;

#[tsync::tsync]
pub struct Deck {
    /// List of cards in the deck
    pub cards: Vec<Card>
}

impl Deck {
    pub fn new() -> Self {
        Self {
            cards: Vec::new()
        }
    }

    pub fn len(&self) -> usize {
        self.cards.len()
    }

    pub fn is_empty(&self) -> bool {
        self.cards.is_empty()
    }

    pub fn get_cards(&self) -> &Vec<Card> {
        &self.cards
    }

    pub fn add_card(&mut self, card: Card) {
        self.cards.push(card);
    }

    pub fn list_cards(&self) {
        for card in &self.cards {
            println!("{} ({})", card.name, card.set_id.as_deref().unwrap_or("N/A").to_uppercase());
        }
    }
}

impl fmt::Display for Deck {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Deck with {} cards", self.cards.len())
    }
}