import { useEffect, useState } from "react";
import type { Deck } from "../types";
import Cookies from "js-cookie";
import { useParams } from "react-router-dom";
import { getDeckList, sortCommanderFirst } from "./BuildDeck";
import { Link } from "react-router-dom";
import { WSS_URL } from "../constants";
import { useCardImages } from "../hooks/useCardImages";
import NavBar from "../home/NavBar";
import { useCommanderImages } from "../hooks/useCommanderImages";
import { deleteDeck } from "./DeleteDeck";

interface ViewDeckProps {
    deck: Deck | null;
    showNav: boolean;
}

let location = window.location.href;

let deckPos = location.indexOf("deck");

location = location.substring(0, deckPos);

export function ViewDeck({ deck, showNav = true }: ViewDeckProps) {
    if (!deck) {
        return <p className="text-white text-center mt-5 bg-[#333333] w-fit m-auto p-2 rounded-2xl">No deck loaded yet</p>;
    }

    deck = sortCommanderFirst(deck, true);

    const cardImages = useCardImages(deck?.cards.map(c => c.id) ?? []);

    return (
        <>
            {showNav ?
                <NavBar /> : <></>}
            <div className="*:text-white bg-[rgb(51,51,51)] rounded-4xl w-7/8 m-auto mt-5 grid grid-cols-3 *:text-sm">
                {deck && deck.cards.length > 0 && (
                    <>
                        {/* First card in its own row centered */}
                        <div className="card text-center ml-auto mr-auto mt-5" key={deck?.cards[0].id}>
                            <div className="bg-black p-3 rounded-2xl overflow-hidden">
                                <h4 className="mb-2">
                                    <b>{deck?.cards[0].display_name ?? deck?.cards[0].name}</b>
                                </h4>
                                <img
                                    className="w-75 rounded-xl mx-auto"
                                    src={cardImages[deck?.cards[0].id]}
                                    alt={"Image of: " + (deck?.cards[0].display_name ?? deck?.cards[0].name)}
                                />
                            </div>
                        </div>

                        <div className="cards-grid grid grid-cols-5 gap-4 bg-black m-4 rounded-xl p-2 col-span-2">
                            {deck?.cards.slice(1).map(card => (
                                <div key={card.id} className="card bg-[#333333] p-2 rounded-xl flex flex-col items-center">
                                    <img
                                        className="w-full rounded-lg mb-1"
                                        src={cardImages[card.id]}
                                        alt={"Image of: " + (card.display_name ?? card.name)}
                                    />
                                    <h4 className="text-center text-xs">
                                        <b>{`${card.card_amount}x `}{card.display_name ?? card.name}</b>
                                    </h4>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </>
    )
}

export function ViewUserDecks() {
    // State for storing the user decks
    const [deckIDs, setDeckIDs] = useState<Array<[string, string]> | null>(null);


    let commanderImages = useCommanderImages(deckIDs?.map(c => c[0]) ?? []);

    async function getDecks() {
        try {
            const token = Cookies.get("token");

            if (!token) {
                return;
            }

            const response = await fetch(
                `https://${WSS_URL}/api/decks/get/${encodeURIComponent(token)}`
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

    async function handleDeleteDeck(deckID: string, deckName: string) {
        const confirmed = window.confirm(`Delete deck "${deckName}"?`);

        if (!confirmed) {
            return;
        }

        const message = await deleteDeck(deckID);

        if (message.toLowerCase().includes("deleted")) {
            setDeckIDs((currentDecks) => currentDecks?.filter(([id]) => id !== deckID) ?? null);
        } else {
            window.alert(message);
        }
    }

    const decks = deckIDs?.map((deck) => (
        <div key={deck[0]} className="pb-2">
            <Link to={`/deck/view/${deck[0]}`} className="group relative flex flex-col items-start overflow-hidden rounded-3xl shadow-lg">
                <img
                    src={commanderImages[deck[0]]}
                    className="w-40 object-cover rounded-3xl"
                    alt={`${deck[1]} commander`}
                />
                <div className="absolute inset-x-2 bottom-2 rounded-full border border-white/40 bg-black/60 px-3 py-2 text-left backdrop-blur-[1px] transition-all duration-200 group-hover:bottom-9">
                    <p className="text-sm font-semibold text-white">{deck[1]}</p>
                </div>
                <button
                    type="button"
                    onClick={(event) => {
                        event.preventDefault();
                        void handleDeleteDeck(deck[0], deck[1]);
                    }}
                    aria-label={`Delete ${deck[1]}`}
                    className="absolute left-2 bottom-2 z-10 hidden rounded-md bg-black/70 px-2 py-1 group-hover:block"
                >
                    <img src="delete.png" className="w-4" alt="Delete deck" />
                </button>
            </Link>
        </div>
    ));

    return (
        <>
            <NavBar />
            <h1 className="text-white text-center text-5xl mt-5">Your Decks</h1>

            <div className="m-auto mt-70 bg-[#333333] w-fit p-3 align-middle rounded-2xl justify-center flex flex-wrap grid-cols-3 gap-2">
                {
                    (decks?.length ?? 0) > 0 ? decks : <p className="text-center text-white">No Decks Registered to your Account<br />Register one <Link to={"/deck/create"}>Here</Link></p>
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
        getDeckList(id).then((deck) => setDeck(deck));
    }, [])

    return (<>
        <ViewDeck deck={deck} showNav={true} /></>)
}
