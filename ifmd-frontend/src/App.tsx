import { useEffect, useState } from "react";
import type { Card } from "./types";
import "./App.css";

function App() {
  const [card, setCard] = useState<Card | null>(null);

  useEffect(() => {
    fetch("http://127.0.0.1:3000/api/cards/name/armageddon/6ed")
      .then((res) => {console.log(res); return res.json()})
      .then((data: Card) => setCard(data))
      .catch((error) => console.error("Error fetching card:", error));
  }, []);

  return (
    <div className="app">
      {card && (
        <div key={card.card_id} className="card">
          <div className="container">
            <h4>
              <b>{card.card_name ?? "Unknown"}</b>
            </h4>
            <img src={card.card_url} alt={"Image of: " + card.card_name} />
            <p>Set: {card.card_set ?? "Unknown"} </p>
            <p>ID: {card.card_id ?? "Unknown"}</p>
            <p>URL: {card.card_url ?? "Unknown"}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;