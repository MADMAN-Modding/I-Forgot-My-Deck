
import { useState } from "react";
import type { Card, Deck } from "../types";
import { processDeck } from "./buildDeck";

interface CardGetFormProps {
  deck: string;
  setDeck: (value: string) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

function CardGetForm({ deck, setDeck, handleSubmit }: CardGetFormProps) {
  return (
    <>
      <h1 className="text-white text-center font-bold mt-4 text-4xl">Create your deck here!</h1>

      <div className="mt-5 flex flex-wrap *:text-white">
        <div>
          <p>Paste in your deck from Moxfield here!</p>
          <p>Use Moxfield format</p>
        </div>
        <div className="mt-4 flex flex-wrap w-2/3 m-auto rounded-2xl">

          <form onSubmit={handleSubmit}>
            <label>
              <textarea
                className="bg-(--main-color) rounded-2xl"
                value={deck}
                onChange={(e) => setDeck(e.target.value)}
              />
            </label>

            <button type="submit">Search</button>
          </form>
        </div>
      </div>
    </>
  );
}

function CreateDeck() {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [deckList, setDeckList] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    setDeck(null)

    e.preventDefault();

    setError("");

    let processedDeck = processDeck(deckList)

    for (const c of processedDeck.cards) {
      try {
        const response = await fetch(`http://127.0.0.1:3000/api/card/name/${encodeURIComponent(c.name)}/${c.set_id}`);

        const data = await response.json();

        let card: Card = {
          name: data["name"],
          display_name: data["display_name"],
          id: data["id"],
          url: data["url"],
          set_id: data["set_id"],
          card_amount: c.card_amount
        }

        setDeck(prevDeck => {
          if (!prevDeck) return { cards: [card] };
          return { cards: [...prevDeck.cards, card] };
        });

      } catch (err: any) {
        setError(err.message);
      }
    }
  }

  let location = window.location.href;

  let deckPos = location.indexOf("deck");

  location = location.substring(0, deckPos);

  return (
    <>
      <CardGetForm
        deck={deckList}
        setDeck={setDeckList}
        handleSubmit={handleSubmit}
      />

      {error && <p style={{ color: "red" }}>{error}</p>}

      <div className="*:text-white bg-[#333333] rounded-4xl w-7/8 m-auto mt-5 grid grid-cols-3">
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

            <div className="cards-grid grid grid-cols-4 gap-4 bg-black m-4 rounded-xl p-2 col-span-2">
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
      </div>
    </>
  );
}

export default CreateDeck;
