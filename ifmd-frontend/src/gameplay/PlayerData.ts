import { getDeckList } from "../decks/BuildDeck";
import type { Card, Counter, Hand, PlayedCard, PlayerData, UserDeck } from "../types";

function setupHand()  {
    var cards: Array<Card> = [];

    var hand: Hand = ({cards})

    return hand;
}

export async function setupPlayerData(id: string) {
    const hand = setupHand();

    const playedCards: Array<PlayedCard> = [];

    const life = 40;

    const commanderDamage: Array<number> = [];

    const deck_id = "6f5fd7fe-fddb-4bf0-b027-12da47c46b43";
    
    const cards = await getDeckList(deck_id);

    const deckName = "Reality Chip"

    const userDeck: UserDeck = ({id: deck_id, name: deckName, cards: cards, owner: id});

    const playerData: PlayerData = ({
        hand: hand,
        played_cards: playedCards,
        life: life,
        commander_damage: commanderDamage,
        commander_damage_labels: [],
        deck: userDeck,
        command_zone: [],
        revealed_library_top: undefined,
        viewport: {width: 100, height: 100}
    });
    
    return playerData;
}

export function playerDataJSON(playerData: PlayerData): JSON {
    return JSON.parse(JSON.stringify(playerData));
};

export function cardJSON(card: Card): JSON {
    var json = (`
        "name": ${card.name},
        "display_name": ${card.display_name ?? card.name},
        "id": ${card.id},
        "url": ${card.url},
        "cardAmount": ${card.card_amount},
        "isCommander": ${card.is_commander},
        "isTwoFaced": ${card.is_two_faced}
    `)

    return JSON.parse(json);
}

export function playedCardJSON(playedCard: PlayedCard): JSON {
    var json = (`
        "card": ${cardJSON(playedCard.card)},
        "tapped": ${playedCard.tapped},
        "showFront": ${playedCard.show_front},
        location: ${playedCard.location},
        rotation: ${playedCard.rotation},
        strengthMod: ${playedCard.strength_mod},
        toughnessMod: ${playedCard.toughness_mod},
        counters: ${playedCard.counters.map(counter => counterJSON(counter)).join(", ")}
    `);

    return JSON.parse(json);
}

export function counterJSON(counter: Counter) {
    var json = (`
        "amount": ${counter.amount},
        "name": ${counter.name}
    `);
    
    return JSON.parse(json);
}