import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getToken } from "../account/AccountManagement";
import { WSS_URL } from "../../constants";
import { Link } from "react-router-dom";

interface WaitingPlayer {
    name: string;
}

export default function Waiting() {
    const { lobbyId } = useParams<{ lobbyId: string }>();
    const navigate = useNavigate();
    const token = getToken();

    const [players, setPlayers] = useState<WaitingPlayer[]>([]);
    const [isCreator, setIsCreator] = useState(false);
    const [status, setStatus] = useState<"connecting" | "waiting" | "starting" | "error" | "rejected_started">("connecting");
    const [copied, setCopied] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!lobbyId || !token) {
            navigate("/");
            return;
        }

        const ws = new WebSocket(`wss://${WSS_URL}/ws/waiting/${lobbyId}/${token}`);
        wsRef.current = ws;

        ws.onopen = () => setStatus("waiting");

        ws.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data);
                if (msg.type === "welcome") {
                    setIsCreator(msg.is_creator === true);
                } else if (msg.type === "waiting_update") {
                    setPlayers(msg.players ?? []);
                } else if (msg.type === "game_started") {
                    setStatus("starting");
                    navigate(`/mat/${lobbyId}`);
                } else if (msg.type === "rejected") {
                    if (msg.reason === "game_started") {
                        setStatus("rejected_started");
                    } else {
                        setStatus("error");
                    }
                }
            } catch {
                // ignore non-JSON
            }
        };

        ws.onerror = () => setStatus("error");
        ws.onclose = () => {
            // If we navigated away intentionally, this fires too — that's fine
        };

        return () => ws.close();
    }, [lobbyId, token]);

    function startGame() {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: "start_game" }));
    }

    function copyLobbyId() {
        if (!lobbyId) return;
        navigator.clipboard.writeText(lobbyId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    if (!token) {
        return (
            <div className="text-white text-center mt-24">
                <p className="text-xl">You must be logged in to join a game.</p>
                <Link to="/account/auth" className="text-[#ce11c2] underline mt-3 block">Sign in</Link>
            </div>
        );
    }

    return (
        <div className="text-white text-center mt-16 px-4">
            <h1 className="text-4xl font-bold mb-2">Waiting Room</h1>

            {/* Lobby ID copy bar */}
            <div className="flex items-center justify-center gap-3 mb-8">
                <span className="text-[#aaa] text-sm font-mono bg-[#1a1a1a] px-4 py-1 rounded-lg">
                    {lobbyId}
                </span>
                <button
                    onClick={copyLobbyId}
                    className="text-sm bg-[#333] hover:bg-[#444] px-3 py-1 rounded-lg transition"
                >
                    {copied ? "Copied!" : "Copy ID"}
                </button>
            </div>

            <div className="bg-[#1e1e1e] rounded-2xl w-80 m-auto p-6">
                <h2 className="text-lg font-semibold mb-4 text-[#aaa]">
                    Players ({players.length})
                </h2>

                {status === "connecting" && (
                    <p className="text-[#555] text-sm">Connecting…</p>
                )}
                {status === "error" && (
                    <p className="text-red-400 text-sm">Connection failed. The lobby may not exist.</p>
                )}
                {status === "rejected_started" && (
                    <div className="text-center">
                        <p className="text-yellow-400 text-sm font-semibold mb-2">This game has already started.</p>
                        <p className="text-[#888] text-xs mb-4">New players cannot join once the game has begun.</p>
                        <button
                            onClick={() => navigate("/lobby")}
                            className="bg-[#333] hover:bg-[#444] rounded-lg px-4 py-2 text-sm transition"
                        >
                            Back to Lobby
                        </button>
                    </div>
                )}

                <ul className="mb-6 space-y-2">
                    {players.map((p, i) => (
                        <li
                            key={i}
                            className="bg-[#2a2a2a] rounded-lg px-4 py-2 text-sm text-left"
                        >
                            {p.name}
                            {i === 0 && <span className="text-[#ce11c2] mr-2"> (Host)</span>}
                        </li>
                    ))}
                    {players.length === 0 && status === "waiting" && (
                        <li className="text-[#555] text-sm">No players yet…</li>
                    )}
                </ul>

                {isCreator ? (
                    <button
                        onClick={startGame}
                        disabled={players.length === 0 || status !== "waiting"}
                        className="w-full bg-(--main-color) rounded-xl px-6 py-3 text-lg font-semibold hover:opacity-80 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Start Game
                    </button>
                ) : (
                    <p className="text-[#888] text-sm">Waiting for the host to start the game…</p>
                )}
            </div>
        </div>
    );
}
