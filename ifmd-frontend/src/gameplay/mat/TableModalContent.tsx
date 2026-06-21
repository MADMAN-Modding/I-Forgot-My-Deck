import { useState } from "react";
import type { PlayedCard, PlayerData } from "../../types";
import { CardLightbox } from "../components/CardLightbox";

export function TableModalContent({ players, selfId }: { players: Record<string, PlayerData>; selfId: string }) {
    const [selected, setSelected] = useState<string | null>(null);

    if (Object.keys(players).length === 0) {
        return (
            <p className="text-[#555] text-center py-8">
                No players visible yet — state syncs every 5 seconds.
            </p>
        );
    }

    if (selected && players[selected]) {
        return (
            <>
                <button
                    onClick={() => setSelected(null)}
                    className="mb-4 text-sm text-[#aaa] hover:text-white transition flex items-center gap-1"
                >
                    ← Back to all players
                </button>
                <BoardDetail clientId={selected} data={players[selected]} />
            </>
        );
    }

    return (
        <div
            className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
        >
            {Object.entries(players)
                .filter(([clientId]) => clientId !== selfId)
                .map(([clientId, data]) => (
                    <PlayerSummaryCard
                        key={clientId}
                        clientId={clientId}
                        data={data}
                        onClick={() => setSelected(clientId)}
                    />
                ))}
        </div>
    );
}

function PlayerSummaryCard({
    clientId: _clientId,
    data,
    onClick,
}: {
    clientId: string;
    data: PlayerData;
    onClick: () => void;
}) {
    return (
        <div
            className="bg-[#1e1e1e] border border-[#333] rounded-xl overflow-hidden cursor-pointer hover:border-[#888] transition"
            onClick={onClick}
        >
            <div className="flex items-center gap-2 bg-[#2a2a2a] px-3 py-2">
                <div>
                    <p className="font-bold text-sm">{data.deck?.name ?? "Unknown Deck"}</p>
                    {data.deck?.cards && <p className="text-xs text-[#888]">{data.deck.cards}</p>}
                    {data.deck?.owner && <p className="text-xs text-[#666]">{data.deck.owner}</p>}
                </div>
                <div className="ml-auto text-center">
                    <p className="text-2xl font-bold">{data.life}</p>
                    <p className="text-xs text-[#888]">life</p>
                </div>
            </div>
            {data.commander_damage?.length > 0 && (
                <div className="flex gap-2 px-3 py-1 text-xs text-[#aaa] bg-[#242424]">
                    <span>Cmdr:</span>
                    {data.commander_damage.map((d, i) => (
                        <span key={i}>P{i + 1}: {d}</span>
                    ))}
                </div>
            )}
            <div className="flex gap-3 px-3 py-1 text-xs text-[#888]">
                <span>Hand: {data.hand?.cards?.length ?? 0}</span>
                <span>Board: {data.played_cards?.length ?? 0}</span>
            </div>
            <p className="text-xs text-[#555] px-3 pb-2">Click to view board</p>
        </div>
    );
}

function BoardDetail({ data }: { clientId: string; data: PlayerData }) {
    const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
    return (
        <div>
            {/* Header */}
            <div className="flex items-center gap-4 bg-[#2a2a2a] rounded-xl px-4 py-3 mb-4">
                <div>
                    <p className="font-bold text-lg">{data.deck?.name ?? "Unknown Deck"}</p>
                    {data.deck?.cards && <p className="text-sm text-[#888]">{data.deck.cards}</p>}
                    {data.deck?.owner && <p className="text-sm text-[#666]">{data.deck.owner}</p>}
                </div>
                <div className="ml-auto text-center">
                    <p className="text-4xl font-bold">{data.life}</p>
                    <p className="text-xs text-[#888]">life</p>
                </div>
            </div>

            {/* Commander damage */}
            {data.commander_damage?.length > 0 && (
                <div className="flex gap-3 text-sm text-[#aaa] mb-3">
                    <span className="text-[#666]">Cmdr dmg:</span>
                    {data.commander_damage.map((d, i) => (
                        <span key={i}>P{i + 1}: <span className="text-white">{d}</span></span>
                    ))}
                </div>
            )}

            {/* Battlefield */}
            <div className="flex items-center gap-2 mb-2">
                <p className="text-xs text-[#666]">
                    Battlefield ({data.played_cards?.length ?? 0} cards)
                </p>
                <p className="text-xs text-[#444] italic">— double-click a card to enlarge</p>
            </div>
            {!data.played_cards || data.played_cards.length === 0 ? (
                <p className="text-[#444] text-sm mb-4">Nothing on the battlefield.</p>
            ) : (
                <div className="flex flex-wrap gap-3 mb-4">
                    {data.played_cards.map((pc: PlayedCard, i: number) => {
                        const imgSrc = pc.card.url?.startsWith("http")
                            ? pc.card.url
                            : `/${pc.card.url}`;
                        return (
                            <div
                                key={i}
                                className="relative flex-shrink-0 cursor-pointer"
                                style={{
                                    transform: pc.tapped ? "rotate(90deg)" : "none",
                                    transformOrigin: "center",
                                }}
                                title={pc.card.display_name ?? pc.card.name}
                                onDoubleClick={() => setLightbox({
                                    src: imgSrc,
                                    alt: pc.card.display_name ?? pc.card.name,
                                })}
                            >
                                <img
                                    src={imgSrc}
                                    alt={pc.card.display_name ?? pc.card.name}
                                    className="h-28 w-auto rounded-lg shadow"
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
                        );
                    })}
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
