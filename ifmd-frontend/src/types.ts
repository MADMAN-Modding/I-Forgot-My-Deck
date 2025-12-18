/* This file is generated and managed by tsync */

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
}

export interface Deck {
  /** List of cards in the deck */
  cards: Array<Card>;
}

export interface Account {
  display_name: string;
  id: string;
  pass: string;
  email: string;
  salt: string;
  verified: boolean;
}
