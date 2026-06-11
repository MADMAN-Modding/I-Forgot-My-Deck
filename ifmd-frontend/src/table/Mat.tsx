import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import type { Card, PlayedCard, PlayerData } from "../types";
import { getDeckList } from "../decks/BuildDeck";
import { playerDataJSON } from "./PlayerData";
import { getToken } from "../account/AccountManagement";
import { CardLightbox } from "./components/CardLightbox";

interface DragState {
    cardIndex: number;
    offsetX: number;
    offsetY: number;
}

interface ContextMenuState {
    index: number;
    x: number;
    y: number;
}

function shuffleArray<T>(arr: T[]): T[] {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function cardImageUrl(card: Card, showFront = true): string {
    if (!card.url) return "";
    const base = card.url.startsWith("http") ? card.url : `/${card.url}`;
    if (!showFront && card.is_two_faced) {
        return base.replace(".png", "_back.png");
    }
    return base;
}

export function Mat() {
    const { lobbyId } = useParams<{ lobbyId: string }>();

    // Phase
    const [phase, setPhase] = useState<"deck-select" | "playing">("deck-select");
    const [loading, setLoading] = useState(false);

    // Deck selection
    const [userDecks, setUserDecks] = useState<[string, string][]>([]);
    const [deckName, setDeckName] = useState("");


    // Game state
    const [library, setLibrary] = useState<Card[]>([]);
    const [hand, setHand] = useState<Card[]>([]);
    const [battlefield, setBattlefield] = useState<PlayedCard[]>([]);
    const [graveyard, setGraveyard] = useState<Card[]>([]);
    const [exile, setExile] = useState<Card[]>([]);
    const [life, setLife] = useState(40);
    const [commanderDamage, setCommanderDamage] = useState<number[]>([]);

    // UI state
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [showGraveyard, setShowGraveyard] = useState(false);
    const [showExile, setShowExile] = useState(false);
    const [showTableModal, setShowTableModal] = useState(false);
    const [lobbyCopied, setLobbyCopied] = useState(false);
    const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
    const [showDeckSearch, setShowDeckSearch] = useState(false);
    const [deckSearchQuery, setDeckSearchQuery] = useState("");

    // All connected players' state (updated from WS broadcasts)
    const [players, setPlayers] = useState<Record<string, PlayerData>>({});

    // Refs for use inside event handlers where closures would be stale
    const wsRef = useRef<WebSocket | null>(null);
    const draggingRef = useRef<DragState | null>(null);
    const battlefieldRef = useRef<HTMLDivElement>(null);
    const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Synced refs for sending state from event handlers
    const handRef = useRef<Card[]>([]);
    const lifeRef = useRef(40);
    const cmdDmgRef = useRef<number[]>([]);
    const bfDataRef = useRef<PlayedCard[]>([]);
    const commanderNameRef = useRef<string>("");
    const displayNameRef = useRef<string>("");

    useEffect(() => { handRef.current = hand; }, [hand]);
    useEffect(() => { lifeRef.current = life; }, [life]);
    useEffect(() => { cmdDmgRef.current = commanderDamage; }, [commanderDamage]);
    useEffect(() => { bfDataRef.current = battlefield; }, [battlefield]);

    // Fetch user decks when component mounts
    useEffect(() => {
        async function fetchUserDecks() {
            const token = getToken();
            if (!token) return;
            try {
                const res = await fetch(
                    `https://127.0.0.1:3000/api/decks/get/${encodeURIComponent(token)}`
                );
                if (res.ok) {
                    const data = await res.json();
                    setUserDecks(data);
                }
            } catch (err) {
                console.error(err);
            }
        }
        fetchUserDecks();
    }, []);

    // Fetch display name for this player
    useEffect(() => {
        async function fetchDisplayName() {
            const token = getToken();
            if (!token) return;
            try {
                const res = await fetch(
                    `https://127.0.0.1:3000/api/account/token/${encodeURIComponent(token)}`
                );
                if (res.ok) {
                    const data = await res.json();
                    displayNameRef.current = data.displayName ?? "";
                }
            } catch (err) {
                console.error(err);
            }
        }
        fetchDisplayName();
    }, []);

    // Clean up WebSocket and sync interval on unmount
    useEffect(() => {
        return () => {
            wsRef.current?.close();
            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
        };
    }, []);

    async function startGame(selectedId: string, selectedName: string) {
        setLoading(true);
        try {
            const deckData = await getDeckList(selectedId);
            if (!deckData?.cards) return;

            const cards: Card[] = deckData.cards;

            // Find the commander name to share with other players
            const commander = cards.find((c) => c.is_commander);
            commanderNameRef.current = commander?.display_name ?? commander?.name ?? "";

            // Expand each card by its card_amount for the library
            // Commander is excluded — it starts on the battlefield
            const allCards: Card[] = [];
            for (const card of cards) {
                if (card.is_commander) continue;
                for (let i = 0; i < Math.max(1, card.card_amount); i++) {
                    allCards.push({ ...card });
                }
            }

            const shuffled = shuffleArray(allCards);
            const openingHand = shuffled.splice(0, 7);

            // Place commander in top-left of the battlefield
            const initialBattlefield: PlayedCard[] = commander ? [{
                card: commander,
                show_front: true,
                tapped: false,
                location: [10, 10],
                rotation: 0,
                strength_mod: 0,
                toughness_mod: 0,
                counters: [],
            }] : [];

            setDeckName(selectedName);
            setLibrary(shuffled);
            setHand(openingHand);
            setBattlefield(initialBattlefield);
            setGraveyard([]);
            setLife(40);
            setCommanderDamage([]);

            handRef.current = openingHand;
            lifeRef.current = 40;
            cmdDmgRef.current = [];
            bfDataRef.current = initialBattlefield;

            const ws = new WebSocket(`wss://127.0.0.1:3000/ws/join/${lobbyId}/MAT`);
            ws.onopen = () => console.log("Connected to lobby", lobbyId);
            ws.onclose = () => console.log("Disconnected from lobby");
            ws.onmessage = (evt) => {
                if (evt.data === "MAT") return;
                try {
                    const json = JSON.parse(evt.data);
                    if (json.type === "data" && json.clientId && json.payload) {
                        setPlayers((prev) => ({ ...prev, [json.clientId]: json.payload }));
                    } else if (json.type === "table_joined") {
                        // A TABLE viewer just connected — immediately re-broadcast our state
                        sendState(handRef.current, bfDataRef.current, lifeRef.current, cmdDmgRef.current, selectedName);
                    }
                } catch {
                    // ignore non-JSON messages
                }
            };
            wsRef.current = ws;

            // Re-broadcast state every 5 s so late-joining TABLE clients get updates
            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
            syncIntervalRef.current = setInterval(() => {
                sendState(handRef.current, bfDataRef.current, lifeRef.current, cmdDmgRef.current, selectedName);
            }, 5000);

            setPhase("playing");
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    function sendState(
        currentHand: Card[],
        currentBattlefield: PlayedCard[],
        currentLife: number,
        currentCmdDmg: number[],
        currentDeckName = deckName,
    ) {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;

        const token = getToken() ?? "anonymous";
        const playerData: PlayerData = {
            hand: { cards: currentHand },
            played_cards: currentBattlefield,
            life: currentLife,
            commander_damage: currentCmdDmg,
            // Strip deck ID and owner — other clients should never receive them
            deck: { id: "", name: currentDeckName, cards: commanderNameRef.current, owner: displayNameRef.current },
        };

        ws.send(JSON.stringify({
            type: "data",
            clientId: token,
            payload: playerDataJSON(playerData),
        }));
    }

    // ── Game actions ──────────────────────────────────────────────────────────

    function drawCard() {
        if (library.length === 0) return;
        const [drawn, ...rest] = library;
        const newHand = [...hand, drawn];
        setLibrary(rest);
        setHand(newHand);
        sendState(newHand, battlefield, life, commanderDamage);
    }

    function playCard(index: number) {
        const card = hand[index];
        const newHand = hand.filter((_, i) => i !== index);
        const col = battlefield.length % 8;
        const row = Math.floor(battlefield.length / 8);
        const playedCard: PlayedCard = {
            card,
            show_front: true,
            tapped: false,
            location: [10 + col * 100, 10 + row * 150],
            rotation: 0,
            strength_mod: 0,
            toughness_mod: 0,
            counters: [],
        };
        const newBattlefield = [...battlefield, playedCard];
        setHand(newHand);
        setBattlefield(newBattlefield);
        sendState(newHand, newBattlefield, life, commanderDamage);
    }

    function tapCard(index: number) {
        const newBf = battlefield.map((c, i) =>
            i === index ? { ...c, tapped: !c.tapped } : c
        );
        setBattlefield(newBf);
        sendState(hand, newBf, life, commanderDamage);
        setContextMenu(null);
    }

    function flipCard(index: number) {
        const newBf = battlefield.map((c, i) =>
            i === index ? { ...c, show_front: !c.show_front } : c
        );
        setBattlefield(newBf);
        sendState(hand, newBf, life, commanderDamage);
        setContextMenu(null);
    }

    function returnToHand(index: number) {
        const card = battlefield[index].card;
        const newBf = battlefield.filter((_, i) => i !== index);
        const newHand = [...hand, card];
        setBattlefield(newBf);
        setHand(newHand);
        sendState(newHand, newBf, life, commanderDamage);
        setContextMenu(null);
    }

    function moveToGraveyard(index: number) {
        const card = battlefield[index].card;
        const newBf = battlefield.filter((_, i) => i !== index);
        setBattlefield(newBf);
        setGraveyard((prev) => [...prev, card]);
        sendState(hand, newBf, life, commanderDamage);
        setContextMenu(null);
    }

    function moveToExile(index: number) {
        const card = battlefield[index].card;
        const newBf = battlefield.filter((_, i) => i !== index);
        setBattlefield(newBf);
        setExile((prev) => [...prev, card]);
        sendState(hand, newBf, life, commanderDamage);
        setContextMenu(null);
    }

    // Move a card from the library to a zone by its index in the full library array
    function libraryCardToHand(card: Card) {
        setLibrary((prev) => { const idx = prev.indexOf(card); return prev.filter((_, i) => i !== idx); });
        setHand((prev) => [...prev, card]);
    }

    function libraryCardToBattlefield(card: Card) {
        setLibrary((prev) => { const idx = prev.indexOf(card); return prev.filter((_, i) => i !== idx); });
        const col = battlefield.length % 8;
        const row = Math.floor(battlefield.length / 8);
        const played: PlayedCard = {
            card,
            show_front: true,
            tapped: false,
            location: [10 + col * 100, 10 + row * 150],
            rotation: 0,
            strength_mod: 0,
            toughness_mod: 0,
            counters: [],
        };
        setBattlefield((prev) => { const next = [...prev, played]; sendState(hand, next, life, commanderDamage); return next; });
    }

    function libraryCardToGraveyard(card: Card) {
        setLibrary((prev) => { const idx = prev.indexOf(card); return prev.filter((_, i) => i !== idx); });
        setGraveyard((prev) => [...prev, card]);
    }

    function libraryCardToExile(card: Card) {
        setLibrary((prev) => { const idx = prev.indexOf(card); return prev.filter((_, i) => i !== idx); });
        setExile((prev) => [...prev, card]);
    }

    function adjustLife(delta: number) {
        const newLife = life + delta;
        setLife(newLife);
        sendState(hand, battlefield, newLife, commanderDamage);
    }

    function addCommanderDamageSlot() {
        const newCmdDmg = [...commanderDamage, 0];
        setCommanderDamage(newCmdDmg);
        sendState(hand, battlefield, life, newCmdDmg);
    }

    function adjustCommanderDamage(index: number, delta: number) {
        const newCmdDmg = commanderDamage.map((d, i) =>
            i === index ? Math.max(0, d + delta) : d
        );
        setCommanderDamage(newCmdDmg);
        sendState(hand, battlefield, life, newCmdDmg);
    }

    function mulligan() {
        const allCards = shuffleArray([...hand, ...library]);
        const newSize = Math.max(0, hand.length - 1);
        const newHand = allCards.splice(0, newSize);
        setLibrary(allCards);
        setHand(newHand);
        sendState(newHand, battlefield, life, commanderDamage);
    }

    function shuffleLibrary() {
        const shuffled = shuffleArray([...library]);
        setLibrary(shuffled);
    }

    // ── Drag & drop ───────────────────────────────────────────────────────────

    function handleCardMouseDown(e: React.MouseEvent, index: number) {
        if (!battlefieldRef.current) return;
        const rect = battlefieldRef.current.getBoundingClientRect();
        const card = battlefield[index];
        draggingRef.current = {
            cardIndex: index,
            offsetX: (e.clientX - rect.left) - card.location[0],
            offsetY: (e.clientY - rect.top) - card.location[1],
        };
        e.preventDefault();
        e.stopPropagation();
    }

    function handleBattlefieldMouseMove(e: React.MouseEvent) {
        const drag = draggingRef.current;
        if (!drag || !battlefieldRef.current) return;
        const rect = battlefieldRef.current.getBoundingClientRect();
        const newX = Math.max(0, (e.clientX - rect.left) - drag.offsetX);
        const newY = Math.max(0, (e.clientY - rect.top) - drag.offsetY);
        setBattlefield((prev) => {
            const updated = prev.map((c, i) =>
                i === drag.cardIndex
                    ? { ...c, location: [newX, newY] as [number, number] }
                    : c
            );
            bfDataRef.current = updated;
            return updated;
        });
    }

    function handleBattlefieldMouseUp() {
        if (draggingRef.current) {
            draggingRef.current = null;
            sendState(handRef.current, bfDataRef.current, lifeRef.current, cmdDmgRef.current);
        }
    }

    // ── Render: deck selection ────────────────────────────────────────────────

    if (phase === "deck-select") {
        return (
            <div className="text-white text-center mt-10">
                <h1 className="text-4xl font-bold mb-3">Select Your Deck</h1>
                <p className="text-[#aaa] mb-6">
                    Lobby: <span className="text-white font-mono">{lobbyId}</span>
                </p>
                <div className="bg-[#333333] rounded-2xl w-fit min-w-64 m-auto p-6">
                    {loading ? (
                        <p>Loading deck...</p>
                    ) : userDecks.length === 0 ? (
                        <p>
                            No decks found.{" "}
                            <a href="/deck/create" className="underline">
                                Create one here
                            </a>
                            .
                        </p>
                    ) : (
                        userDecks.map(([id, name]) => (
                            <div
                                key={id}
                                onClick={() => startGame(id, name)}
                                className="bg-(--main-color) rounded-xl p-3 mb-2 cursor-pointer hover:opacity-80 transition text-left"
                            >
                                {name}
                            </div>
                        ))
                    )}
                </div>
                <a href="/lobby" className="text-[#aaa] underline mt-4 block">
                    ← Back to lobby
                </a>
            </div>
        );
    }

    // ── Render: game board ────────────────────────────────────────────────────

    return (
        <div
            className="text-white flex flex-col select-none"
            style={{ height: "100vh" }}
            onClick={() => setContextMenu(null)}
        >
            {/* ── Top bar: life & info ── */}
            <div className="flex items-center gap-3 bg-[#1a1a1a] px-4 py-2 flex-shrink-0 flex-wrap">
                <a
                    href="/lobby"
                    className="bg-[#444] rounded-lg px-3 py-1 text-sm hover:bg-[#555] transition"
                >
                    ← Lobby
                </a>
                <span className="text-sm text-[#aaa]">
                    Lobby:{" "}
                    <button
                        className="text-white font-mono hover:underline cursor-pointer"
                        title="Click to copy lobby ID"
                        onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(lobbyId ?? "");
                            setLobbyCopied(true);
                            setTimeout(() => setLobbyCopied(false), 2000);
                        }}
                    >
                        {lobbyId}
                    </button>
                    {lobbyCopied && <span className="ml-1 text-green-400 text-xs">Copied!</span>}
                </span>
                <span className="text-sm text-[#aaa]">
                    Deck: <span className="text-white">{deckName}</span>
                </span>
                <button
                    onClick={(e) => { e.stopPropagation(); setShowTableModal(true); }}
                    className="bg-[#444] rounded-lg px-3 py-1 text-sm hover:bg-[#555] transition"
                >
                    Show Table ({Object.keys(players).length != 0 ? Object.keys(players).length - 1 : 0})
                </button>
                <div className="flex items-center gap-2 ml-auto">
                    <span className="text-sm">Life:</span>
                    <button
                        onClick={() => adjustLife(-5)}
                        className="bg-[#444] rounded px-2 py-1 text-sm hover:bg-[#555]"
                    >
                        -5
                    </button>
                    <button
                        onClick={() => adjustLife(-1)}
                        className="bg-(--main-color) rounded px-2 py-1 text-sm"
                    >
                        -
                    </button>
                    <span className="text-3xl font-bold w-14 text-center">{life}</span>
                    <button
                        onClick={() => adjustLife(1)}
                        className="bg-(--main-color) rounded px-2 py-1 text-sm"
                    >
                        +
                    </button>
                    <button
                        onClick={() => adjustLife(5)}
                        className="bg-[#444] rounded px-2 py-1 text-sm hover:bg-[#555]"
                    >
                        +5
                    </button>
                </div>
            </div>

            {/* ── Commander damage row ── */}
            <div className="flex items-center gap-3 bg-[#222] px-4 py-1 flex-shrink-0 text-sm flex-wrap">
                {commanderDamage.length > 0 && (
                    <>
                        <span className="text-[#aaa]">Cmdr damage:</span>
                        {commanderDamage.map((dmg, i) => (
                            <div key={i} className="flex items-center gap-1">
                                <span className="text-[#aaa]">P{i + 1}:</span>
                                <button
                                    onClick={() => adjustCommanderDamage(i, -1)}
                                    className="bg-[#444] rounded px-1 leading-4"
                                >
                                    -
                                </button>
                                <span className="w-6 text-center">{dmg}</span>
                                <button
                                    onClick={() => adjustCommanderDamage(i, 1)}
                                    className="bg-(--main-color) rounded px-1 leading-4"
                                >
                                    +
                                </button>
                            </div>
                        ))}
                    </>
                )}
                <button
                    onClick={addCommanderDamageSlot}
                    className="text-[#888] hover:text-white transition"
                >
                    + Track Commander Damage
                </button>
            </div>

            {/* ── Battlefield ── */}
            <div
                ref={battlefieldRef}
                className="flex-1 relative bg-[#1a3020] overflow-hidden"
                style={{ minHeight: "200px" }}
                onMouseMove={handleBattlefieldMouseMove}
                onMouseUp={handleBattlefieldMouseUp}
                onMouseLeave={handleBattlefieldMouseUp}
            >
                {battlefield.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-[#2a5a30] text-xl pointer-events-none">
                        Battlefield – click a card in hand to play it here
                    </div>
                )}
                {battlefield.map((pc, index) => (
                    <div
                        key={`field-${index}`}
                        className="absolute group"
                        style={{
                            left: pc.location[0],
                            top: pc.location[1],
                            transform: pc.tapped ? "rotate(90deg)" : "rotate(0deg)",
                            transformOrigin: "center",
                            cursor: "grab",
                            zIndex: draggingRef.current?.cardIndex === index ? 100 : 1,
                            transition:
                                draggingRef.current?.cardIndex === index
                                    ? "none"
                                    : "transform 0.15s",
                        }}
                        onMouseEnter={(e) => {
                            // Elevate above other cards on hover without touching drag logic
                            if (draggingRef.current?.cardIndex !== index) {
                                (e.currentTarget as HTMLDivElement).style.zIndex = "200";
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (draggingRef.current?.cardIndex !== index) {
                                (e.currentTarget as HTMLDivElement).style.zIndex = "1";
                            }
                        }}
                        onMouseDown={(e) => handleCardMouseDown(e, index)}
                        onDoubleClick={(e) => {
                            e.stopPropagation();
                            setLightbox({
                                src: cardImageUrl(pc.card, pc.show_front),
                                alt: pc.card.display_name ?? pc.card.name,
                            });
                        }}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setContextMenu({ index, x: e.clientX, y: e.clientY });
                        }}
                    >
                        <img
                            src={cardImageUrl(pc.card, pc.show_front)}
                            alt={pc.card.display_name ?? pc.card.name}
                            className="h-28 w-auto rounded-lg shadow-lg border border-[#333]"
                            draggable={false}
                            title={pc.card.display_name ?? pc.card.name}
                        />
                        {(pc.strength_mod !== 0 || pc.toughness_mod !== 0) && (
                            <div className="absolute bottom-0 right-0 bg-black text-white text-xs rounded px-1">
                                {pc.strength_mod > 0 ? "+" : ""}
                                {pc.strength_mod}/
                                {pc.toughness_mod > 0 ? "+" : ""}
                                {pc.toughness_mod}
                            </div>
                        )}
                        {pc.counters.length > 0 && (
                            <div className="absolute top-0 left-0 bg-black text-white text-xs rounded px-1">
                                {pc.counters.map((c) => `${c.amount}${c.name}`).join(" ")}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* ── Context menu ── */}
            {contextMenu !== null && (
                <div
                    className="fixed bg-[#2a2a2a] border border-[#555] rounded-lg shadow-xl z-50 py-1 text-sm"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        className="block w-full text-left px-4 py-2 hover:bg-[#3a3a3a]"
                        onClick={() => tapCard(contextMenu.index)}
                    >
                        {battlefield[contextMenu.index]?.tapped ? "Untap" : "Tap"}
                    </button>
                    {battlefield[contextMenu.index]?.card.is_two_faced && (
                        <button
                            className="block w-full text-left px-4 py-2 hover:bg-[#3a3a3a]"
                            onClick={() => flipCard(contextMenu.index)}
                        >
                            Flip Card
                        </button>
                    )}
                    <button
                        className="block w-full text-left px-4 py-2 hover:bg-[#3a3a3a]"
                        onClick={() => returnToHand(contextMenu.index)}
                    >
                        Return to Hand
                    </button>
                    <button
                        className="block w-full text-left px-4 py-2 hover:bg-[#3a3a3a]"
                        onClick={() => moveToGraveyard(contextMenu.index)}
                    >
                        Move to Graveyard
                    </button>
                    <button
                        className="block w-full text-left px-4 py-2 hover:bg-[#3a3a3a]"
                        onClick={() => moveToExile(contextMenu.index)}
                    >
                        Move to Exile
                    </button>
                </div>
            )}

            {/* ── Bottom panel ── */}
            <div className="bg-[#111] flex-shrink-0">
                {/* Controls */}
                <div className="flex items-center gap-4 px-3 py-2 border-t border-[#333] text-sm flex-wrap">
                    <span className="text-[#aaa]">Library: {library.length}</span>
                    <button
                        onClick={drawCard}
                        disabled={library.length === 0}
                        className="bg-(--main-color) rounded-lg px-3 py-1 disabled:opacity-40 hover:opacity-80 transition"
                    >
                        Draw
                    </button>
                    <button
                        onClick={shuffleLibrary}
                        disabled={library.length === 0}
                        className="bg-[#444] rounded-lg px-3 py-1 hover:bg-[#555] transition disabled:opacity-40"
                        title="Shuffle the library"
                    >
                        Shuffle
                    </button>
                    <button
                        onClick={() => { setShowDeckSearch(!showDeckSearch); setDeckSearchQuery(""); }}
                        disabled={library.length === 0}
                        className="bg-[#444] rounded-lg px-3 py-1 hover:bg-[#555] transition disabled:opacity-40"
                        title="Search your library"
                    >
                        Search Library
                    </button>
                    <button
                        onClick={mulligan}
                        className="bg-[#444] rounded-lg px-3 py-1 hover:bg-[#555] transition"
                        title="Shuffle hand back and draw one fewer card"
                    >
                        Mulligan
                    </button>
                    <button
                        onClick={() => setShowGraveyard(!showGraveyard)}
                        className="bg-[#333] rounded-lg px-3 py-1 hover:bg-[#444] transition"
                    >
                        Graveyard: {graveyard.length}
                    </button>
                    <button
                        onClick={() => setShowExile(!showExile)}
                        className="bg-[#4a3a00] rounded-lg px-3 py-1 hover:bg-[#5a4a00] transition"
                    >
                        Exile: {exile.length}
                    </button>
                    <span className="ml-auto text-[#aaa]">Hand: {hand.length}</span>
                </div>

                {/* Deck search panel */}
                {showDeckSearch && (
                    <div className="bg-[#1a1a1a] border-t border-[#333] p-2">
                        <div className="flex items-center gap-2 mb-2">
                            <input
                                type="text"
                                value={deckSearchQuery}
                                onChange={(e) => setDeckSearchQuery(e.target.value)}
                                placeholder="Search library..."
                                autoFocus
                                className="bg-[#2a2a2a] text-white rounded-lg px-3 py-1 text-sm flex-1 border border-[#444] focus:outline-none focus:border-[#888]"
                            />
                            <button
                                onClick={() => setShowDeckSearch(false)}
                                className="text-[#888] hover:text-white text-lg leading-none px-2"
                            >
                                ×
                            </button>
                        </div>
                        <div
                            className="flex gap-3 overflow-x-auto pb-1"
                            style={{ maxHeight: "180px" }}
                        >
                            {!deckSearchQuery.trim() && (
                                <p className="text-[#555] self-center text-sm">Type to search your library.</p>
                            )}
                            {deckSearchQuery.trim() && library
                                .filter((card) => {
                                    const q = deckSearchQuery.toLowerCase();
                                    return (
                                        card.name.toLowerCase().includes(q) ||
                                        (card.display_name ?? "").toLowerCase().includes(q)
                                    );
                                })
                                .map((card, i) => (
                                    <div
                                        key={`search-${i}`}
                                        className="flex-shrink-0 flex flex-col items-center gap-1"
                                    >
                                        <img
                                            src={cardImageUrl(card)}
                                            alt={card.display_name ?? card.name}
                                            className="h-24 rounded shadow cursor-pointer hover:opacity-80"
                                            title={"Double-click to enlarge"}
                                            onDoubleClick={() =>
                                                setLightbox({
                                                    src: cardImageUrl(card),
                                                    alt: card.display_name ?? card.name,
                                                })
                                            }
                                        />
                                        <p className="text-white text-xs text-center max-w-[5rem] truncate">
                                            {card.display_name ?? card.name}
                                        </p>
                                        <div className="flex gap-1 flex-wrap justify-center">
                                            <button onClick={() => libraryCardToHand(card)} className="text-[10px] bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded px-1 py-0.5">Hand</button>
                                            <button onClick={() => libraryCardToBattlefield(card)} className="text-[10px] bg-(--main-color) hover:opacity-80 text-white rounded px-1 py-0.5">Board</button>
                                            <button onClick={() => libraryCardToGraveyard(card)} className="text-[10px] bg-[#333] hover:bg-[#444] text-white rounded px-1 py-0.5">Grave</button>
                                            <button onClick={() => libraryCardToExile(card)} className="text-[10px] bg-[#4a3a00] hover:bg-[#5a4a00] text-white rounded px-1 py-0.5">Exile</button>
                                        </div>
                                    </div>
                                ))}
                            {deckSearchQuery.trim() &&
                                library.filter((card) => {
                                    const q = deckSearchQuery.toLowerCase();
                                    return (
                                        card.name.toLowerCase().includes(q) ||
                                        (card.display_name ?? "").toLowerCase().includes(q)
                                    );
                                }).length === 0 && (
                                    <p className="text-[#555] self-center text-sm">
                                        No cards found.
                                    </p>
                                )}
                        </div>
                    </div>
                )}

                {/* Exile panel */}
                {showExile && (
                    <div
                        className="flex gap-2 overflow-x-auto p-2 bg-[#1a1400] border-t border-[#333]"
                        style={{ maxHeight: "130px" }}
                    >
                        <span className="text-[#aaa] self-center text-xs mr-1 flex-shrink-0">
                            Exile:
                        </span>
                        {exile.length === 0 && (
                            <span className="text-[#555] self-center text-sm">Empty</span>
                        )}
                        {exile.map((card, i) => (
                            <div key={`ex-${i}`} className="flex-shrink-0">
                                <img
                                    src={cardImageUrl(card)}
                                    alt={card.display_name ?? card.name}
                                    className="h-24 rounded shadow"
                                    title={card.display_name ?? card.name}
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* Graveyard panel */}
                {showGraveyard && graveyard.length > 0 && (
                    <div
                        className="flex gap-2 overflow-x-auto p-2 bg-[#1a1a1a] border-t border-[#333]"
                        style={{ maxHeight: "130px" }}
                    >
                        <span className="text-[#aaa] self-center text-xs mr-1 flex-shrink-0">
                            Graveyard:
                        </span>
                        {graveyard.map((card, i) => (
                            <div key={`gy-${i}`} className="flex-shrink-0">
                                <img
                                    src={cardImageUrl(card)}
                                    alt={card.display_name ?? card.name}
                                    className="h-24 rounded shadow"
                                    title={card.display_name ?? card.name}
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* Hand */}
                <div
                    className="flex gap-2 overflow-x-auto p-2 border-t border-[#333]"
                    style={{ maxHeight: "160px" }}
                >
                    {hand.map((card, index) => (
                        <div
                            key={`hand-${index}`}
                            className="flex-shrink-0 cursor-pointer hover:scale-105 hover:-translate-y-2 transition-transform"
                            title={`Play: ${card.display_name ?? card.name}`}
                            onClick={() => playCard(index)}
                        >
                            <img
                                src={cardImageUrl(card)}
                                alt={card.display_name ?? card.name}
                                className="h-32 rounded-lg shadow-lg"
                                draggable={false}
                            />
                        </div>
                    ))}
                    {hand.length === 0 && (
                        <span className="text-[#555] self-center text-sm">
                            No cards in hand
                        </span>
                    )}
                </div>
            </div>

            {/* ── Lightbox ── */}
            {lightbox && (
                <CardLightbox
                    src={lightbox.src}
                    alt={lightbox.alt}
                    onClose={() => setLightbox(null)}
                />
            )}

            {/* ── Table view modal ── */}
            {showTableModal && (
                <div
                    className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center"
                    onClick={() => setShowTableModal(false)}
                >
                    <div
                        className="bg-[#111] rounded-2xl p-5 w-11/12 max-w-5xl max-h-[80vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold">Table View</h2>
                            <button
                                onClick={() => setShowTableModal(false)}
                                className="text-[#888] hover:text-white text-2xl leading-none"
                            >
                                ×
                            </button>
                        </div>
                        <TableModalContent players={players} selfId={getToken() ?? "anonymous"} />
                    </div>
                </div>
            )}
        </div>
    );
}

function TableModalContent({ players, selfId }: { players: Record<string, PlayerData>; selfId: string }) {
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
                    {data.played_cards.map((pc, i) => {
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