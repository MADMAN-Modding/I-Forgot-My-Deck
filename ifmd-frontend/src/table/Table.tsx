import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import type { PlayerData, PlayedCard } from "../types";
import { CardLightbox } from "./components/CardLightbox";
import { WSS_URL } from "../../constants";
import { Link } from "react-router-dom";

interface PlayerEntry {
    clientId: string;
    data: PlayerData;
}

function cardImageUrl(url: string): string {
    if (!url) return "";
    return url.startsWith("http") ? url : `/${url}`;
}

export function Table() {
    const { lobbyId } = useParams<{ lobbyId: string }>();
    const [players, setPlayers] = useState<Record<string, PlayerEntry>>({});
    const [connected, setConnected] = useState(false);
    const [selected, setSelected] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        const ws = new WebSocket(`wss://${WSS_URL}/ws/join/${lobbyId}/TABLE`);

        ws.onopen = () => {
            console.log("TABLE connected to lobby", lobbyId);
            setConnected(true);
            // Ask all MAT clients to immediately re-send their state
            ws.send(JSON.stringify({ type: "table_joined" }));
        };

        ws.onmessage = (evt) => {
            const raw: string = evt.data;
            if (raw === "TABLE") return;

            try {
                const json = JSON.parse(raw);
                if (json.type === "data" && json.clientId && json.payload) {
                    setPlayers((prev) => ({
                        ...prev,
                        [json.clientId]: { clientId: json.clientId, data: json.payload },
                    }));
                }
            } catch {
                // ignore non-JSON messages
            }
        };

        ws.onclose = () => {
            console.log("TABLE disconnected");
            setConnected(false);
        };

        wsRef.current = ws;

        return () => {
            ws.close();
        };
    }, [lobbyId]);

    const playerList = Object.values(players);

    return (
        <div className="text-white min-h-screen bg-[#111] p-4">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                {selected ? (
                    <button
                        onClick={() => setSelected(null)}
                        className="bg-[#444] rounded-lg px-3 py-1 text-sm hover:bg-[#555] transition"
                    >
                        ← All Players
                    </button>
                ) : (
                    <Link
                        to="/lobby"
                        className="bg-[#444] rounded-lg px-3 py-1 text-sm hover:bg-[#555] transition"
                    >
                        ← Lobby
                    </Link>
                )}
                <h1 className="text-2xl font-bold">
                    Table View — Lobby:{" "}
                    <span className="font-mono">{lobbyId}</span>
                </h1>
                <span
                    className={`ml-auto text-sm px-2 py-1 rounded ${
                        connected ? "bg-green-800 text-green-200" : "bg-red-900 text-red-200"
                    }`}
                >
                    {connected ? "Connected" : "Disconnected"}
                </span>
            </div>

            {/* Waiting message */}
            {playerList.length === 0 && (
                <div className="text-center text-[#555] mt-20 text-xl">
                    Waiting for players to join...
                </div>
            )}

            {/* Detail view */}
            {selected && players[selected] && (
                <BoardDetail clientId={selected} data={players[selected].data} />
            )}

            {/* Player grid */}
            {!selected && (
                <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                    {playerList.map(({ clientId, data }) => (
                        <PlayerCard
                            key={clientId}
                            clientId={clientId}
                            data={data}
                            onClick={() => setSelected(clientId)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

interface PlayerCardProps {
    clientId: string;
    data: PlayerData;
    onClick: () => void;
}

function PlayerCard({ clientId: _clientId, data, onClick }: PlayerCardProps) {
    const commanderName = data.deck?.cards;

    return (
        <div
            className="bg-[#1e1e1e] border border-[#333] rounded-2xl overflow-hidden cursor-pointer hover:border-[#888] transition"
            onClick={onClick}
        >
            {/* Player header */}
            <div className="flex items-center gap-3 bg-[#2a2a2a] px-4 py-3">
                <div>
                    <p className="font-bold">{data.deck?.name ?? "Unknown Deck"}</p>
                    {commanderName && <p className="text-xs text-[#888]">{commanderName}</p>}
                    {data.deck?.owner && <p className="text-xs text-[#666]">{data.deck.owner}</p>}
                </div>
                <div className="ml-auto text-center">
                    <p className="text-4xl font-bold">{data.life}</p>
                    <p className="text-xs text-[#888]">life</p>
                </div>
            </div>

            {/* Commander damage */}
            {data.commander_damage?.length > 0 && (
                <div className="flex gap-2 px-4 py-2 bg-[#242424] text-sm">
                    <span className="text-[#888]">Cmdr dmg:</span>
                    {data.commander_damage.map((dmg, i) => (
                        <span key={i} className="text-white">
                            P{i + 1}: {dmg}
                        </span>
                    ))}
                </div>
            )}

            {/* Stats row */}
            <div className="flex gap-4 px-4 py-2 text-sm text-[#aaa]">
                <span>Hand: {data.hand?.cards?.length ?? 0}</span>
                <span>Board: {data.played_cards?.length ?? 0}</span>
            </div>
            <p className="text-xs text-[#555] px-4 pb-2">Click to view board</p>
        </div>
    );
}

function BoardDetail({ clientId: _clientId, data }: { clientId: string; data: PlayerData }) {
    const commanderName = data.deck?.cards;
    const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
    return (
        <div>
            {/* Header */}
            <div className="flex items-center gap-4 bg-[#2a2a2a] rounded-xl px-4 py-3 mb-4">
                <div>
                    <p className="font-bold text-xl">{data.deck?.name ?? "Unknown Deck"}</p>
                    {commanderName && <p className="text-sm text-[#888]">{commanderName}</p>}
                    {data.deck?.owner && <p className="text-sm text-[#666]">{data.deck.owner}</p>}
                </div>
                <div className="ml-auto text-center">
                    <p className="text-5xl font-bold">{data.life}</p>
                    <p className="text-xs text-[#888]">life</p>
                </div>
            </div>

            {/* Commander damage */}
            {data.commander_damage?.length > 0 && (
                <div className="flex gap-3 text-sm text-[#aaa] mb-4">
                    <span className="text-[#666]">Cmdr dmg:</span>
                    {data.commander_damage.map((d, i) => (
                        <span key={i}>P{i + 1}: <span className="text-white">{d}</span></span>
                    ))}
                </div>
            )}

            {/* Battlefield */}
            <p className="text-sm text-[#666] mb-2">
                Battlefield ({data.played_cards?.length ?? 0} cards)
            </p>
            {!data.played_cards || data.played_cards.length === 0 ? (
                <p className="text-[#444] text-sm mb-4">Nothing on the battlefield.</p>
            ) : (
                <div className="flex flex-wrap gap-3 mb-6">
                    {data.played_cards.map((pc: PlayedCard, i: number) => (
                        <div
                            key={i}
                            className="relative flex-shrink-0 overflow-visible"
                            style={{
                                height: "9rem",
                                transform: pc.tapped ? "rotate(90deg)" : "none",
                                transformOrigin: "center",
                            }}
                            title={pc.card.display_name ?? pc.card.name}
                            onDoubleClick={() => setLightbox({
                                src: cardImageUrl(pc.card.url),
                                alt: pc.card.display_name ?? pc.card.name,
                            })}
                        >
                            <img
                                src={cardImageUrl(pc.card.url)}
                                alt={pc.card.display_name ?? pc.card.name}
                                className="h-36 hover:h-[30rem] transition-[height] duration-200 ease-out rounded-xl shadow-lg relative"
                            />
                            {(pc.strength_mod !== 0 || pc.toughness_mod !== 0) && (
                                <div className="absolute bottom-0 right-0 bg-black text-white text-xs rounded px-1">
                                    {pc.strength_mod > 0 ? "+" : ""}{pc.strength_mod}/
                                    {pc.toughness_mod > 0 ? "+" : ""}{pc.toughness_mod}
                                </div>
                            )}
                            {pc.counters?.length > 0 && (
                                <div className="absolute top-0 left-0 bg-black text-white text-xs rounded px-1">
                                    {pc.counters.map((c) => `${c.amount}${c.name}`).join(" ")}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <p className="text-xs text-[#444] italic">
                Hand ({data.hand?.cards?.length ?? 0} cards) — hidden
            </p>
            {lightbox && (
                <CardLightbox
                    src={lightbox.src}
                    alt={lightbox.alt}
                    onClose={() => setLightbox(null)}
                />
            )}
        </div>
    );
}