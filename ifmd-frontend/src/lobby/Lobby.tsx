import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getToken } from "../account/AccountManagement";

function Lobby() {
    const [lobbyId, setLobbyId] = useState("");
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    async function createGame() {
        const token = getToken();
        if (!token) { setError("You must be logged in to create a game."); return; }
        setCreating(true);
        setError("");
        const id = crypto.randomUUID();
        try {
            const res = await fetch(
                `https://127.0.0.1:3000/api/lobby/create/${encodeURIComponent(id)}/${encodeURIComponent(token)}`
            );
            if (!res.ok) {
                const body = await res.json();
                setError(body.error ?? "Failed to create lobby.");
                setCreating(false);
                return;
            }
        } catch {
            setError("Could not reach the server.");
            setCreating(false);
            return;
        }
        navigate(`/waiting/${id}`);
    }

    function joinAsPlayer() {
        const id = lobbyId.trim();
        if (id) navigate(`/waiting/${id}`);
    }

    function joinAsTable() {
        const id = lobbyId.trim();
        if (id) navigate(`/table/${id}`);
    }

    function joinAsMaster() {
        const id = lobbyId.trim();
        if (id) navigate(`/master/${id}`);
    }

    return (
        <div className="text-white text-center mt-16">
            <h1 className="text-5xl font-bold mb-10">Game Lobby</h1>

            {error && <p className="text-red-400 mb-4 text-sm">{error}</p>}

            {/* Create a new game */}
            <div className="bg-[#333333] rounded-2xl w-fit m-auto p-8 mb-6">
                <h2 className="text-xl font-semibold mb-4">Start a New Game</h2>
                <button
                    onClick={createGame}
                    disabled={creating}
                    className="bg-(--main-color) rounded-xl px-6 py-3 text-lg hover:opacity-80 transition disabled:opacity-50"
                >
                    {creating ? "Creating…" : "Create Game"}
                </button>
                <p className="text-[#aaa] text-sm mt-3">
                    A lobby ID will be generated — share it with friends to join.
                </p>
            </div>

            {/* Join an existing game */}
            <div className="bg-[#333333] rounded-2xl w-fit m-auto p-8 flex flex-col gap-6">
                <h2 className="text-xl font-semibold">Join an Existing Game</h2>
                <div>
                    <label className="text-sm block mb-2 text-[#aaa]">Lobby ID</label>
                    <input
                        type="text"
                        value={lobbyId}
                        onChange={(e) => setLobbyId(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && joinAsPlayer()}
                        className="bg-(--main-color) rounded-xl p-2 text-white text-center w-72"
                        placeholder="Paste lobby ID here..."
                    />
                </div>
                <div className="flex gap-4 justify-center">
                    <button
                        onClick={joinAsPlayer}
                        disabled={!lobbyId.trim()}
                        className="bg-(--main-color) rounded-xl px-5 py-3 hover:opacity-80 transition disabled:opacity-40"
                    >
                        Join as Player
                    </button>
                    <button
                        onClick={joinAsTable}
                        disabled={!lobbyId.trim()}
                        className="bg-[#555] rounded-xl px-5 py-3 hover:opacity-80 transition disabled:opacity-40"
                    >
                        Watch (Table View)
                    </button>
                    <button
                        onClick={joinAsMaster}
                        disabled={!lobbyId.trim()}
                        className="bg-[#2a3a2a] rounded-xl px-5 py-3 hover:opacity-80 transition disabled:opacity-40"
                        title="Shows all player boards scaled down on one screen"
                    >
                        Master View
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Lobby;
