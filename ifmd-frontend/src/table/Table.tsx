import { useEffect, useState } from "react";

export function Table() {
    const [messages, setMessages] = useState([]);
    const [ws, setWs] = useState(null);
    const [message, setMessage] = useState('');
    const [clientId, setClientId] = useState('');

        useEffect(() => {
        const websocket = new WebSocket('ws://127.0.0.1:3000/ws/join/123');

        websocket.onopen = () => {
            console.log('WebSocket is connected');
            // Generate a unique client ID
            const id = Math.floor(Math.random() * 1000);
            setClientId(id);
        };

        websocket.onmessage = (evt) => {
            const message = (evt.data);
            setMessages((prevMessages) =>
                [...prevMessages, message]);
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
                clientId: clientId
            }));
            setMessage('');
        }
    };

    const handleInputChange = (event) => {
        setMessage(event.target.value);
    };

    return (
        <div className="*:text-white">
            <h1>
                Real-time Updates with WebSockets
                and React Hooks - Client {clientId}
            </h1>
            {messages.map((message, index) =>
                <p key={index}>{JSON.parse(message)["clientId"]}: {JSON.parse(message)["payload"]}</p>)}
            <input type="text" className="border-white border-2
            " value={message}
                onChange={handleInputChange} />
            <button onClick={sendMessage}>
                Send Message
            </button>
        </div>
    );
}