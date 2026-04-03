import { useEffect, useState } from "react";
import type { PlayerData, Hand, Card, PlayedCard, UserDeck } from "../types";
import { getDeckList } from "../decks/BuildDeck";
import { playerDataJSON } from "./PlayerData";

export function Mat() {
    const [messages, setMessages] = useState([]);
    const [ws, setWs] = useState(null);
    const [message, setMessage] = useState('');
    const [clientID, setClientID] = useState('');
    const [playerData, setPlayerData] = useState<PlayerData>();

        useEffect(() => {
        const websocket = new WebSocket('wss://127.0.0.1:3000/ws/join/123/MAT');

        websocket.onopen = async () => {
            console.log('WebSocket is connected');
            
            const id = "madman-modding";
            setClientID(id);

            const playerData = await setupPlayerData(id);
            setPlayerData(playerData);

            if (playerData) {
                let json = {"type" : "data", "payload" : playerDataJSON(playerData)};

                websocket.send(JSON.stringify(json));
            } else {
                console.log("Player data not set yet");
            }
        };

        websocket.onmessage = (evt) => {
            const message = (evt.data);

            const json = JSON.parse(message);
            
            if (json["type"] == "message") {
            setMessages((prevMessages) =>
                [...prevMessages, message]);
        }
        };

        websocket.onclose = () => {
            console.log('WebSocket is closed');
        };

        setWs(websocket);

        return () => {
            websocket.close();
        };
    }, []);


    const sendMessage = () => {
        if (ws) {
            ws.send(JSON.stringify({
                type: 'message',
                payload: message,
                clientId: clientID
            }));
            setMessage('');
        }
    };

    const handleInputChange = (event) => {
        if (event.target.value["type"] == "message") {
            setMessage(event.target.value);
        }
    };

    return (
        <div className="*:text-white">
            {messages.map((message, index) =>
                <p key={index}>{message}</p>)}
            <input type="text" className="border-white border-2
            " value={message}
                onChange={handleInputChange} />
            <button onClick={sendMessage}>
                Send Message
            </button>
        </div>
    );
}

function setupHand()  {
    var cards: Array<Card> = [];

    var hand: Hand = ({cards})

    return hand;
}

async function setupPlayerData(id) {
    const hand = setupHand();

    const playedCards: Array<PlayedCard> = [];

    const life = 40;

    const commanderDamage: Array<number> = [];

    const deck_id = "3b0fc37f-11d2-4030-8e8d-a9100d63026d";
    
    const cards = await getDeckList(deck_id);

    const deckName = "Reality Chip"

    const userDeck: UserDeck = ({id: deck_id, name: deckName, cards: cards, owner: id});

    const playerData: PlayerData= ({hand: hand, played_cards: playedCards, life: life, commander_damage: commanderDamage, deck: userDeck});
    
    return playerData;
}