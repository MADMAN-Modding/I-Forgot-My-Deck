import { useEffect, useState } from "react";
import type { Deck } from "../types";
import Cookies from "js-cookie";
import { useParams } from "react-router-dom";
import { getDeckList, sortCommanderFirst } from "./BuildDeck";

interface ViewDeckProps {
    deck: Deck | null;
}

let location = window.location.href;

let deckPos = location.indexOf("deck");

location = location.substring(0, deckPos);

export function ViewDeck({ deck }: ViewDeckProps) {
    if (!deck) {
        return <p className="text-white text-center mt-5 bg-[#333333] w-fit m-auto p-2 rounded-2xl">No deck loaded yet</p>;
    }

    console.log("PreOrdered: " + deck.cards.length);

    deck = sortCommanderFirst(deck);

    console.log("Ordered: " + deck.cards.length);

    return (
        <div className="*:text-white bg-[rgb(51,51,51)] rounded-4xl w-7/8 m-auto mt-5 grid grid-cols-3 *:text-sm">
            {deck && deck.cards.length > 0 && (
                <>
                    {/* First card in its own row centered */}
                    <div className="card text-center ml-auto mr-auto mt-5" key={deck?.cards[0].id}>
                        <div className="bg-black p-3 rounded-2xl">
                            <h4>
                                <b>{deck?.cards[0].display_name ?? deck?.cards[0].name}</b>
                            </h4>
                            <img
                                className="w-75 rounded-2xl"
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
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>)
}

export function ViewUserDecks() {
    // State for storing the user decks
    const [deckIDs, setDeckIDs] = useState<[string] | null>(null);

    async function getDecks() {
        try {
            const token = Cookies.get("token");

            if (!token) {
                return;
            }

            const response = await fetch(
                `https://127.0.0.1:3000/api/decks/get/${encodeURIComponent(token)}`
            );

            let data = await response.json();

            if (response.ok) {
                setDeckIDs(data)
            }
        } catch (err) {
            console.error(err);
        }
    }

    // Call getDecks only once after the component has mounted
    useEffect(() => {
        getDecks();
    }, []);

    const decks = deckIDs?.map((deck) => <a href={`${deck[0]}`} key={`${deck[0]}`}><p className="text-white bg-black rounded-2xl pl-3 pr-3 mb-2 hover:cursor-pointer" key={deck[0]}>{deck[1]}</p></a>)

    return (
        <>
            <h1 className="text-white text-center text-5xl mt-5">Your Decks</h1>

            <div className="m-auto mt-70 bg-[#333333] w-fit p-3 align-middle rounded-2xl">
                {
                    decks
                }
            </div>
        </>
    )
}

export function ViewDeckFromID() {
    const { id } = useParams<string>();
    const [deck, setDeck] = useState<any | null>(null);

    if (id == null) return;

    useEffect(() => {
        getDeckList(id).then((deck) => {console.log(deck); setDeck(deck)});

        console.log(deck);
    }, [])

    return (<>
        <ViewDeck deck={deck} /></>)
}
