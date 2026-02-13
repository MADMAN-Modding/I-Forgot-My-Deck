import { getToken } from '../account/AccountManagement';
import type { Deck, Card } from '../types';
export function processDeck(fileData: string): Deck {
    var cardsCounted = 0;

    const cards: Card[] = fileData
        .split('\n')
        .map(line => line.trimStart())
        .filter(line => line.length > 0)
        .map(line => {
            if (line != "SIDEBOARD:") {


                const split = line.split(' ');

                const cardAmount = parseInt(split.slice(0)[0]);

                // Skip leading numbers (e.g., "2 Lightning Bolt")
                const afterCount = line.split(' ').slice(1).join(' ') || line;

                // Extract card name and optional set
                const [namePart, setPart] = afterCount.split('(');
                
                var isTwoFaced = namePart.includes("//");

                const cardName = namePart.trim().replace('//', '/').replace(/\//g, '//');
                const cardSet = setPart.trim().replace(')', '').toLowerCase().split(' ')[0];

                cardsCounted++;

                return {
                    name: cardName,
                    id: '',
                    url: '',
                    display_name: undefined,
                    set_id: cardSet,
                    card_amount: cardAmount,
                    is_commander: cardsCounted == 1,
                    is_two_faced: isTwoFaced
                } as Card;
            }
            return undefined;
        })
        .filter((card): card is Card => card !== undefined);

    return { cards };
}

export async function getDeckList(id: string) {
    try {
        const token = getToken();

        if (!token || id == null) {
            return;
        }

        const response = await fetch(
            `http://127.0.0.1:3000/api/deck_list/get/${encodeURIComponent(token)}/${encodeURIComponent(id)}`
        );

        let data = await response.json();

        if (response.ok) {
            console.log("Data" + data);
            return data;
        }
    } catch (err) {
        console.error(err);
    }
}

export function sortCommanderFirst(deck: Deck): Deck {
    var newDeck = {
        cards: []
    } as Deck

    console.log("Sorting...." + deck.cards.length);

    for (const card of deck.cards) {
        if (card.is_commander) {
            console.log("commander");
            newDeck.cards.unshift(card);
        } else {
            console.log("not commander");
            newDeck.cards.push(card)
        }
    }

    return newDeck;
}