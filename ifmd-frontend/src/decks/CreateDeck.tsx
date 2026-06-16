
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Card, Deck } from "../types";
import { processDeck } from "./BuildDeck";
import { ViewDeck }  from "./ViewDeck";
import Cookies from "js-cookie";
import { WSS_URL } from "../constants";

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
  deck: string,
  name: string
}

function CreateDeck() {
  const navigate = useNavigate();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [deckList, setDeckList] = useState("");
  const [error, setError] = useState("");
  const [buildingDone, setBuildingDone] = useState<boolean | null>(null);
  const [uploadDeckState, setUploadDeckState] = useState("Upload")
  const [deckName, setDeckName] = useState('');

  async function uploadDeck({ deck, name }: UploadDeckData) {
    const token = Cookies.get("token");

    // No cookie cancel upload
    if (!token) {
      return;
    }

    try {
      const response = await fetch(
        `wss://${WSS_URL}/api/decks/add/${encodeURIComponent(deck)}/${encodeURIComponent(name)}/${encodeURIComponent(token)}`
      );

      if (response.ok) {
        setUploadDeckState("Uploaded");
        setTimeout(() => navigate("/"), 800);
      }
    } catch (err) {
      setUploadDeckState("Could not Upload")
      console.error(err);
    }


  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    setDeck(null)

    e.preventDefault();

    setError("");

    let processedDeck = processDeck(deckList)

    setBuildingDone(false);
    for (const c of processedDeck.cards) {
      try {
        const response = await fetch(`wss://${WSS_URL}/api/card/name/${encodeURIComponent(c.name)}/${c.set_id}`);

        const data = await response.json();

        let card: Card = {
          name: data["name"],
          display_name: data["display_name"],
          id: data["id"],
          url: data["url"],
          set_id: data["set_id"],
          card_amount: c.card_amount,
          is_commander: c.is_commander,
          is_two_faced: c.is_two_faced
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

  async function handleDeckSubmit(_: any) {
    setUploadDeckState("Uploading")
    let deckData = "";

    if (deck != null) {
      for (const card in deck.cards) {
        var cardStruct = deck.cards[card];

        deckData += `${cardStruct.id}:${cardStruct.card_amount}|${cardStruct.is_commander}\n`;
      }
    }

    uploadDeck({ deck: deckData, name: deckName })
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

      {buildingDone ? (
        <form className="m-auto *:text-white text-center" onSubmit={handleDeckSubmit}>
          <label htmlFor="deckName">Deck Name: </label>
          <input
            type="text"
            id="deckName"
            className="bg-(--main-color) rounded-xl pl-1 pr-1"
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            required
          />

          <p
            onClick={uploadDeckState === "Upload" ? handleDeckSubmit : undefined}
            className={`text-2xl ml-auto mr-auto text-white text-center w-fit p-1 mt-3 rounded-2xl ${
              uploadDeckState === "Upload"
                ? "hover:cursor-pointer bg-(--main-color)"
                : "cursor-not-allowed opacity-50 bg-[#555]"
            }`}
          >
            {uploadDeckState} Deck
          </p>
        </form>
      ) : <p></p>}

      <ViewDeck deck={deck} />
    </>
  );
}

export default CreateDeck;
