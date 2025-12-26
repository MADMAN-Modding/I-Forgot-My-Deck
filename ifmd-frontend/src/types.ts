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
}

export interface Deck {
  /** List of cards in the deck */
  cards: Array<Card>;
}
