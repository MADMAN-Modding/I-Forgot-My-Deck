import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import type { PlayerData, PlayedCard, Card } from "../types";
import { WSS_URL } from "../constants";
import { Link } from "react-router-dom";
import { getCardImage } from "../ImageHandling";
import { CardLightbox } from "./components/CardLightbox";
// NOTE: adjust this path if MasterTable.tsx does not live alongside the
// "components" folder used by Mat.tsx — it should point at the same
// CardLightbox component imported there.

interface PlayerEntry {
    clientId: string;
    data: PlayerData;
}

// Default assumed battlefield size when the MAT doesn't report a viewport
const DEFAULT_BF_WIDTH = 1200;
const DEFAULT_BF_HEIGHT = 600;
// Original card height sent by MAT (h-28 = 112px)
const CARD_HEIGHT_PX = 112;

function computeGrid(n: number): [number, number] {
    if (n <= 1) return [1, 1];
    if (n <= 2) return [2, 1];
    if (n <= 4) return [2, 2];
    if (n <= 6) return [3, 2];
    return [4, 2];
}

interface PlayerBoardProps {
    entry: PlayerEntry;
    cellWidth: number;
    cellHeight: number;
    isEnlarged: boolean;
    onToggleEnlarge: (clientId: string) => void;
    onCardClick: (src: string, alt: string) => void;
}

