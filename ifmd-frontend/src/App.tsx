import { useState } from "react";
import type { Card } from "./types";
import "./App.css";

function CardGetForm({ name, setName, id, setId, handleSubmit }) {
  return (
    <form onSubmit={handleSubmit}>
      <label>
        Enter card name:
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <label>
        Enter card ID:
        <input
          type="text"
          value={id}
          onChange={(e) => setId(e.target.value)}
        />
      </label>

      <button type="submit">Search</button>
    </form>
  );
}

function App() {
  const [card, setCard] = useState<Card | null>(null);

  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`http://127.0.0.1:3000/api/card/name/${name}/${id}`);

      const data = await response.json();

      console.log(data)
      setCard(data);

    } catch (err: any) {
      setError(err.message);
      setCard(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <CardGetForm 
        name={name}
        setName={setName}
        id={id}
        setId={setId}
        handleSubmit={handleSubmit}
      />

      {loading && <p>Loading…</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      <div className="app">
        {card && (
          <div key={card.card_id} className="card">
            <div className="container">
              <h4>
                <b>{card.card_display_name ?? card.card_name}</b>
              </h4>
              <img src={card.card_url} alt={"Image of: " + (card.card_display_name ?? card.card_name)} />
              <p>Set: {card.card_set ?? "Unknown"} </p>
              <p>ID: {card.card_id ?? "Unknown"}</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default App;
