/* This file is generated and managed by tsync */

export interface Account {
  /** Name that will be displayed to other users */
  display_name: string;
  /** ID of the account to authenticate with */
  id: string;
  /** Password to the account */
  pass: string;
  /** Email associated with the account */
  email: string;
  /** Salt for the password */
  salt: string;
  /** Verified Status of the user */
  verified: boolean;
}

export interface Token {
  /** ID of the account to associate with the token */
  id: string;
  /** Token to associate with the account */
  token: string;
  /** Time the token was created */
  time: string;
}

export interface Card {
  /** Name of the card */
  name: string;
  /** Display name of the card */
  display_name?: string;
  /** Scryfall ID of the card */
  id: string;
  /** Path to the card image on scryfall */
  url: string;
  /** Set the card belongs to */
  set_id?: string;
  /** Amount of the card */
  card_amount: number;
  /** Is the card the commander in the deck */
  is_commander: boolean;
  /** Is the card two-faced */
  is_two_faced: boolean;
}

export interface Deck {
  /** List of cards in the deck */
  cards: Array<Card>;
}

export interface UserDeck {
  /** ID of the deck */
  id: string;
  /** ID of the deck's owner */
  owner: string;
  /** Name of the deck */
  name: string;
  /** Cards in the deck {id: \"\", count: 0} */
  cards: string;
  /** ID of the commander */
  commander: string;
}

export interface Client<T> {
  /** The type of client connected */
  client_type: ClientType;
  /** ID of the connected client */
  id: string;
  /** Data the client has */
  client_data: T;
}

export type ClientType =
  | "MAT" | "TABLE";

export interface PlayerData {
  /** Cards in the players hand */
  hand: Hand;
  /** Cards on the players table */
  played_cards: Array<PlayedCard>;
  /** Life remaining for the player */
  life: number;
  /** Vector of all the commander damage dealt to the player */
  commander_damage: Array<number>;
  /** Labels used for commander damage tracking rows */
  commander_damage_labels: Array<string>;
  /** Data of the deck being used */
  deck: UserDeck;
  /** Cards currently in this player's command zone */
  command_zone: Array<PlayedCard>;
  /** Top card of library when public reveal is enabled */
  revealed_library_top?: Card;
  /** Viewport dimensions of the MAT's battlefield, used by master view for scaling */
  viewport: ViewPort;
}

export interface ViewPort {
  width: number;
  height: number;
}

export interface Hand {
  /** Cards in the players hand */
  cards: Array<Card>;
}

export interface PlayedCard {
  /** The card itself */
  card: Card;
  /** Should the front of the card show */
  show_front: boolean;
  /** Is the card tapped */
  tapped: boolean;
  /** (x,y) coordinates of the card */
  location: [number, number];
  /** How many rotations to turn the card */
  rotation: number;
  /** Strength modifier to display */
  strength_mod: number;
  /** Toughness modifier to display */
  toughness_mod: number;
  /** Tokens on the card */
  counters: Array<Counter>;
}

export interface Counter {
  /** Amount of Counters on Card */
  amount: number;
  /** Name of te counter */
  name: string;
}
