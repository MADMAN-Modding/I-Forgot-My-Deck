
import { useState } from "react";
import type { Card, Deck } from "../types";
import { processDeck } from "./buildDeck";
import ViewDeck from "./ViewDeck";

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

  return (
    <>
      <CardGetForm
        deck={deckList}
        setDeck={setDeckList}
        handleSubmit={handleSubmit}
      />

      {error && <p style={{ color: "red" }}>{error}</p>}
    
      <ViewDeck deck={deck}
      />
    </>
  );
}

export default CreateDeck;
