import type { Deck } from "../types";

interface ViewDeckProps {
  deck: Deck | null;
}

let location = window.location.href;

let deckPos = location.indexOf("deck");

location = location.substring(0, deckPos);

function ViewDeck( {deck }: ViewDeckProps) {
    if (!deck) {
        return <p className="text-white text-center mt-5 bg-[#333333] w-fit m-auto p-2 rounded-2xl">No deck loaded yet</p>;
    }

    return (
        <div className="*:text-white bg-[#333333] rounded-4xl w-7/8 m-auto mt-5 grid grid-cols-3 *:text-sm">
            {deck && deck.cards.length > 0 && (
                <>
                    {/* First card in its own row centered */}
                    <div className="card text-center ml-auto mr-auto mt-5" key={deck?.cards[0].id}>
                        <div className="bg-black p-3 rounded-2xl">
                            <h4>
                                <b>{deck?.cards[0].display_name ?? deck?.cards[0].name}</b>
                            </h4>
                            <img
                                className="w-50 rounded-xl"
                                src={location + deck?.cards[0].url}
                                alt={"Image of: " + (deck?.cards[0].display_name ?? deck?.cards[0].name)}
                            />
                        </div>
                    </div>

                    <div className="cards-grid grid grid-cols-5 gap-4 bg-black m-4 rounded-xl p-2 col-span-2">
                        {deck?.cards.slice(1).map(card => (
                            <div key={card.id} className="card bg-[#333333] p-2 rounded-xl">
                                <div className="container">
                                    <h4>
                                        <b>{card.card_amount} {card.display_name ?? card.name}</b>
                                    </h4>
                                    {/* <img
                      src={location + card.url}
                      alt={"Image of: " + (card.display_name ?? card.name)}
                    /> */}
                                    {/* <p>Set: {card.set_id ?? "Unknown"} </p>
                    <p>ID: {card.id ?? "Unknown"}</p> */}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>)
}

export default ViewDeck;