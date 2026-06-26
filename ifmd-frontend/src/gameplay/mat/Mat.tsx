import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Card, PlayedCard, PlayerData } from "../../types";
import { getDeckList } from "../../decks/BuildDeck";
import { playerDataJSON } from "../PlayerData";
import { getToken } from "../../account/AccountManagement";
import { CardLightbox } from "../components/CardLightbox";
import { WSS_URL } from "../../constants";
import { Link } from "react-router-dom";
import { getCardImage } from "../../ImageHandling";
import { useMenuPosition } from "./useMenuPosition";
import { shuffleArray } from "./shuffleArray";
import { TableModalContent } from "./TableModalContent";
import { useLongPress } from "./useLongPress";

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

export function Mat() {
    const { lobbyId } = useParams<{ lobbyId: string }>();
    const navigate = useNavigate();
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
    const [handContextMenu, setHandContextMenu] = useState<ContextMenuState | null>(null);
    const bfMenu = useMenuPosition(contextMenu?.x ?? null, contextMenu?.y ?? null);
    const handMenu = useMenuPosition(handContextMenu?.x ?? null, handContextMenu?.y ?? null);
    const longPressBfIndexRef = useRef<number | null>(null);
    const longPressHandIndexRef = useRef<number | null>(null);
    const bfLongPress = useLongPress((x, y) => {
        if (longPressBfIndexRef.current !== null) {
            setContextMenu({ index: longPressBfIndexRef.current, x, y });
        }
    });
    const handLongPress = useLongPress((x, y) => {
        if (longPressHandIndexRef.current !== null) {
            setHandContextMenu({ index: longPressHandIndexRef.current, x, y });
        }
        // A long-press opened the menu — cancel any in-flight drag so lifting
        // the finger afterward doesn't also play the card.
        cleanupHandCardDragListeners();
        handDragRef.current = null;
        setHandDragVisual(null);
    });
    const [showGraveyard, setShowGraveyard] = useState(false);
    const [showExile, setShowExile] = useState(false);
    const [showTableModal, setShowTableModal] = useState(false);
    const [lobbyCopied, setLobbyCopied] = useState(false);
    const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
    const [showDeckSearch, setShowDeckSearch] = useState(false);
    const [deckSearchQuery, setDeckSearchQuery] = useState("");

    // Scry state
    const [scryPanel, setScryPanel] = useState<{ cards: Card[]; decisions: ("top" | "bottom")[] } | null>(null);

    // All connected players' state (updated from WS broadcasts)
    const [players, setPlayers] = useState<Record<string, PlayerData>>({});

    // Refs for use inside event handlers where closures would be stale
    const wsRef = useRef<WebSocket | null>(null);
    const draggingRef = useRef<DragState | null>(null);
    const handDragRef = useRef<{
        cardIndex: number;
        startX: number;
        startY: number;
        moved: boolean;
    } | null>(null);
    const [handDragVisual, setHandDragVisual] = useState<{ index: number; x: number; y: number } | null>(null);
    const battlefieldRef = useRef<HTMLDivElement>(null);
    const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Synced refs for sending state from event handlers
    const handRef = useRef<Card[]>([]);
    const lifeRef = useRef(40);
    const cmdDmgRef = useRef<number[]>([]);
    const bfDataRef = useRef<PlayedCard[]>([]);
    const libraryRef = useRef<Card[]>([]);
    const graveyardRef = useRef<Card[]>([]);
    const exileRef = useRef<Card[]>([]);
    const commanderNameRef = useRef<string>("");
    const displayNameRef = useRef<string>("");
    const deckNameRef = useRef<string>("");

    // Image cache
    const [imageCache, setImageCache] = useState<Record<string, string>>({});
    const imageCacheRef = useRef<Record<string, string>>({});

    useEffect(() => { handRef.current = hand; }, [hand]);
    useEffect(() => { lifeRef.current = life; }, [life]);
    useEffect(() => { cmdDmgRef.current = commanderDamage; }, [commanderDamage]);
    useEffect(() => { bfDataRef.current = battlefield; }, [battlefield]);
    useEffect(() => { libraryRef.current = library; }, [library]);
    useEffect(() => { graveyardRef.current = graveyard; }, [graveyard]);
    useEffect(() => { exileRef.current = exile; }, [exile]);

    // Fetch user decks when component mounts
    useEffect(() => {
        async function fetchUserDecks() {
            const token = getToken();
            if (!token) return;
            try {
                const res = await fetch(
                    `https://${WSS_URL}/api/decks/get/${encodeURIComponent(token)}`
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
                    `https://${WSS_URL}/api/account/token/${encodeURIComponent(token)}`
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
            libraryRef.current = shuffled;
            graveyardRef.current = [];
            exileRef.current = [];
            deckNameRef.current = selectedName;

            const token = getToken() ?? "";
            const ws = new WebSocket(`wss://${WSS_URL}/ws/join/${lobbyId}/MAT/${encodeURIComponent(token)}`);
            ws.onmessage = (evt) => {
                if (evt.data === "MAT") return;
                try {
                    const json = JSON.parse(evt.data);
                    if (json.type === "rejected") {
                        // Server rejected this connection — not in the allowed player list
                        ws.close();
                        navigate("/lobby");
                        return;
                    } else if (json.type === "state_restore" && json.payload) {
                        // Restore previously saved game state after reconnect
                        const p = json.payload;
                        const newLib: Card[] = p.library ?? [];
                        const newHand: Card[] = p.hand ?? [];
                        const newBf: PlayedCard[] = p.battlefield ?? [];
                        const newGy: Card[] = p.graveyard ?? [];
                        const newEx: Card[] = p.exile ?? [];
                        const newLife: number = p.life ?? 40;
                        const newCmdDmg: number[] = p.commander_damage ?? [];
                        setLibrary(newLib); setHand(newHand); setBattlefield(newBf);
                        setGraveyard(newGy); setExile(newEx); setLife(newLife);
                        setCommanderDamage(newCmdDmg);
                        handRef.current = newHand; lifeRef.current = newLife;
                        cmdDmgRef.current = newCmdDmg; bfDataRef.current = newBf;
                        libraryRef.current = newLib; graveyardRef.current = newGy;
                        exileRef.current = newEx;
                        if (p.commander_name) commanderNameRef.current = p.commander_name;
                        if (p.deck_name) deckNameRef.current = p.deck_name;
                    } else if (json.type === "data" && json.clientId && json.payload) {
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
                sendSaveState();
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
        const bfEl = battlefieldRef.current;
        const viewport = bfEl ? { width: bfEl.clientWidth, height: bfEl.clientHeight } : { width: 100, height: 100 };
        const playerData: PlayerData = {
            hand: { cards: currentHand },
            played_cards: currentBattlefield,
            life: currentLife,
            commander_damage: currentCmdDmg,
            // Strip deck ID and owner — other clients should never receive them
            deck: { id: "", name: currentDeckName, cards: commanderNameRef.current, owner: displayNameRef.current },
            viewport
        };

        ws.send(JSON.stringify({
            type: "data",
            clientId: token,
            payload: playerDataJSON(playerData),
        }));
    }

    function sendSaveState() {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({
            type: "save_state",
            hand: handRef.current,
            library: libraryRef.current,
            graveyard: graveyardRef.current,
            exile: exileRef.current,
            battlefield: bfDataRef.current,
            life: lifeRef.current,
            commander_damage: cmdDmgRef.current,
            deck_name: deckNameRef.current,
            commander_name: commanderNameRef.current,
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
        const col = 1 % 8;
        const row = Math.floor(1 / 8);
        const randomOffset = Math.floor(10 * Math.random());
        const playedCard: PlayedCard = {
            card,
            show_front: true,
            tapped: false,
            location: [10 + col * 100 + randomOffset, 10 + row * 150 + randomOffset],
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

    function playCardAt(index: number, x: number, y: number) {
        const card = hand[index];
        if (!card) return;
        const newHand = hand.filter((_, i) => i !== index);
        const playedCard: PlayedCard = {
            card,
            show_front: true,
            tapped: false,
            location: [x, y],
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

    // ── Hand deck manipulation ────────────────────────────────────────────────

    function sendHandCardToTop(index: number) {
        const card = hand[index];
        const newHand = hand.filter((_, i) => i !== index);
        const newLibrary = [card, ...library];
        setHand(newHand);
        setLibrary(newLibrary);
        sendState(newHand, battlefield, life, commanderDamage);
        setHandContextMenu(null);
    }

    function sendHandCardToBottom(index: number) {
        const card = hand[index];
        const newHand = hand.filter((_, i) => i !== index);
        const newLibrary = [...library, card];
        setHand(newHand);
        setLibrary(newLibrary);
        sendState(newHand, battlefield, life, commanderDamage);
        setHandContextMenu(null);
    }

    function sendHandCardToRandom(index: number) {
        const card = hand[index];
        const newHand = hand.filter((_, i) => i !== index);
        const newLibrary = [...library];
        const pos = Math.floor(Math.random() * (newLibrary.length + 1));
        newLibrary.splice(pos, 0, card);
        setHand(newHand);
        setLibrary(newLibrary);
        sendState(newHand, battlefield, life, commanderDamage);
        setHandContextMenu(null);
    }

    function sendHandCardToGraveyard(index: number) {
        const card = hand[index];
        const newHand = hand.filter((_, i) => i !== index);
        setHand(newHand);
        setGraveyard((prev) => [...prev, card]);
        sendState(newHand, battlefield, life, commanderDamage);
        setHandContextMenu(null);
    }

    function sendHandCardToExile(index: number) {
        const card = hand[index];
        const newHand = hand.filter((_, i) => i !== index);
        setHand(newHand);
        setExile((prev) => [...prev, card]);
        sendState(newHand, battlefield, life, commanderDamage);
        setHandContextMenu(null);
    }

    // ── Graveyard actions ─────────────────────────────────────────────────────

    function graveyardCardToHand(index: number) {
        const card = graveyard[index];
        const newGy = graveyard.filter((_, i) => i !== index);
        const newHand = [...hand, card];
        setGraveyard(newGy);
        setHand(newHand);
        sendState(newHand, battlefield, life, commanderDamage);
    }

    function graveyardCardToTop(index: number) {
        const card = graveyard[index];
        const newGy = graveyard.filter((_, i) => i !== index);
        setGraveyard(newGy);
        setLibrary((prev) => [card, ...prev]);
    }

    function graveyardCardToBottom(index: number) {
        const card = graveyard[index];
        const newGy = graveyard.filter((_, i) => i !== index);
        setGraveyard(newGy);
        setLibrary((prev) => [...prev, card]);
    }

    // ── Exile actions ─────────────────────────────────────────────────────────

    function exileCardToHand(index: number) {
        const card = exile[index];
        const newEx = exile.filter((_, i) => i !== index);
        const newHand = [...hand, card];
        setExile(newEx);
        setHand(newHand);
        sendState(newHand, battlefield, life, commanderDamage);
    }

    // ── Scry ──────────────────────────────────────────────────────────────────

    function startScry(count: number) {
        const cards = library.slice(0, Math.min(count, library.length));
        if (cards.length === 0) return;
        setScryPanel({ cards, decisions: Array(cards.length).fill("top") });
    }

    function setScryDecision(index: number, decision: "top" | "bottom") {
        if (!scryPanel) return;
        const newDecisions = [...scryPanel.decisions];
        newDecisions[index] = decision;
        setScryPanel({ ...scryPanel, decisions: newDecisions });
    }

    function resolveScry() {
        if (!scryPanel) return;
        const remaining = library.slice(scryPanel.cards.length);
        const topCards: Card[] = [];
        const bottomCards: Card[] = [];
        scryPanel.cards.forEach((card, i) => {
            if (scryPanel.decisions[i] === "bottom") bottomCards.push(card);
            else topCards.push(card);
        });
        setLibrary([...topCards, ...remaining, ...bottomCards]);
        setScryPanel(null);
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

    function startHandCardDrag(index: number, x: number, y: number) {
        handDragRef.current = { cardIndex: index, startX: x, startY: y, moved: false };
        setHandDragVisual({ index, x, y });
        window.addEventListener("mousemove", handleHandDragMouseMove);
        window.addEventListener("mouseup", handleHandDragMouseUp);
        window.addEventListener("touchmove", handleHandDragTouchMove, { passive: false });
        window.addEventListener("touchend", handleHandDragTouchEnd);
        window.addEventListener("touchcancel", handleHandDragTouchEnd);
    }

    function updateHandCardDrag(x: number, y: number) {
        const drag = handDragRef.current;
        if (!drag) return;
        const dx = x - drag.startX;
        const dy = y - drag.startY;
        if (!drag.moved && Math.sqrt(dx * dx + dy * dy) > 6) {
            drag.moved = true;
        }
        setHandDragVisual({ index: drag.cardIndex, x, y });
    }

    function endHandCardDrag(x: number, y: number) {
        const drag = handDragRef.current;
        cleanupHandCardDragListeners();
        handDragRef.current = null;
        setHandDragVisual(null);
        if (!drag) return;

        if (!drag.moved) {
            // Treated as a plain click/tap — keep existing auto-position behavior.
            playCard(drag.cardIndex);
            return;
        }

        const bfEl = battlefieldRef.current;
        if (!bfEl) return;
        const rect = bfEl.getBoundingClientRect();
        const overBattlefield =
            x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
        if (overBattlefield) {
            playCardAt(drag.cardIndex, x - rect.left, y - rect.top);
        }
        // If dropped outside the battlefield, the card simply stays in hand.
    }

    function cleanupHandCardDragListeners() {
        window.removeEventListener("mousemove", handleHandDragMouseMove);
        window.removeEventListener("mouseup", handleHandDragMouseUp);
        window.removeEventListener("touchmove", handleHandDragTouchMove);
        window.removeEventListener("touchend", handleHandDragTouchEnd);
        window.removeEventListener("touchcancel", handleHandDragTouchEnd);
    }

    function handleHandDragMouseMove(e: MouseEvent) {
        updateHandCardDrag(e.clientX, e.clientY);
    }

    function handleHandDragMouseUp(e: MouseEvent) {
        endHandCardDrag(e.clientX, e.clientY);
    }

    function handleHandDragTouchMove(e: TouchEvent) {
        const touch = e.touches[0];
        if (!touch) return;
        e.preventDefault(); // stop the page from scrolling while dragging a card
        updateHandCardDrag(touch.clientX, touch.clientY);
    }

    function handleHandDragTouchEnd(e: TouchEvent) {
        const touch = e.changedTouches[0];
        if (touch) {
            endHandCardDrag(touch.clientX, touch.clientY);
        } else {
            cleanupHandCardDragListeners();
            handDragRef.current = null;
            setHandDragVisual(null);
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
                            <Link to="/deck/create" className="underline">
                                Create one here
                            </Link>
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
                <Link to="/lobby" className="text-[#aaa] underline mt-4 block">
                    ← Back to lobby
                </Link>
            </div>
        );
    }

    // ── Render: game board ────────────────────────────────────────────────────

    return (
        <div
            className="text-white flex flex-col select-none"
            style={{ height: "100vh" }}
            onClick={() => { setContextMenu(null); setHandContextMenu(null); }}
        >
            {/* ── Top bar: life & info ── */}
            <div className="flex items-center gap-3 bg-[#1a1a1a] px-4 py-2 shrink-0 flex-wrap">
                <Link
                    to="/lobby"
                    className="bg-[#444] rounded-lg px-3 py-1 text-sm hover:bg-[#555] transition"
                >
                    ← Lobby
                </Link>
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
            <div className="flex items-center gap-3 bg-[#222] px-4 py-1 shrink-0 text-sm flex-wrap">
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
                        onTouchStart={(e) => {
                            longPressBfIndexRef.current = index;
                            bfLongPress.onTouchStart(e);
                            const touch = e.touches[0];
                            if (touch && battlefieldRef.current) {
                                const rect = battlefieldRef.current.getBoundingClientRect();
                                const card = battlefield[index];
                                draggingRef.current = {
                                    cardIndex: index,
                                    offsetX: (touch.clientX - rect.left) - card.location[0],
                                    offsetY: (touch.clientY - rect.top) - card.location[1],
                                };
                            }
                        }}
                        onTouchMove={(e) => {
                            bfLongPress.onTouchMove(e);
                            const touch = e.touches[0];
                            const drag = draggingRef.current;
                            if (!touch || !drag || !battlefieldRef.current) return;
                            const rect = battlefieldRef.current.getBoundingClientRect();
                            const newX = Math.max(0, (touch.clientX - rect.left) - drag.offsetX);
                            const newY = Math.max(0, (touch.clientY - rect.top) - drag.offsetY);
                            setBattlefield((prev) => {
                                const updated = prev.map((c, i) =>
                                    i === drag.cardIndex
                                        ? { ...c, location: [newX, newY] as [number, number] }
                                        : c
                                );
                                bfDataRef.current = updated;
                                return updated;
                            });
                        }}
                        onTouchEnd={(e) => {
                            bfLongPress.onTouchEnd(e);
                            if (draggingRef.current) {
                                draggingRef.current = null;
                                sendState(handRef.current, bfDataRef.current, lifeRef.current, cmdDmgRef.current);
                            }
                        }}
                        onTouchCancel={(_) => {
                            bfLongPress.onTouchCancel();
                            draggingRef.current = null;
                        }}
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
                    ref={bfMenu.ref}
                    className="fixed bg-[#2a2a2a] border border-[#555] rounded-lg shadow-xl z-50 py-1 text-sm"
                    style={{ left: bfMenu.pos.x, top: bfMenu.pos.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        className="block w-full text-left px-4 py-2 hover:bg-[#3a3a3a]"
                        onClick={() => tapCard(contextMenu.index)}
                    >
                        {battlefield[contextMenu.index]?.tapped ? "Untap" : "Tap"}
                    </button>
                    <button
                        className="block w-full text-left px-4 py-2 hover:bg-[#3a3a3a]"
                        onClick={() => flipCard(contextMenu.index)}
                    >
                        Flip Card
                    </button>
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

            {/* ── Hand card context menu ── */}
            {handContextMenu !== null && (
                <div
                    ref={handMenu.ref}
                    className="fixed bg-[#2a2a2a] border border-[#555] rounded-lg shadow-xl z-50 py-1 text-sm"
                    style={{ left: handMenu.pos.x, top: handMenu.pos.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-4 py-1 text-[#888] text-xs border-b border-[#444] mb-1">
                        {hand[handContextMenu.index]?.display_name ?? hand[handContextMenu.index]?.name}
                    </div>
                    <button className="block w-full text-left px-4 py-2 hover:bg-[#3a3a3a]" onClick={() => { playCard(handContextMenu.index); setHandContextMenu(null); }}>
                        Play to Battlefield
                    </button>
                    <button className="block w-full text-left px-4 py-2 hover:bg-[#3a3a3a]" onClick={() => libraryCardToHand(hand[handContextMenu.index])}>
                        Return to Library
                    </button>
                    <button className="block w-full text-left px-4 py-2 hover:bg-[#3a3a3a]" onClick={() => sendHandCardToTop(handContextMenu.index)}>
                        Send to Top of Deck
                    </button>
                    <button className="block w-full text-left px-4 py-2 hover:bg-[#3a3a3a]" onClick={() => sendHandCardToBottom(handContextMenu.index)}>
                        Send to Bottom of Deck
                    </button>
                    <button className="block w-full text-left px-4 py-2 hover:bg-[#3a3a3a]" onClick={() => sendHandCardToRandom(handContextMenu.index)}>
                        Insert at Random Position
                    </button>
                    <button className="block w-full text-left px-4 py-2 hover:bg-[#3a3a3a]" onClick={() => sendHandCardToGraveyard(handContextMenu.index)}>
                        Send to Graveyard
                    </button>
                    <button className="block w-full text-left px-4 py-2 hover:bg-[#3a3a3a]" onClick={() => sendHandCardToExile(handContextMenu.index)}>
                        Send to Exile
                    </button>
                </div>
            )}

            {/* ── Scry panel ── */}
            {scryPanel && (
                <div
                    className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center"
                    onClick={() => setScryPanel(null)}
                >
                    <div
                        className="bg-[#1e1e1e] rounded-2xl p-6 max-w-3xl w-full mx-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-lg font-bold mb-1">
                            Scry {scryPanel.cards.length}
                        </h2>
                        <p className="text-[#888] text-xs mb-5">
                            Choose whether each card stays on top or goes to the bottom of your library.
                        </p>
                        <div className="flex gap-5 overflow-x-auto pb-2 justify-center mb-5">
                            {scryPanel.cards.map((card, i) => (
                                <div key={i} className="flex flex-col items-center gap-2 shrink-0">
                                    <img
                                        src={cardImageUrl(card)}
                                        alt={card.display_name ?? card.name}
                                        className="h-36 rounded-xl shadow-lg"
                                    />
                                    <p className="text-xs text-[#aaa] max-w-24 text-center truncate">
                                        {card.display_name ?? card.name}
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setScryDecision(i, "top")}
                                            className={`px-3 py-1 rounded-lg text-sm font-semibold transition ${scryPanel.decisions[i] === "top" ? "bg-(--main-color)" : "bg-[#333] hover:bg-[#444]"}`}
                                        >
                                            Top
                                        </button>
                                        <button
                                            onClick={() => setScryDecision(i, "bottom")}
                                            className={`px-3 py-1 rounded-lg text-sm font-semibold transition ${scryPanel.decisions[i] === "bottom" ? "bg-[#b87a00]" : "bg-[#333] hover:bg-[#444]"}`}
                                        >
                                            Bottom
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={resolveScry}
                            className="w-full bg-(--main-color) rounded-xl py-2 font-semibold hover:opacity-80 transition"
                        >
                            Confirm Scry
                        </button>
                    </div>
                </div>
            )}

            {/* ── Bottom panel ── */}
            <div className="bg-[#111] shrink-0">
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
                    {[1, 2, 3].map((n) => (
                        <button
                            key={n}
                            onClick={() => startScry(n)}
                            disabled={library.length === 0}
                            className="bg-[#2a3a2a] rounded-lg px-2 py-1 hover:bg-[#3a4a3a] transition disabled:opacity-40 text-xs"
                            title={`Look at top ${n} card${n > 1 ? "s" : ""} and choose top or bottom`}
                        >
                            Scry {n}
                        </button>
                    ))}
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
                                        className="shrink-0 flex flex-col items-center gap-1"
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
                                        <p className="text-white text-xs text-center max-w-20 truncate">
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
                        <span className="text-[#aaa] self-center text-xs mr-1 shrink-0">
                            Exile:
                        </span>
                        {exile.length === 0 && (
                            <span className="text-[#555] self-center text-sm">Empty</span>
                        )}
                        {exile.map((card, i) => (
                            <div key={`ex-${i}`} className="shrink-0 flex flex-col items-center gap-1">
                                <img
                                    src={cardImageUrl(card)}
                                    alt={card.display_name ?? card.name}
                                    className="h-20 rounded shadow"
                                    title={card.display_name ?? card.name}
                                />
                                <button onClick={() => exileCardToHand(i)} className="text-[10px] bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded px-1 py-0.5">Hand</button>
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
                        <span className="text-[#aaa] self-center text-xs mr-1 shrink-0">
                            Graveyard:
                        </span>
                        {graveyard.map((card, i) => (
                            <div
                                key={`gy-${i}`}
                                className="shrink-0 flex flex-col items-center gap-1"
                            >
                                <img
                                    src={cardImageUrl(card)}
                                    alt={card.display_name ?? card.name}
                                    className="h-20 rounded shadow"
                                    title={card.display_name ?? card.name}
                                />
                                <div className="flex gap-1 flex-wrap justify-center">
                                    <button onClick={() => graveyardCardToHand(i)} className="text-[10px] bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded px-1 py-0.5">Hand</button>
                                    <button onClick={() => graveyardCardToTop(i)} className="text-[10px] bg-[#334] hover:bg-[#445] text-white rounded px-1 py-0.5">Top</button>
                                    <button onClick={() => graveyardCardToBottom(i)} className="text-[10px] bg-[#334] hover:bg-[#445] text-white rounded px-1 py-0.5">Bottom</button>
                                </div>
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
                            className="shrink-0 cursor-pointer hover:scale-105 hover:-translate-y-2 transition-transform"
                            title={`Click to play · Right-click for more options`}
                            onMouseDown={(e) => {
                                if (e.button !== 0) return; // only left-click drags
                                startHandCardDrag(index, e.clientX, e.clientY);
                            }}
                            onTouchStart={(e) => {
                                longPressHandIndexRef.current = index;
                                handLongPress.onTouchStart(e);
                                const touch = e.touches[0];
                                if (touch) startHandCardDrag(index, touch.clientX, touch.clientY);
                            }}
                            onTouchMove={handLongPress.onTouchMove}
                            onTouchEnd={handLongPress.onTouchEnd}
                            onTouchCancel={handLongPress.onTouchCancel}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setHandContextMenu({ index, x: e.clientX, y: e.clientY });
                            }}
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
            
            {/* ── Dragging hand card ghost ── */}
            {handDragVisual && hand[handDragVisual.index] && (
                <img
                    src={cardImageUrl(hand[handDragVisual.index])}
                    alt=""
                    className="fixed pointer-events-none h-32 rounded-lg shadow-2xl opacity-90 z-100"
                    style={{
                        left: handDragVisual.x,
                        top: handDragVisual.y,
                        transform: "translate(-50%, -50%)",
                    }}
                />
            )}

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
