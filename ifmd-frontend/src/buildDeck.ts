import type { Deck, Card } from './types';
export function processDeck(fileData: string): Deck {
    const cards: Card[] = fileData
        .split('\n')
        .map(line => line.trimStart())
        .filter(line => line.length > 0)
        .map(line => {
            if (line != "SIDEBOARD:") {

                // Skip leading numbers (e.g., "2 Lightning Bolt")
                const afterCount = line.split(' ').slice(1).join(' ') || line;

                // Extract card name and optional set
                const [namePart, setPart] = afterCount.split('(');
                const cardName = namePart.trim().replace('//', '/').replace(/\//g, '//');
                const cardSet = setPart.trim().replace(')', '').toLowerCase().split(' ')[0];

                console.log(`${cardName}: ${cardSet}`)

                return {
                    name: cardName,
                    id: '',
                    url: '',
                    display_name: undefined,
                    set_id: cardSet,
                } as Card;
            }
            return undefined;
        })
        .filter((card): card is Card => card !== undefined);

    return { cards };
}
