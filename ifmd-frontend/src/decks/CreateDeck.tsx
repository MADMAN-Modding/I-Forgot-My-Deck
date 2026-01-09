
import React, { useState, type MouseEventHandler } from "react";
import type { Card, Deck } from "../types";
import { processDeck } from "./buildDeck";
import ViewDeck from "./ViewDeck";
import Cookies from "js-cookie";

interface CardGetFormProps {
  deck: string;
  setDeck: (value: string) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  show: boolean;
}

function CardGetForm({ deck, setDeck, handleSubmit, show }: CardGetFormProps) {
  if (show) {
    return (
      <>
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
    )
  } else {
    return (
      <></>
    )
  }
}

interface UploadDeckData {
  deck: String,
  name: String
}

async function uploadDeck({ deck, name }: UploadDeckData) {
  const token = Cookies.get("token");

  console.log(deck);
  console.log(name);
  console.log(token);

  // No cookies skip auth
  if (!token) {
    console.log("NO TOKEN!!!!")
    return;
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:3000/api/account/token/${token}`
    );

    const data = await response.json();


    if (response.ok) {
      console.log("WAHOO")
    } else {
      // Invalid token
      Cookies.remove("token");
    }
    console.log(data)
  } catch (err) {
    console.error(err);
    Cookies.remove("token");
  }


}

function CreateDeck() {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [deckList, setDeckList] = useState("");
  const [error, setError] = useState("");
  const [buildingDone, setBuildingDone] = useState<boolean | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    setDeck(null)

    e.preventDefault();

    setError("");

    let processedDeck = processDeck(deckList)

    setBuildingDone(false);
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

    setBuildingDone(true);
  }

  async function handleDeckSubmit(e: any) {
    let deckData = "{";

    for (const card in deck?.cards) {
      console.log(card.length)  
    }
  }

  return (
    <>
      <h1 className="text-white text-center font-bold mt-4 text-4xl">Create your deck here!</h1>

      <div className="text-center text-xl">
        {buildingDone != null ?
          buildingDone ?
            <h1 className="text-green-500">Deck Built!</h1>
            :
            <h1 className="text-[#333333]">Building Deck...</h1>
          :
          <h1></h1>
        }
      </div>
      <CardGetForm
        deck={deckList}
        setDeck={setDeckList}
        handleSubmit={handleSubmit}
        show={(buildingDone == null)}
      />

      {error && <p style={{ color: "red" }}>{error}</p>}

      <ViewDeck deck={deck} />


      <button type="submit" onClick={handleDeckSubmit}>Press me!</button>

    </>
  );
}

export default CreateDeck;
