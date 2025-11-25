/* This file is generated and managed by tsync */

export interface Card {
  /** Name of the card */
  card_name: string;
  /** Display name of the card */
  card_display_name?: string;
  /** Scryfall ID of the card */
  card_id: string;
  /** Path to the card image on scryfall */
  card_url: string;
  /** Set the card belongs to */
  card_set?: string;
}

export interface Deck {
  /** List of cards in the deck */
  cards: Array<Card>;
}