function PlayerBoard({ entry, cellWidth, cellHeight, isEnlarged, onToggleEnlarge, onCardClick }: PlayerBoardProps) {
    const { data } = entry;
    const vp = data.viewport ?? { width: DEFAULT_BF_WIDTH, height: DEFAULT_BF_HEIGHT };

    // Leave room at top for the player header bar (40px)
    const headerH = 40;
    const boardH = cellHeight - headerH;

    const scaleX = cellWidth / vp.width;
    const scaleY = boardH / vp.height;
    const scale = Math.min(scaleX, scaleY);

    const scaledCardH = Math.max(24, CARD_HEIGHT_PX * scale);
    // card aspect ratio ~63:88; width ≈ height * 0.716
    const scaledCardW = scaledCardH * 0.716;

    // Image cache
    const [imageCache, setImageCache] = useState<Record<string, string>>({});
    const imageCacheRef = useRef<Record<string, string>>({});
    function cardImageUrl(card: Card, showFront = true): string {
        const key = `${card.id}_${showFront}`;
        if (!(key in imageCache)) {
            if (card.is_two_faced || showFront) {
                prefetchImage(card.id, showFront);
            }
            return "CardBack.png"; // placeholder on first render
        }
        return imageCache[key];
    }


    function prefetchImage(id: string, front = true) {
        const key = `${id}_${front}`;
        if (key in imageCacheRef.current) return; // already fetching or done
        imageCacheRef.current[key] = ""; // mark as in-flight
        getCardImage(id, front).then((url) => {
            imageCacheRef.current[key] = url;
            setImageCache((prev) => ({ ...prev, [key]: url }));
        });
    }

    return (
        <div
            className={`flex flex-col bg-[#0f1f0f] border overflow-hidden cursor-pointer transition-[border-color] ${
                isEnlarged ? "border-[#4a8a4a]" : "border-[#2a4a2a] hover:border-[#3a6a3a]"
            }`}
            style={{ width: cellWidth, height: cellHeight, flexShrink: 0 }}
            onClick={() => onToggleEnlarge(entry.clientId)}
            title={isEnlarged ? "Click to restore grid view" : "Click to enlarge"}
        >
            {/* Header */}
            <div
                className="flex items-center gap-2 bg-[#1a2a1a] px-2 flex-shrink-0 overflow-hidden"
                style={{ height: headerH }}
            >
                <span className="font-bold text-xs truncate flex-1">
                    {data.deck?.owner || data.deck?.name || "Player"}
                </span>
                {data.deck?.cards && (
                    <span className="text-[#888] text-xs truncate max-w-[6rem] hidden sm:block">
                        {data.deck.cards}
                    </span>
                )}
                <span className="text-white font-bold text-sm flex-shrink-0 ml-auto">
                    {data.life}♥
                </span>
                <button
                    type="button"
                    className="flex-shrink-0 text-[#888] hover:text-white text-xs bg-[#222] hover:bg-[#333] rounded px-1.5 py-0.5 leading-none transition"
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleEnlarge(entry.clientId);
                    }}
                    aria-label={isEnlarged ? "Shrink board" : "Enlarge board"}
                >
                    {isEnlarged ? "⤡" : "⤢"}
                </button>
            </div>

            {/* Battlefield canvas */}
            <div className="relative flex-1 overflow-hidden">
                {(!data.played_cards || data.played_cards.length === 0) && (
                    <span className="absolute inset-0 flex items-center justify-center text-[#2a4a2a] text-xs">
                        Empty
                    </span>
                )}
                {data.played_cards?.map((pc: PlayedCard, i: number) => {
                    const x = pc.location[0] * scale;
                    const y = pc.location[1] * scale;
                    return (
                        <div
                            key={i}
                            className="absolute cursor-pointer"
                            style={{
                                left: x,
                                top: y,
                                width: scaledCardW,
                                height: scaledCardH,
                                transform: pc.tapped ? "rotate(90deg)" : "none",
                                transformOrigin: "center",
                            }}
                            title={pc.card.display_name ?? pc.card.name}
                            onClick={(e) => {
                                // Stop the click from also toggling the board's enlarge state
                                e.stopPropagation();
                                onCardClick(
                                    cardImageUrl(pc.card, pc.show_front),
                                    pc.card.display_name ?? pc.card.name,
                                );
                            }}
                        >
                            <img
                                src={cardImageUrl(pc.card, pc.show_front)}
                                alt={pc.card.display_name ?? pc.card.name}
                                style={{ width: scaledCardW, height: scaledCardH, borderRadius: scaledCardH * 0.07 }}
                                className="object-cover shadow"
                                draggable={false}
                            />
                            {(pc.strength_mod !== 0 || pc.toughness_mod !== 0) && (
                                <div
                                    className="absolute bottom-0 right-0 bg-black/80 text-white rounded"
                                    style={{ fontSize: Math.max(8, 10 * scale), padding: "0 2px" }}
                                >
                                    {pc.strength_mod > 0 ? "+" : ""}{pc.strength_mod}/{pc.toughness_mod > 0 ? "+" : ""}{pc.toughness_mod}
                                </div>
                            )}
                            {pc.counters?.length > 0 && (
                                <div
                                    className="absolute top-0 left-0 bg-black/80 text-white rounded"
                                    style={{ fontSize: Math.max(8, 10 * scale), padding: "0 2px" }}
                                >
                                    {pc.counters.map((c) => `${c.amount}${c.name}`).join(" ")}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function MasterTable() {
    const { lobbyId } = useParams<{ lobbyId: string }>();
    const [players, setPlayers] = useState<Record<string, PlayerEntry>>({});
    const [connected, setConnected] = useState(false);
    const [enlargedId, setEnlargedId] = useState<string | null>(null);
    const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ width: window.innerWidth, height: window.innerHeight });

    // Track container size for responsive scaling
    useEffect(() => {
        function onResize() {
            if (containerRef.current) {
                const r = containerRef.current.getBoundingClientRect();
                setContainerSize({ width: r.width, height: r.height });
            }
        }
        window.addEventListener("resize", onResize);
        onResize();
        return () => window.removeEventListener("resize", onResize);
    }, []);

    useEffect(() => {
        const ws = new WebSocket(`wss://${WSS_URL}/ws/join/${lobbyId}/TABLE`);

        ws.onopen = () => {
            setConnected(true);
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
                // ignore
            }
        };

        ws.onclose = () => setConnected(false);
        wsRef.current = ws;
        return () => ws.close();
    }, [lobbyId]);

    // If the enlarged player disconnects/leaves, fall back to grid view
    useEffect(() => {
        if (enlargedId && !players[enlargedId]) {
            setEnlargedId(null);
        }
    }, [players, enlargedId]);

    // Escape key restores the grid view
    useEffect(() => {
        if (!enlargedId) return;
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") setEnlargedId(null);
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [enlargedId]);

    function handleToggleEnlarge(clientId: string) {
        setEnlargedId((prev) => (prev === clientId ? null : clientId));
    }

    function handleCardClick(src: string, alt: string) {
        setLightbox({ src, alt });
    }

    const playerList = Object.values(players);
    const n = playerList.length;
    const [cols, rows] = computeGrid(n);

    // Each cell fills available space
    const headerBarH = 44; // top bar height in px
    const availW = containerSize.width;
    const availH = Math.max(100, containerSize.height - headerBarH);

    const enlargedEntry = enlargedId ? players[enlargedId] : null;

    // Normal grid cell sizing
    const cellW = Math.floor(availW / cols);
    const cellH = Math.floor(availH / rows);

    return (
        <div className="text-white bg-[#0a0a0a] flex flex-col" style={{ height: "100vh", overflow: "hidden" }}>
            {/* Header bar */}
            <div className="flex items-center gap-4 bg-[#111] px-4 flex-shrink-0 border-b border-[#222]" style={{ height: headerBarH }}>
                <Link
                    to="/lobby"
                    className="bg-[#333] rounded-lg px-3 py-1 text-sm hover:bg-[#444] transition"
                >
                    ← Lobby
                </Link>
                <h1 className="text-base font-bold">
                    Master View — <span className="font-mono text-sm">{lobbyId}</span>
                </h1>
                {enlargedEntry && (
                    <button
                        type="button"
                        onClick={() => setEnlargedId(null)}
                        className="bg-[#2a4a2a] hover:bg-[#3a5a3a] rounded-lg px-3 py-1 text-sm transition"
                    >
                        ⤡ Back to grid
                    </button>
                )}
                <span
                    className={`ml-auto text-xs px-2 py-1 rounded ${connected ? "bg-green-800 text-green-200" : "bg-red-900 text-red-200"
                        }`}
                >
                    {connected ? "Live" : "Disconnected"}
                </span>
                <span className="text-[#666] text-xs">{n} player{n !== 1 ? "s" : ""}</span>
            </div>

            {/* Grid or enlarged single view */}
            {enlargedEntry ? (
                <div
                    ref={containerRef}
                    className="flex-1 overflow-hidden flex items-center justify-center"
                >
                    <PlayerBoard
                        key={enlargedEntry.clientId}
                        entry={enlargedEntry}
                        cellWidth={availW}
                        cellHeight={availH}
                        isEnlarged
                        onToggleEnlarge={handleToggleEnlarge}
                        onCardClick={handleCardClick}
                    />
                </div>
            ) : (
                <div
                    ref={containerRef}
                    className="flex-1 overflow-hidden"
                    style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${cellW}px)`, gridTemplateRows: `repeat(${rows}, ${cellH}px)` }}
                >
                    {playerList.length === 0 ? (
                        <div className="col-span-full row-span-full flex items-center justify-center text-[#444] text-xl">
                            Waiting for players to join…
                        </div>
                    ) : (
                        playerList.map(({ clientId, data }) => (
                            <PlayerBoard
                                key={clientId}
                                entry={{ clientId, data }}
                                cellWidth={cellW}
                                cellHeight={cellH}
                                isEnlarged={false}
                                onToggleEnlarge={handleToggleEnlarge}
                                onCardClick={handleCardClick}
                            />
                        ))
                    )}
                </div>
            )}

            {/* ── Card lightbox: click any card to enlarge it fullscreen ── */}
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