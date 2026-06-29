import { useEffect, useRef, useState } from "react";
import type { Card, PlayerData, PlayedCard } from "../../types";
import { CardLightbox } from "../components/CardLightbox";
import { getCardImage } from "../../ImageHandling";

interface MatMasterViewProps {
    lobbyId: string;
    players: Record<string, PlayerData>;
    selfId: string;
    selfData: PlayerData;
    onClose: () => void;
}

interface PlayerEntry {
    clientId: string;
    data: PlayerData;
}

const DEFAULT_BF_WIDTH = 1200;
const DEFAULT_BF_HEIGHT = 600;
const CARD_HEIGHT_PX = 112;

function computeGrid(n: number): [number, number] {
    if (n <= 1) return [1, 1];
    if (n <= 2) return [2, 1];
    if (n <= 4) return [2, 2];
    if (n <= 6) return [3, 2];
    return [4, 2];
}

function tokenBannerName(card: Card): string | null {
    if (!card.id.startsWith("token-")) return null;
    const raw = card.display_name ?? card.name;
    return raw.replace(/^Token\s*-\s*/i, "");
}

function tokenFrontStyle(card: Card, showFront = true) {
    if (!card.id.startsWith("token-") || !showFront) return undefined;
    return { filter: "brightness(0) invert(1)" };
}

