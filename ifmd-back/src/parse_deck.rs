use core::fmt;

use crate::card::{Card};

#[tsync::tsync]
pub struct Deck {
    /// List of cards in the deck
    pub cards: Vec<Card>,
}

impl Deck {
    pub fn new() -> Self {
        Self {
            cards: Vec::new(),
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
            println!("{} ({})", card.card_name, card.card_set.as_deref().unwrap_or("N/A").to_uppercase());
        }
    }
}

impl fmt::Display for Deck {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Deck with {} cards", self.cards.len())
    }
}

pub fn read_deck_file(path: &str) -> Result<Deck, anyhow::Error>{
    let cards = std::fs::read_to_string(path)?;
    
    let mut cards_vec: Vec<String> = Vec::new();

    // Filter out numbers and space before card names
    for line in cards.lines() {
        let card = line.trim_start().splitn(2, ' ').nth(1).unwrap_or(line);
        
        let card_name = card.split(')').next().unwrap_or(&card).trim().to_owned() + ")";

        cards_vec.push(card_name);
    }

    let mut deck = Deck::new();

    // Separate the card names and sets
    for card in &cards_vec {
        let card_name = card.split('(').next().unwrap_or(card).trim().to_string().replace("/", "//");
        let card_set = card.split('(').nth(1).unwrap_or("").trim_end_matches(')').trim().to_string().to_lowercase();
        deck.add_card(Card::new(card_name, String::new(), String::new(), Some(card_set)));
    }

    Ok(deck)
}