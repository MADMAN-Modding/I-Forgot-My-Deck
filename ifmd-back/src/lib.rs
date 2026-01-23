pub mod constants;
pub mod database;
pub mod db_cleaner;
pub mod json_handler;

pub mod account {
    pub mod account;
    pub mod code;
    pub mod email;
    pub mod token;
}

pub mod routes {
    pub mod accounts;
    pub mod cards;
    pub mod decks;
    pub mod lobby;
}

pub mod deck {
    pub mod cache;
    pub mod card;
    pub mod parse_deck;
    pub mod user_deck;
}

pub mod lobby {
    pub mod client;
}

pub mod queue;
pub mod state;