function PlayerBoard({
    entry,
    cellWidth,
    cellHeight,
    isEnlarged,
    onToggleEnlarge,
    onCardClick,
}: {
    entry: PlayerEntry;
    cellWidth: number;
    cellHeight: number;
    isEnlarged: boolean;
    onToggleEnlarge: (clientId: string) => void;
    onCardClick: (src: string, alt: string) => void;
}) {
    const { data } = entry;
    const vp = data.viewport ?? { width: DEFAULT_BF_WIDTH, height: DEFAULT_BF_HEIGHT };

    const headerH = 40;
    const boardH = cellHeight - headerH;

    const scaleX = cellWidth / vp.width;
    const scaleY = boardH / vp.height;
    const scale = Math.min(scaleX, scaleY);

    const scaledCardH = Math.max(24, CARD_HEIGHT_PX * scale);
    const scaledCardW = scaledCardH * 0.716;

    const [imageCache, setImageCache] = useState<Record<string, string>>({});
    const imageCacheRef = useRef<Record<string, string>>({});

    function cardImageUrl(card: Card, showFront = true): string {
        const key = `${card.id}_${showFront}`;
        if (!(key in imageCache)) {
            if (card.is_two_faced || showFront) {
                prefetchImage(card.id, showFront);
            }
            return "CardBack.png";
        }
        return imageCache[key];
    }

    function prefetchImage(id: string, front = true) {
        const key = `${id}_${front}`;
        if (key in imageCacheRef.current) return;
        imageCacheRef.current[key] = "";
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

            <div className="relative flex-1 overflow-hidden">
                {(!data.played_cards || data.played_cards.length === 0) && (
                    <span className="absolute inset-0 flex items-center justify-center text-[#2a4a2a] text-xs">
                        Empty
                    </span>
                )}
                {(data.command_zone?.length ?? 0) > 0 && (
                    <div className="absolute left-1 top-1 z-20 bg-black/50 rounded p-1">
                        <div className="text-[10px] text-[#aaa] mb-1">CZ</div>
                        <div className="flex gap-1">
                            {data.command_zone?.map((pc, i) => (
                                <img
                                    key={`cz-${i}`}
                                    src={cardImageUrl(pc.card, pc.show_front)}
                                    alt={pc.card.display_name ?? pc.card.name}
                                    className="w-8 h-11 object-cover rounded"
                                />
                            ))}
                        </div>
                    </div>
                )}
                {data.revealed_library_top && (
                    <div className="absolute right-1 top-1 z-20 bg-black/50 rounded p-1">
                        <div className="text-[10px] text-[#aaa] mb-1">Top</div>
                        <img
                            src={cardImageUrl(data.revealed_library_top)}
                            alt={data.revealed_library_top.display_name ?? data.revealed_library_top.name}
                            className="w-8 h-11 object-cover rounded"
                        />
                    </div>
                )}
                {data.played_cards?.map((pc: PlayedCard, i: number) => {
                    const x = pc.location[0] * scale;
                    const y = pc.location[1] * scale;
                    const genericCount = pc.counters.find((c) => c.name === "Counter")?.amount ?? 0;
                    const namedCounters = pc.counters.filter((c) => c.name !== "Counter");
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
                                e.stopPropagation();
                                onCardClick(cardImageUrl(pc.card, pc.show_front), pc.card.display_name ?? pc.card.name);
                            }}
                        >
                            <img
                                src={cardImageUrl(pc.card, pc.show_front)}
                                alt={pc.card.display_name ?? pc.card.name}
                                style={{
                                    width: scaledCardW,
                                    height: scaledCardH,
                                    borderRadius: scaledCardH * 0.07,
                                    ...(tokenFrontStyle(pc.card, pc.show_front) ?? {}),
                                }}
                                className="object-cover shadow"
                                draggable={false}
                            />
                            {tokenBannerName(pc.card) && (
                                <div
                                    className="absolute top-0 left-0 right-0 bg-black/85 text-white text-center rounded-t"
                                    style={{ fontSize: Math.max(7, 9 * scale), padding: `${Math.max(1, scale)}px 2px` }}
                                >
                                    {tokenBannerName(pc.card)}
                                </div>
                            )}
                            {(pc.strength_mod !== 0 || pc.toughness_mod !== 0) && (
                                <div
                                    className="absolute bottom-0 right-0 bg-black/80 text-white rounded"
                                    style={{ fontSize: Math.max(8, 10 * scale), padding: "0 2px" }}
                                >
                                    {pc.strength_mod > 0 ? "+" : ""}
                                    {pc.strength_mod}/{pc.toughness_mod > 0 ? "+" : ""}
                                    {pc.toughness_mod}
                                </div>
                            )}
                            {genericCount > 0 && (
                                <div
                                    className="absolute bottom-0 left-0 bg-black/80 text-white rounded"
                                    style={{ fontSize: Math.max(8, 10 * scale), padding: "0 2px" }}
                                >
                                    {genericCount}
                                </div>
                            )}
                            {namedCounters.length > 0 && (
                                <div
                                    className="absolute left-0 bg-black/80 text-white rounded"
                                    style={{
                                        top: tokenBannerName(pc.card) ? Math.max(10, 12 * scale) : 0,
                                        fontSize: Math.max(8, 10 * scale),
                                        padding: "0 2px",
                                    }}
                                >
                                    {namedCounters.map((c) => `${c.amount} ${c.name}`).join(" ")}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function MatMasterView({ lobbyId, players, selfId, selfData, onClose }: MatMasterViewProps) {
    const [enlargedId, setEnlargedId] = useState<string | null>(null);
    const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ width: window.innerWidth, height: window.innerHeight });

    useEffect(() => {
        function onResize() {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            setContainerSize({ width: rect.width, height: rect.height });
        }

        window.addEventListener("resize", onResize);
        onResize();
        return () => window.removeEventListener("resize", onResize);
    }, []);

    const mergedPlayers: Record<string, PlayerData> = {
        ...players,
        [selfId]: selfData,
    };

    const playerList = Object.entries(mergedPlayers).map(([clientId, data]) => ({ clientId, data }));
    const n = playerList.length;
    const [cols, rows] = computeGrid(n);

    const headerBarH = 44;
    const availW = Math.max(320, containerSize.width);
    const availH = Math.max(200, containerSize.height - headerBarH);

    const enlargedEntry = enlargedId
        ? playerList.find((p) => p.clientId === enlargedId) ?? null
        : null;

    const cellW = availW / cols;
    const cellH = availH / rows;

    return (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center" onClick={onClose}>
            <div
                ref={containerRef}
                className="bg-[#0a0a0a] border border-[#222] rounded-2xl overflow-hidden"
                style={{ width: "calc(100vw - 40px)", height: "calc(100vh - 40px)" }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-4 bg-[#111] px-4 flex-shrink-0 border-b border-[#222]" style={{ height: headerBarH }}>
                    <button
                        type="button"
                        onClick={onClose}
                        className="bg-[#333] rounded-lg px-3 py-1 text-sm hover:bg-[#444] transition"
                    >
                        ← Back to game
                    </button>
                    <h2 className="text-base font-bold text-white">
                        Master View — <span className="font-mono text-sm">{lobbyId}</span>
                    </h2>
                    {enlargedEntry && (
                        <button
                            type="button"
                            onClick={() => setEnlargedId(null)}
                            className="bg-[#2a4a2a] hover:bg-[#3a5a3a] rounded-lg px-3 py-1 text-sm text-white transition"
                        >
                            ⤡ Back to grid
                        </button>
                    )}
                    <span className="ml-auto text-[#666] text-xs text-white">
                        {n} player{n !== 1 ? "s" : ""}
                    </span>
                </div>

                {enlargedEntry ? (
                    <div className="overflow-hidden" style={{ height: `calc(100% - ${headerBarH}px)` }}>
                        <PlayerBoard
                            key={enlargedEntry.clientId}
                            entry={enlargedEntry}
                            cellWidth={availW}
                            cellHeight={availH}
                            isEnlarged
                            onToggleEnlarge={(clientId) => setEnlargedId((prev) => (prev === clientId ? null : clientId))}
                            onCardClick={(src, alt) => setLightbox({ src, alt })}
                        />
                    </div>
                ) : (
                    <div
                        className="overflow-hidden"
                        style={{
                            height: `calc(100% - ${headerBarH}px)`,
                            display: "grid",
                            gridTemplateColumns: `repeat(${cols}, ${cellW}px)`,
                            gridTemplateRows: `repeat(${rows}, ${cellH}px)`,
                        }}
                    >
                        {playerList.length === 0 ? (
                            <div className="col-span-full row-span-full flex items-center justify-center text-[#444] text-xl">
                                Waiting for players to join...
                            </div>
                        ) : (
                            playerList.map((entry) => (
                                <PlayerBoard
                                    key={entry.clientId}
                                    entry={entry}
                                    cellWidth={cellW}
                                    cellHeight={cellH}
                                    isEnlarged={false}
                                    onToggleEnlarge={(clientId) => setEnlargedId((prev) => (prev === clientId ? null : clientId))}
                                    onCardClick={(src, alt) => setLightbox({ src, alt })}
                                />
                            ))
                        )}
                    </div>
                )}

                {lightbox && (
                    <CardLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
                )}
            </div>
        </div>
    );
}
