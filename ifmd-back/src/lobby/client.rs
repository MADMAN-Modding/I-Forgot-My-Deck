use std::collections::HashMap;

use crate::deck::{card::Card, user_deck::UserDeck};

#[tsync::tsync]
pub struct Client<T>
where
    T: ClientData,
{
    /// The type of client connected
    pub client_type: ClientType,
    /// ID of the connected client
    pub id: String,
    /// Data the client has
    pub client_data: T,
}

impl<T> Client<T>
where
    T: ClientData,
{
    /// Return new Client struct from string representation of client type
    pub fn from_str(
        client_type: &str,
    ) -> Client<T>
    {
        let client_type = ClientType::from_str(client_type);

        Client {
            client_type,
            id: "".to_string(),
            client_data: T::default(),
        }
    }

    /// Return reference to client data
    pub fn get_client_data(&self) -> &T {
        &self.client_data
    }
}

impl Client<PlayerData> {
    /// Return new Client struct
    pub fn new(
        client_type: ClientType,
        id: &str,
        client_data: PlayerData,
    ) -> Client<PlayerData> {
        Client {
            client_type,
            id: id.to_string(),
            client_data,
        }
    }
}

impl Client<TableData> {
    /// Return new Client struct
    pub fn new(
        client_type: ClientType,
        id: &str,
        client_data: TableData,
    ) -> Client<TableData> {
        Client {
            client_type,
            id: id.to_string(),
            client_data,
        }
    }
}

/// Trait for client data, implemented by PlayerData and TableData
pub trait ClientData {
    fn default() -> Self;
}

#[tsync::tsync]
pub enum ClientType {
    /// Mat is the term used for players
    MAT,
    /// Table is the term used for the screen viewing the board
    TABLE,
}

impl ClientType {
    /// Return ClientType from &str
    pub fn from_str(client_type: &str) -> ClientType {
        match client_type.to_uppercase().as_str() {
            "MAT" => ClientType::MAT,
            "TABLE" => ClientType::TABLE,
            _ => panic!("Invalid client type"),
        }
    }

    pub fn to_string(&self) -> String {
        match self {
            ClientType::MAT => "MAT",
            ClientType::TABLE => "TABLE"
        }.to_string()
    }
}

#[tsync::tsync]
pub struct PlayerData {
    /// Cards in the players hand
    pub hand: Hand,
    /// Cards on the players table
    pub played_cards: Vec<PlayedCard>,
    /// Life remaining for the player
    pub life: i32,
    /// Vector of all the commander damage dealt to the player
    pub commander_damage: Vec<i32>,
    /// Data of the deck being used
    pub deck: UserDeck,
}

impl PlayerData {
    /// Return new PlayerData struct
    pub fn new(
        hand: Hand,
        played_cards: Vec<PlayedCard>,
        life: i32,
        commander_damage: Vec<i32>,    
        deck: UserDeck,
    ) -> PlayerData {
        PlayerData {
            hand,
            played_cards,
            life,
            commander_damage,
            deck,
        }
    }
}

impl ClientData for PlayerData {
    fn default() -> Self {
        PlayerData {
            hand: Hand { cards: Vec::new() },
            played_cards: Vec::new(),
            life: 40,
            commander_damage: Vec::new(),
            deck: UserDeck::default()
        }
    }
}

#[tsync::tsync]
pub struct Hand {
    /// Cards in the players hand
    pub cards: Vec<Card>,
}

impl Hand {
    /// Return new Hand struct
    pub fn new(cards: Vec<Card>) -> Hand {
        Hand { cards }
    }
}

#[tsync::tsync]
pub struct PlayedCard {
    /// The card itself
    pub card: Card,
    /// Should the front of the card show
    pub show_front: bool,
    /// Is the card tapped
    pub tapped: bool,
    /// (x,y) coordinates of the card
    pub location: (f32, f32),
    /// How many rotations to turn the card
    pub rotation: f32,
    /// Strength modifier to display
    pub strength_mod: i32,
    /// Toughness modifier to display
    pub toughness_mod: i32,
    /// Tokens on the card
    pub counters: Vec<Counter>,
}

impl PlayedCard {
    /// Return new PlayedCard struct
    pub fn new(
        card: Card,
        show_front: bool,
        tapped: bool,
        location: (f32, f32),
        rotation: f32,
        strength_mod: i32,
        toughness_mod: i32,
        counters: Vec<Counter>,
    ) -> PlayedCard {
        PlayedCard {
            card,
            show_front,
            tapped,
            location,
            rotation,
            strength_mod,
            toughness_mod,
            counters,
        }
    }
}

#[tsync::tsync]
pub struct Counter {
    /// Amount of Counters on Card
    pub amount: i32,
    /// Name of te counter
    pub name: String,
}

impl Counter {
    pub fn new(amount: i32, name: &str) -> Counter {
        Counter {
            amount,
            name: name.to_string(),
        }
    }
}

pub struct TableData {
    pub player_count: i32,
    pub life_max: i32,
    pub client_data: HashMap<Client<PlayerData>, PlayerData>,
}

impl ClientData for TableData {
    fn default() -> Self {
        TableData {
            player_count: 0,
            life_max: 40,
            client_data: HashMap::new(),
        }
    }
}
