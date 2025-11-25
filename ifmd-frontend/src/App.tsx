import { useState } from "react";
import type { Card, Deck } from "./types";
import "./App.css";
import { processDeck } from "./buildDeck";

interface CardGetFormProps {
  deck: string;
  setDeck: (value: string) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

function CardGetForm({ deck, setDeck, handleSubmit }: CardGetFormProps) {
  return (
    <form onSubmit={handleSubmit}>
      <label>
        <textarea
          value={deck}
          onChange={(e) => setDeck(e.target.value)}
        />
      </label>

      <button type="submit">Search</button>
    </form>
  );
}

function App() {
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

        console.log(data)

        let card: Card = {
          name: data["name"],
          display_name: data["display_name"],
          id: data["id"],
          url: data["url"],
          set_id: data["set_id"]
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

    <div className="app">
      {deck && deck.cards.length > 0 && (
        <>
          {/* First card in its own row centered */}
          <div className="card full-width centered" key={deck?.cards[0].id}>
            <div className="container">
              <h4>
                <b>{deck?.cards[0].display_name ?? deck?.cards[0].name}</b>
              </h4>
              <img
                src={deck?.cards[0].url}
                alt={"Image of: " + (deck?.cards[0].display_name ?? deck?.cards[0].name)}
              />
              <p>Set: {deck?.cards[0].set_id ?? "Unknown"} </p>
              <p>ID: {deck?.cards[0].id ?? "Unknown"}</p>
            </div>
          </div>

          {/* Remaining cards in rows of 3 */}
          <div className="cards-grid">
            {deck?.cards.slice(1).map(card => (
              <div key={card.id} className="card">
                <div className="container">
                  <h4>
                    <b>{card.display_name ?? card.name}</b>
                  </h4>
                  <img
                    src={card.url}
                    alt={"Image of: " + (card.display_name ?? card.name)}
                  />
                  <p>Set: {card.set_id ?? "Unknown"} </p>
                  <p>ID: {card.id ?? "Unknown"}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  </>
);
;
}

export default App;
