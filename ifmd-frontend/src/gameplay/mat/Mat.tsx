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
import { useLongPress } from "./useLongPress";
import { MatMasterView } from "./MatMasterView";
import { effectiveLifeTotal } from "../commanderDamage";

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

interface PointMenuState {
    x: number;
    y: number;
}

type CounterEditorMode = "plusOne" | "generic";
type DropZone = "hand" | "graveyard" | "exile" | "command-zone" | "library";
type ZoneSource = "command-zone" | "graveyard" | "exile" | "library-top";

interface ZoneDragState {
    zone: ZoneSource;
    index: number;
    card: Card;
}

interface LibraryPlacementState {
    source:
        | { kind: "battlefield"; index: number }
        | { kind: "zone"; zone: ZoneSource; index: number; card: Card };
}

function adjustNamedCounter(card: PlayedCard, counterName: string, delta: number): PlayedCard {
    const counters = [...card.counters];
    const idx = counters.findIndex((c) => c.name === counterName);
    if (idx === -1 && delta > 0) {
        counters.push({ name: counterName, amount: delta });
        return { ...card, counters };
    }
    if (idx === -1) return card;
    const nextAmount = counters[idx].amount + delta;
    if (nextAmount <= 0) {
        counters.splice(idx, 1);
    } else {
        counters[idx] = { ...counters[idx], amount: nextAmount };
    }
    return { ...card, counters };
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

export function Mat() {
    const { lobbyId } = useParams<{ lobbyId: string }>();
    const navigate = useNavigate();
    const [phase, setPhase] = useState<"deck-select" | "playing">("deck-select");
    const [checkingRejoin, setCheckingRejoin] = useState(true);
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
    const [commandZone, setCommandZone] = useState<PlayedCard[]>([]);
    const [life, setLife] = useState(40);
    const [commanderDamage, setCommanderDamage] = useState<number[]>([]);
    const [commanderDamageLabels, setCommanderDamageLabels] = useState<string[]>([]);
    const [revealTopLibrary, setRevealTopLibrary] = useState(false);
    const shownLife = effectiveLifeTotal(life, commanderDamage);

    // UI state
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [handContextMenu, setHandContextMenu] = useState<ContextMenuState | null>(null);
    const [revealedTopContextMenu, setRevealedTopContextMenu] = useState<PointMenuState | null>(null);
    const bfMenu = useMenuPosition(contextMenu?.x ?? null, contextMenu?.y ?? null);
    const handMenu = useMenuPosition(handContextMenu?.x ?? null, handContextMenu?.y ?? null);
    const revealedTopMenu = useMenuPosition(revealedTopContextMenu?.x ?? null, revealedTopContextMenu?.y ?? null);
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
    const [showMasterView, setShowMasterView] = useState(false);
    const [lobbyCopied, setLobbyCopied] = useState(false);
    const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
    const [showTokenModal, setShowTokenModal] = useState(false);
    const [tokenName, setTokenName] = useState("");
    const [counterEditor, setCounterEditor] = useState<{ index: number; mode: CounterEditorMode } | null>(null);
    const [counterAmountInput, setCounterAmountInput] = useState("1");
    const [activeDropZone, setActiveDropZone] = useState<DropZone | null>(null);
    const [zoneDragVisual, setZoneDragVisual] = useState<{ card: Card; x: number; y: number } | null>(null);
    const [libraryPlacement, setLibraryPlacement] = useState<LibraryPlacementState | null>(null);
    const [showZoneStrip, setShowZoneStrip] = useState(true);
    const [handHoverPreview, setHandHoverPreview] = useState<{
        card: Card;
        index: number;
        left: number;
        top: number;
        width: number;
        height: number;
        expanded: boolean;
    } | null>(null);
    const handHoverHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    const handDropRef = useRef<HTMLDivElement>(null);
    const libraryDropRef = useRef<HTMLButtonElement>(null);
    const graveyardDropRef = useRef<HTMLButtonElement>(null);
    const exileDropRef = useRef<HTMLButtonElement>(null);
    const commandZoneDropRef = useRef<HTMLButtonElement>(null);
    const commandZonePanelDropRef = useRef<HTMLDivElement>(null);
    const zoneDragRef = useRef<ZoneDragState | null>(null);
    const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const rejoinCheckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Synced refs for sending state from event handlers
    const handRef = useRef<Card[]>([]);
    const lifeRef = useRef(40);
    const cmdDmgRef = useRef<number[]>([]);
    const cmdDmgLabelsRef = useRef<string[]>([]);
    const bfDataRef = useRef<PlayedCard[]>([]);
    const libraryRef = useRef<Card[]>([]);
    const graveyardRef = useRef<Card[]>([]);
    const exileRef = useRef<Card[]>([]);
    const commandZoneRef = useRef<PlayedCard[]>([]);
    const revealTopLibraryRef = useRef(false);
    const commanderNameRef = useRef<string>("");
    const displayNameRef = useRef<string>("");
    const deckNameRef = useRef<string>("");
    const selfId = getToken() ?? "anonymous";

    // Image cache
    const [imageCache, setImageCache] = useState<Record<string, string>>({});
    const imageCacheRef = useRef<Record<string, string>>({});

    useEffect(() => { handRef.current = hand; }, [hand]);
    useEffect(() => { lifeRef.current = life; }, [life]);
    useEffect(() => { cmdDmgRef.current = commanderDamage; }, [commanderDamage]);
    useEffect(() => { cmdDmgLabelsRef.current = commanderDamageLabels; }, [commanderDamageLabels]);
    useEffect(() => { bfDataRef.current = battlefield; }, [battlefield]);
    useEffect(() => { libraryRef.current = library; }, [library]);
    useEffect(() => { graveyardRef.current = graveyard; }, [graveyard]);
    useEffect(() => { exileRef.current = exile; }, [exile]);
    useEffect(() => { commandZoneRef.current = commandZone; }, [commandZone]);
    useEffect(() => { revealTopLibraryRef.current = revealTopLibrary; }, [revealTopLibrary]);

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
            if (handHoverHideTimeoutRef.current) clearTimeout(handHoverHideTimeoutRef.current);
            if (rejoinCheckTimeoutRef.current) clearTimeout(rejoinCheckTimeoutRef.current);
            cleanupBattlefieldDragListeners();
            cleanupHandCardDragListeners();
            cleanupZoneCardDragListeners();
        };
    }, []);

    useEffect(() => {
        connectMatSocket();
    }, [lobbyId]);

    useEffect(() => {
        const opponents = Object.entries(players).filter(([id]) => id !== selfId);
        const labels = opponents.map(([_, data], i) => data.deck?.owner || `P${i + 1}`);
        setCommanderDamageLabels(labels);

        setCommanderDamage((prev) => {
            const next = labels.map((_, i) => prev[i] ?? 0);
            const changed =
                prev.length !== next.length ||
                prev.some((value, i) => value !== next[i]);
            return changed ? next : prev;
        });
    }, [players, selfId]);

    useEffect(() => {
        if (phase !== "playing") return;
        sendState(handRef.current, bfDataRef.current, lifeRef.current, cmdDmgRef.current);
    }, [phase, library, commandZone, revealTopLibrary, commanderDamageLabels]);

    function getDropZoneAtPoint(x: number, y: number): DropZone | null {
        const zones: Array<{ zone: DropZone; el: HTMLElement | null }> = [
            { zone: "library", el: libraryDropRef.current },
            { zone: "graveyard", el: graveyardDropRef.current },
            { zone: "exile", el: exileDropRef.current },
            { zone: "command-zone", el: commandZoneDropRef.current },
            { zone: "command-zone", el: commandZonePanelDropRef.current },
            { zone: "hand", el: handDropRef.current },
        ];

        for (const { zone, el } of zones) {
            if (!el) continue;
            const rect = el.getBoundingClientRect();
            const inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
            if (inside) return zone;
        }
        return null;
    }

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

    function setupSyncInterval(deckNameOverride?: string) {
        if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = setInterval(() => {
            const nameToSend = deckNameOverride ?? (deckNameRef.current || deckName);
            sendState(handRef.current, bfDataRef.current, lifeRef.current, cmdDmgRef.current, nameToSend);
            sendSaveState();
        }, 5000);
    }

    function handleMatSocketMessage(ws: WebSocket, rawData: string) {
        if (rawData === "MAT") return;
        try {
            const json = JSON.parse(rawData);
            if (json.type === "rejected") {
                ws.close();
                navigate("/lobby");
                return;
            }

            if (json.type === "state_restore" && json.payload) {
                // Restore previously saved game state after reconnect.
                const p = json.payload;
                const newLib: Card[] = p.library ?? [];
                const newHand: Card[] = p.hand ?? [];
                const newBf: PlayedCard[] = p.battlefield ?? [];
                const newCommandZone: PlayedCard[] = p.command_zone ?? [];
                const newGy: Card[] = p.graveyard ?? [];
                const newEx: Card[] = p.exile ?? [];
                const newLife: number = p.life ?? 40;
                const newCmdDmg: number[] = p.commander_damage ?? [];
                const newCmdDmgLabels: string[] = p.commander_damage_labels ?? [];
                const newRevealTopLibrary: boolean = p.reveal_top_library ?? false;
                const restoredDeckName: string = p.deck_name ?? "";

                setLibrary(newLib);
                setHand(newHand);
                setBattlefield(newBf);
                setCommandZone(newCommandZone);
                setGraveyard(newGy);
                setExile(newEx);
                setLife(newLife);
                setCommanderDamage(newCmdDmg);
                setCommanderDamageLabels(newCmdDmgLabels);
                setRevealTopLibrary(newRevealTopLibrary);
                setDeckName(restoredDeckName);

                handRef.current = newHand;
                lifeRef.current = newLife;
                cmdDmgRef.current = newCmdDmg;
                bfDataRef.current = newBf;
                cmdDmgLabelsRef.current = newCmdDmgLabels;
                commandZoneRef.current = newCommandZone;
                revealTopLibraryRef.current = newRevealTopLibrary;
                libraryRef.current = newLib;
                graveyardRef.current = newGy;
                exileRef.current = newEx;
                deckNameRef.current = restoredDeckName;

                if (p.commander_name) commanderNameRef.current = p.commander_name;

                setPhase("playing");
                setCheckingRejoin(false);
                if (rejoinCheckTimeoutRef.current) {
                    clearTimeout(rejoinCheckTimeoutRef.current);
                    rejoinCheckTimeoutRef.current = null;
                }
                setupSyncInterval(restoredDeckName);
                return;
            }

            if (json.type === "data" && json.clientId && json.payload) {
                setPlayers((prev) => ({ ...prev, [json.clientId]: json.payload }));
                return;
            }

            if (json.type === "table_joined") {
                // A table/master viewer just connected — immediately re-broadcast our state.
                const currentDeckName = deckNameRef.current || deckName;
                sendState(handRef.current, bfDataRef.current, lifeRef.current, cmdDmgRef.current, currentDeckName);
            }
        } catch {
            // Ignore non-JSON messages.
        }
    }

    function connectMatSocket() {
        const existing = wsRef.current;
        if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
            return existing;
        }

        const token = getToken() ?? "";
        if (!token || !lobbyId) {
            setCheckingRejoin(false);
            return null;
        }

        const ws = new WebSocket(`wss://${WSS_URL}/ws/join/${lobbyId}/MAT/${encodeURIComponent(token)}`);
        ws.onopen = () => {
            if (rejoinCheckTimeoutRef.current) clearTimeout(rejoinCheckTimeoutRef.current);
            rejoinCheckTimeoutRef.current = setTimeout(() => {
                setCheckingRejoin(false);
                rejoinCheckTimeoutRef.current = null;
            }, 1200);
        };
        ws.onmessage = (evt) => handleMatSocketMessage(ws, evt.data);
        ws.onclose = () => {
            if (rejoinCheckTimeoutRef.current) {
                clearTimeout(rejoinCheckTimeoutRef.current);
                rejoinCheckTimeoutRef.current = null;
            }
            setCheckingRejoin(false);
        };
        wsRef.current = ws;
        return ws;
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

            // Commander starts in command zone
            const initialCommandZone: PlayedCard[] = commander ? [{
                card: commander,
                show_front: true,
                tapped: false,
                location: [0, 0],
                rotation: 0,
                strength_mod: 0,
                toughness_mod: 0,
                counters: [],
            }] : [];
            const initialBattlefield: PlayedCard[] = [];

            setDeckName(selectedName);
            setLibrary(shuffled);
            setHand(openingHand);
            setBattlefield(initialBattlefield);
            setCommandZone(initialCommandZone);
            setGraveyard([]);
            setExile([]);
            setLife(40);
            setCommanderDamage([]);
            setCommanderDamageLabels([]);
            setRevealTopLibrary(false);

            handRef.current = openingHand;
            lifeRef.current = 40;
            cmdDmgRef.current = [];
            bfDataRef.current = initialBattlefield;
            commandZoneRef.current = initialCommandZone;
            revealTopLibraryRef.current = false;
            libraryRef.current = shuffled;
            graveyardRef.current = [];
            exileRef.current = [];
            deckNameRef.current = selectedName;

            connectMatSocket();
            setupSyncInterval(selectedName);
            setCheckingRejoin(false);

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

        const bfEl = battlefieldRef.current;
        const viewport = bfEl ? { width: bfEl.clientWidth, height: bfEl.clientHeight } : { width: 100, height: 100 };
        const playerData: PlayerData = {
            hand: { cards: currentHand },
            played_cards: currentBattlefield,
            life: currentLife,
            commander_damage: currentCmdDmg,
            commander_damage_labels: cmdDmgLabelsRef.current,
            // Strip deck ID and owner — other clients should never receive them
            deck: { id: "", name: currentDeckName, cards: commanderNameRef.current, owner: displayNameRef.current },
            command_zone: commandZoneRef.current,
            revealed_library_top: revealTopLibraryRef.current ? libraryRef.current[0] : undefined,
            viewport
        };

        ws.send(JSON.stringify({
            type: "data",
            clientId: selfId,
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
            command_zone: commandZoneRef.current,
            life: lifeRef.current,
            commander_damage: cmdDmgRef.current,
            commander_damage_labels: cmdDmgLabelsRef.current,
            reveal_top_library: revealTopLibraryRef.current,
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

    function moveToCommandZone(index: number) {
        const card = battlefield[index];
        const newBf = battlefield.filter((_, i) => i !== index);
        const zoneCard: PlayedCard = {
            ...card,
            tapped: false,
            location: [0, 0],
        };
        const newCommandZone = [...commandZone, zoneCard];
        setBattlefield(newBf);
        setCommandZone(newCommandZone);
        commandZoneRef.current = newCommandZone;
        sendState(hand, newBf, life, commanderDamage);
        setContextMenu(null);
    }

    function createToken() {
        const trimmedName = tokenName.trim();
        if (!trimmedName) return;
        const tokenCard: Card = {
            id: `token-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
            name: trimmedName,
            display_name: `Token - ${trimmedName}`,
            url: "",
            card_amount: 1,
            is_commander: false,
            is_two_faced: false,
        };
        const col = battlefield.length % 8;
        const row = Math.floor(battlefield.length / 8);
        const playedToken: PlayedCard = {
            card: tokenCard,
            show_front: true,
            tapped: false,
            location: [10 + col * 100, 10 + row * 150],
            rotation: 0,
            strength_mod: 0,
            toughness_mod: 0,
            counters: [],
        };
        const nextBattlefield = [...battlefield, playedToken];
        setBattlefield(nextBattlefield);
        setTokenName("");
        setShowTokenModal(false);
        sendState(hand, nextBattlefield, life, commanderDamage);
    }

    function adjustPowerToughness(index: number, delta: number) {
        const newBf = battlefield.map((card, i) =>
            i === index
                ? {
                    ...card,
                    strength_mod: card.strength_mod + delta,
                    toughness_mod: card.toughness_mod + delta,
                }
                : card
        );
        setBattlefield(newBf);
        sendState(hand, newBf, life, commanderDamage);
        setContextMenu(null);
    }

    function adjustGenericCounter(index: number, delta: number) {
        const newBf = battlefield.map((card, i) =>
            i === index ? adjustNamedCounter(card, "Counter", delta) : card
        );
        setBattlefield(newBf);
        sendState(hand, newBf, life, commanderDamage);
        setContextMenu(null);
    }

    function openCounterEditor(index: number, mode: CounterEditorMode) {
        setCounterEditor({ index, mode });
        setCounterAmountInput("1");
        setContextMenu(null);
    }

    function applyCounterEditor() {
        if (!counterEditor) return;
        const parsed = Math.trunc(Number(counterAmountInput));
        if (!Number.isFinite(parsed) || parsed === 0) return;
        if (counterEditor.mode === "plusOne") {
            const newBf = battlefield.map((card, i) =>
                i === counterEditor.index
                    ? {
                        ...card,
                        strength_mod: card.strength_mod + parsed,
                        toughness_mod: card.toughness_mod + parsed,
                    }
                    : card
            );
            setBattlefield(newBf);
            sendState(hand, newBf, life, commanderDamage);
        } else {
            const amount = Math.max(1, parsed);
            const newBf = battlefield.map((card, i) =>
                i === counterEditor.index ? adjustNamedCounter(card, "Counter", amount) : card
            );
            setBattlefield(newBf);
            sendState(hand, newBf, life, commanderDamage);
        }
        setCounterEditor(null);
    }

    function adjustSagaLore(index: number, delta: number) {
        const newBf = battlefield.map((card, i) =>
            i === index ? adjustNamedCounter(card, "Lore", delta) : card
        );
        setBattlefield(newBf);
        sendState(hand, newBf, life, commanderDamage);
        setContextMenu(null);
    }

    function adjustPowerToughnessBySign(index: number) {
        const card = battlefield[index];
        if (!card) return;
        const delta = (card.strength_mod < 0 || card.toughness_mod < 0) ? -1 : 1;
        adjustPowerToughness(index, delta);
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

    function toggleRevealTopLibrary() {
        const next = !revealTopLibrary;
        setRevealTopLibrary(next);
        revealTopLibraryRef.current = next;
        sendState(hand, battlefield, life, commanderDamage);
    }

    function moveRevealedTopToHand() {
        const card = library[0];
        if (!card) return;
        const newLibrary = library.slice(1);
        const newHand = [...hand, card];
        setLibrary(newLibrary);
        setHand(newHand);
        setRevealedTopContextMenu(null);
        sendState(newHand, battlefield, life, commanderDamage);
    }

    function moveRevealedTopToBattlefield() {
        const card = library[0];
        if (!card) return;
        const newLibrary = library.slice(1);
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
        setLibrary(newLibrary);
        setBattlefield(newBattlefield);
        setRevealedTopContextMenu(null);
        sendState(hand, newBattlefield, life, commanderDamage);
    }

    function moveRevealedTopToGraveyard() {
        const card = library[0];
        if (!card) return;
        const newLibrary = library.slice(1);
        setLibrary(newLibrary);
        setGraveyard((prev) => [...prev, card]);
        setRevealedTopContextMenu(null);
        sendState(hand, battlefield, life, commanderDamage);
    }

    function moveRevealedTopToExile() {
        const card = library[0];
        if (!card) return;
        const newLibrary = library.slice(1);
        setLibrary(newLibrary);
        setExile((prev) => [...prev, card]);
        setRevealedTopContextMenu(null);
        sendState(hand, battlefield, life, commanderDamage);
    }

    function moveRevealedTopToCommandZone() {
        const card = library[0];
        if (!card) return;
        const newLibrary = library.slice(1);
        const zoneCard: PlayedCard = {
            card,
            show_front: true,
            tapped: false,
            location: [0, 0],
            rotation: 0,
            strength_mod: 0,
            toughness_mod: 0,
            counters: [],
        };
        const newCommandZone = [...commandZone, zoneCard];
        setLibrary(newLibrary);
        setCommandZone(newCommandZone);
        commandZoneRef.current = newCommandZone;
        setRevealedTopContextMenu(null);
        sendState(hand, battlefield, life, commanderDamage);
    }

    function sendRevealedTopToBottom() {
        const card = library[0];
        if (!card) return;
        const rest = library.slice(1);
        setLibrary([...rest, card]);
        setRevealedTopContextMenu(null);
    }

    function sendRevealedTopToRandom() {
        const card = library[0];
        if (!card) return;
        const rest = library.slice(1);
        const pos = Math.floor(Math.random() * (rest.length + 1));
        const next = [...rest];
        next.splice(pos, 0, card);
        setLibrary(next);
        setRevealedTopContextMenu(null);
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

    function insertCardInLibraryByMode(currentLibrary: Card[], card: Card, mode: "top" | "bottom" | "random") {
        if (mode === "top") return [card, ...currentLibrary];
        if (mode === "bottom") return [...currentLibrary, card];
        const next = [...currentLibrary];
        const pos = Math.floor(Math.random() * (next.length + 1));
        next.splice(pos, 0, card);
        return next;
    }

    function applyLibraryPlacement(mode: "top" | "bottom" | "random") {
        const placement = libraryPlacement;
        if (!placement) return;

        if (placement.source.kind === "battlefield") {
            const card = battlefield[placement.source.index]?.card;
            if (!card) {
                setLibraryPlacement(null);
                return;
            }
            const nextBattlefield = battlefield.filter((_, i) => i !== placement.source.index);
            const nextLibrary = insertCardInLibraryByMode(library, card, mode);
            setBattlefield(nextBattlefield);
            setLibrary(nextLibrary);
            setLibraryPlacement(null);
            sendState(hand, nextBattlefield, life, commanderDamage);
            return;
        }

        const { zone, index, card } = placement.source;
        const baseLibrary = zone === "library-top" ? library.slice(1) : library;
        const nextLibrary = insertCardInLibraryByMode(baseLibrary, card, mode);
        setLibrary(nextLibrary);

        if (zone === "command-zone") {
            const nextZone = commandZone.filter((_, i) => i !== index);
            setCommandZone(nextZone);
            commandZoneRef.current = nextZone;
        } else if (zone === "graveyard") {
            setGraveyard((prev) => prev.filter((_, i) => i !== index));
        } else if (zone === "exile") {
            setExile((prev) => prev.filter((_, i) => i !== index));
        }

        setLibraryPlacement(null);
        sendState(hand, battlefield, life, commanderDamage);
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
        window.addEventListener("mousemove", handleBattlefieldDragMouseMove);
        window.addEventListener("mouseup", handleBattlefieldDragMouseUp);
        window.addEventListener("touchmove", handleBattlefieldDragTouchMove, { passive: false });
        window.addEventListener("touchend", handleBattlefieldDragTouchEnd);
        window.addEventListener("touchcancel", handleBattlefieldDragTouchEnd);
        e.preventDefault();
        e.stopPropagation();
    }

    function handleBattlefieldMouseMove(e: React.MouseEvent) {
        updateBattlefieldDrag(e.clientX, e.clientY);
    }

    function updateBattlefieldDrag(x: number, y: number) {
        const drag = draggingRef.current;
        if (!drag || !battlefieldRef.current) return;
        const rect = battlefieldRef.current.getBoundingClientRect();
        const newX = Math.max(0, Math.min(rect.width - 40, (x - rect.left) - drag.offsetX));
        const newY = Math.max(0, Math.min(rect.height - 40, (y - rect.top) - drag.offsetY));
        setBattlefield((prev) => {
            const updated = prev.map((c, i) =>
                i === drag.cardIndex
                    ? { ...c, location: [newX, newY] as [number, number] }
                    : c
            );
            bfDataRef.current = updated;
            return updated;
        });
        setActiveDropZone(getDropZoneAtPoint(x, y));
    }

    function handleBattlefieldMouseUp() {
        endBattlefieldDrag();
    }

    function endBattlefieldDrag(x?: number, y?: number) {
        const drag = draggingRef.current;
        cleanupBattlefieldDragListeners();
        draggingRef.current = null;

        const zone = typeof x === "number" && typeof y === "number" ? getDropZoneAtPoint(x, y) : activeDropZone;
        setActiveDropZone(null);
        if (!drag) return;

        if (zone === "hand") {
            returnToHand(drag.cardIndex);
            return;
        }
        if (zone === "graveyard") {
            moveToGraveyard(drag.cardIndex);
            return;
        }
        if (zone === "exile") {
            moveToExile(drag.cardIndex);
            return;
        }
        if (zone === "command-zone") {
            moveToCommandZone(drag.cardIndex);
            return;
        }
        if (zone === "library") {
            setLibraryPlacement({ source: { kind: "battlefield", index: drag.cardIndex } });
            return;
        }

        sendState(handRef.current, bfDataRef.current, lifeRef.current, cmdDmgRef.current);
    }

    function cleanupBattlefieldDragListeners() {
        window.removeEventListener("mousemove", handleBattlefieldDragMouseMove);
        window.removeEventListener("mouseup", handleBattlefieldDragMouseUp);
        window.removeEventListener("touchmove", handleBattlefieldDragTouchMove);
        window.removeEventListener("touchend", handleBattlefieldDragTouchEnd);
        window.removeEventListener("touchcancel", handleBattlefieldDragTouchEnd);
    }

    function handleBattlefieldDragMouseMove(e: MouseEvent) {
        updateBattlefieldDrag(e.clientX, e.clientY);
    }

    function handleBattlefieldDragMouseUp(e: MouseEvent) {
        endBattlefieldDrag(e.clientX, e.clientY);
    }

    function handleBattlefieldDragTouchMove(e: TouchEvent) {
        const touch = e.touches[0];
        if (!touch) return;
        e.preventDefault();
        updateBattlefieldDrag(touch.clientX, touch.clientY);
    }

    function handleBattlefieldDragTouchEnd(e: TouchEvent) {
        const touch = e.changedTouches[0];
        if (!touch) {
            endBattlefieldDrag();
            return;
        }
        endBattlefieldDrag(touch.clientX, touch.clientY);
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
        // No movement — this is a plain click, handled by onClick (lightbox).
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

    function startZoneCardDrag(zone: ZoneSource, index: number, card: Card, x: number, y: number) {
        zoneDragRef.current = { zone, index, card };
        setZoneDragVisual({ card, x, y });
        window.addEventListener("mousemove", handleZoneDragMouseMove);
        window.addEventListener("mouseup", handleZoneDragMouseUp);
        window.addEventListener("touchmove", handleZoneDragTouchMove, { passive: false });
        window.addEventListener("touchend", handleZoneDragTouchEnd);
        window.addEventListener("touchcancel", handleZoneDragTouchEnd);
    }

    function updateZoneCardDrag(x: number, y: number) {
        const drag = zoneDragRef.current;
        if (!drag) return;
        setZoneDragVisual({ card: drag.card, x, y });
        setActiveDropZone(getDropZoneAtPoint(x, y));
    }

    function endZoneCardDrag(x?: number, y?: number) {
        const drag = zoneDragRef.current;
        cleanupZoneCardDragListeners();
        zoneDragRef.current = null;
        setZoneDragVisual(null);

        if (!drag) return;
        const zone = typeof x === "number" && typeof y === "number" ? getDropZoneAtPoint(x, y) : activeDropZone;
        setActiveDropZone(null);

        if (zone === "library") {
            setLibraryPlacement({ source: { kind: "zone", zone: drag.zone, index: drag.index, card: drag.card } });
            return;
        }

        const bfEl = battlefieldRef.current;
        let droppedOnBattlefield = false;
        let bfX = 10;
        let bfY = 10;
        if (typeof x === "number" && typeof y === "number" && bfEl) {
            const rect = bfEl.getBoundingClientRect();
            droppedOnBattlefield = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
            bfX = Math.max(0, Math.min(rect.width - 40, x - rect.left - 20));
            bfY = Math.max(0, Math.min(rect.height - 40, y - rect.top - 20));
        }

        if (droppedOnBattlefield) {
            const playedCard: PlayedCard = {
                card: drag.card,
                show_front: true,
                tapped: false,
                location: [bfX, bfY],
                rotation: 0,
                strength_mod: 0,
                toughness_mod: 0,
                counters: [],
            };
            const nextBattlefield = [...battlefield, playedCard];
            let nextHand = hand;
            let nextGy = graveyard;
            let nextEx = exile;
            let nextCz = commandZone;
            let nextLib = library;

            if (drag.zone === "command-zone") {
                nextCz = commandZone.filter((_, i) => i !== drag.index);
            } else if (drag.zone === "graveyard") {
                nextGy = graveyard.filter((_, i) => i !== drag.index);
            } else if (drag.zone === "exile") {
                nextEx = exile.filter((_, i) => i !== drag.index);
            } else if (drag.zone === "library-top") {
                nextLib = library.slice(1);
            }

            setBattlefield(nextBattlefield);
            setHand(nextHand);
            setGraveyard(nextGy);
            setExile(nextEx);
            setCommandZone(nextCz);
            setLibrary(nextLib);
            commandZoneRef.current = nextCz;

            sendState(nextHand, nextBattlefield, life, commanderDamage);
            return;
        }

        if (!zone) return;

        let nextHand = hand;
        let nextBattlefield = battlefield;
        let nextGy = graveyard;
        let nextEx = exile;
        let nextCz = commandZone;
        let nextLib = library;

        const sourceIsSameZone =
            (drag.zone === "command-zone" && zone === "command-zone") ||
            (drag.zone === "graveyard" && zone === "graveyard") ||
            (drag.zone === "exile" && zone === "exile");
        if (sourceIsSameZone) return;

        if (drag.zone === "command-zone") {
            nextCz = commandZone.filter((_, i) => i !== drag.index);
        } else if (drag.zone === "graveyard") {
            nextGy = graveyard.filter((_, i) => i !== drag.index);
        } else if (drag.zone === "exile") {
            nextEx = exile.filter((_, i) => i !== drag.index);
        } else if (drag.zone === "library-top") {
            nextLib = library.slice(1);
        }

        if (zone === "hand") {
            nextHand = [...nextHand, drag.card];
        } else if (zone === "graveyard") {
            nextGy = [...nextGy, drag.card];
        } else if (zone === "exile") {
            nextEx = [...nextEx, drag.card];
        } else if (zone === "command-zone") {
            nextCz = [
                ...nextCz,
                {
                    card: drag.card,
                    show_front: true,
                    tapped: false,
                    location: [0, 0],
                    rotation: 0,
                    strength_mod: 0,
                    toughness_mod: 0,
                    counters: [],
                },
            ];
        }

        setHand(nextHand);
        setBattlefield(nextBattlefield);
        setGraveyard(nextGy);
        setExile(nextEx);
        setCommandZone(nextCz);
        setLibrary(nextLib);
        commandZoneRef.current = nextCz;

        sendState(nextHand, nextBattlefield, life, commanderDamage);
    }

    function cleanupZoneCardDragListeners() {
        window.removeEventListener("mousemove", handleZoneDragMouseMove);
        window.removeEventListener("mouseup", handleZoneDragMouseUp);
        window.removeEventListener("touchmove", handleZoneDragTouchMove);
        window.removeEventListener("touchend", handleZoneDragTouchEnd);
        window.removeEventListener("touchcancel", handleZoneDragTouchEnd);
    }

    function handleZoneDragMouseMove(e: MouseEvent) {
        updateZoneCardDrag(e.clientX, e.clientY);
    }

    function handleZoneDragMouseUp(e: MouseEvent) {
        endZoneCardDrag(e.clientX, e.clientY);
    }

    function handleZoneDragTouchMove(e: TouchEvent) {
        const touch = e.touches[0];
        if (!touch) return;
        e.preventDefault();
        updateZoneCardDrag(touch.clientX, touch.clientY);
    }

    function handleZoneDragTouchEnd(e: TouchEvent) {
        const touch = e.changedTouches[0];
        if (!touch) {
            endZoneCardDrag();
            return;
        }
        endZoneCardDrag(touch.clientX, touch.clientY);
    }

    // ── Render: deck selection ────────────────────────────────────────────────

    if (phase === "deck-select") {
        if (checkingRejoin) {
            return (
                <div className="text-white text-center mt-10">
                    <h1 className="text-3xl font-bold mb-3">Rejoining Game...</h1>
                    <p className="text-[#aaa] mb-4">
                        Lobby: <span className="text-white font-mono">{lobbyId}</span>
                    </p>
                    <p className="text-[#888]">Checking for a saved session.</p>
                </div>
            );
        }

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
            onClick={() => { setContextMenu(null); setHandContextMenu(null); setRevealedTopContextMenu(null); }}
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
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowMasterView(true);
                    }}
                    className="bg-[#444] rounded-lg px-3 py-1 text-sm hover:bg-[#555] transition"
                >
                    Master View ({Object.keys(players).length !== 0 ? Object.keys(players).length : 1})
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
                    <span className="text-3xl font-bold w-14 text-center">{shownLife}</span>
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
                <span className="text-[#aaa]">Cmdr damage:</span>
                {commanderDamage.length === 0 && (
                    <span className="text-[#666] text-xs">Waiting for opponents...</span>
                )}
                {commanderDamage.map((dmg, i) => (
                    <div key={i} className="flex items-center gap-1">
                        <span className="text-[#aaa]">{commanderDamageLabels[i] ?? `P${i + 1}`}:</span>
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
            </div>

            {/* ── Battlefield ── */}
            <div
                ref={battlefieldRef}
                className="flex-1 relative bg-[#1a3020] overflow-hidden"
                style={{ minHeight: "200px" }}
                onMouseMove={handleBattlefieldMouseMove}
                onMouseUp={handleBattlefieldMouseUp}
            >
                {battlefield.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-[#2a5a30] text-xl pointer-events-none">
                        Battlefield – drag a card in hand to play it here
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
                                window.addEventListener("touchmove", handleBattlefieldDragTouchMove, { passive: false });
                                window.addEventListener("touchend", handleBattlefieldDragTouchEnd);
                                window.addEventListener("touchcancel", handleBattlefieldDragTouchEnd);
                            }
                        }}
                        onTouchMove={(e) => {
                            bfLongPress.onTouchMove(e);
                            const touch = e.touches[0];
                            if (!touch) return;
                            updateBattlefieldDrag(touch.clientX, touch.clientY);
                        }}
                        onTouchEnd={(e) => {
                            bfLongPress.onTouchEnd(e);
                            const touch = e.changedTouches[0];
                            if (touch) endBattlefieldDrag(touch.clientX, touch.clientY);
                            else endBattlefieldDrag();
                        }}
                        onTouchCancel={(_) => {
                            bfLongPress.onTouchCancel();
                            endBattlefieldDrag();
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
                            style={tokenFrontStyle(pc.card, pc.show_front)}
                            draggable={false}
                            title={pc.card.display_name ?? pc.card.name}
                        />
                        {tokenBannerName(pc.card) && (
                            <div className="absolute top-0 left-0 right-0 w-full bg-black/85 text-white text-[10px] text-center leading-none py-1 rounded-t-lg px-1 truncate">
                                {tokenBannerName(pc.card)}
                            </div>
                        )}
                        {(pc.strength_mod !== 0 || pc.toughness_mod !== 0) && (
                            <div
                                className="absolute bottom-0 right-0 bg-black text-white text-xs rounded px-1 cursor-pointer"
                                title="Click to add same-sign power/toughness counter"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    adjustPowerToughnessBySign(index);
                                }}
                            >
                                {pc.strength_mod > 0 ? "+" : ""}
                                {pc.strength_mod}/
                                {pc.toughness_mod > 0 ? "+" : ""}
                                {pc.toughness_mod}
                            </div>
                        )}
                        {(() => {
                            const genericCount = pc.counters.find((c) => c.name === "Counter")?.amount ?? 0;
                            if (genericCount <= 0) return null;
                            return (
                                <div
                                    className="absolute bottom-0 left-0 bg-black text-white text-xs rounded px-1 cursor-pointer"
                                    title="Click to add generic counter"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        adjustGenericCounter(index, 1);
                                    }}
                                >
                                    {genericCount}
                                </div>
                            );
                        })()}
                        {pc.counters.some((c) => c.name !== "Counter") && (
                            <div
                                className="absolute left-0 bg-black text-white text-xs rounded px-1 cursor-pointer"
                                style={{ top: tokenBannerName(pc.card) ? "16px" : "0" }}
                                title="Click to add Lore counter"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    adjustSagaLore(index, 1);
                                }}
                            >
                                {pc.counters
                                    .filter((c) => c.name !== "Counter")
                                    .map((c) => `${c.amount} ${c.name}`)
                                    .join(" ")}
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
                    <div
                        className="block w-full text-left px-4 py-2 text-[#888]"
                        title="Drag the card onto Hand, Graveyard, Exile, or Command Zone"
                    >
                        Drag to move between zones
                    </div>
                    <div className="my-1 border-t border-[#444]" />
                    <button
                        className="block w-full text-left px-4 py-2 hover:bg-[#3a3a3a]"
                        onClick={() => adjustPowerToughness(contextMenu.index, 1)}
                    >
                        +1/+1 Counter
                    </button>
                    <button
                        className="block w-full text-left px-4 py-2 hover:bg-[#3a3a3a]"
                        onClick={() => adjustPowerToughness(contextMenu.index, -1)}
                    >
                        -1/-1 Counter
                    </button>
                    <button
                        className="block w-full text-left px-4 py-2 hover:bg-[#3a3a3a]"
                        onClick={() => openCounterEditor(contextMenu.index, "plusOne")}
                    >
                        Add Multiple +1/+1...
                    </button>
                    <button
                        className="block w-full text-left px-4 py-2 hover:bg-[#3a3a3a]"
                        onClick={() => adjustGenericCounter(contextMenu.index, 1)}
                    >
                        Add Counter
                    </button>
                    <button
                        className="block w-full text-left px-4 py-2 hover:bg-[#3a3a3a]"
                        onClick={() => adjustGenericCounter(contextMenu.index, -1)}
                    >
                        Remove Counter
                    </button>
                    <button
                        className="block w-full text-left px-4 py-2 hover:bg-[#3a3a3a]"
                        onClick={() => openCounterEditor(contextMenu.index, "generic")}
                    >
                        Add Multiple Counters...
                    </button>
                    <button
                        className="block w-full text-left px-4 py-2 hover:bg-[#3a3a3a]"
                        onClick={() => adjustSagaLore(contextMenu.index, 1)}
                    >
                        Add Lore (Saga)
                    </button>
                    <button
                        className="block w-full text-left px-4 py-2 hover:bg-[#3a3a3a]"
                        onClick={() => adjustSagaLore(contextMenu.index, -1)}
                    >
                        Remove Lore (Saga)
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
                    <button className="block w-full text-left px-4 py-2 hover:bg-[#3a3a3a]" onClick={() => sendHandCardToTop(handContextMenu.index)}>
                        Return to Library (Top)
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
                    <button
                        ref={libraryDropRef}
                        type="button"
                        className={`rounded-lg px-3 py-1 transition ${activeDropZone === "library" ? "bg-[#345057] ring-2 ring-[#7fd6e7]" : "bg-[#244047] hover:bg-[#2c5660]"}`}
                        title="Drop cards here to choose Top / Bottom / Random"
                    >
                        Library: {library.length}
                    </button>
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
                        ref={graveyardDropRef}
                        onClick={() => setShowGraveyard(!showGraveyard)}
                        className={`rounded-lg px-3 py-1 transition ${activeDropZone === "graveyard" ? "bg-[#6a4a4a] ring-2 ring-[#d08787]" : "bg-[#333] hover:bg-[#444]"}`}
                    >
                        Graveyard: {graveyard.length}
                    </button>
                    <button
                        ref={exileDropRef}
                        onClick={() => setShowExile(!showExile)}
                        className={`rounded-lg px-3 py-1 transition ${activeDropZone === "exile" ? "bg-[#7a5a00] ring-2 ring-[#e0bd67]" : "bg-[#4a3a00] hover:bg-[#5a4a00]"}`}
                    >
                        Exile: {exile.length}
                    </button>
                    <button
                        ref={commandZoneDropRef}
                        type="button"
                        className={`rounded-lg px-3 py-1 transition ${activeDropZone === "command-zone" ? "bg-[#5b3d77] ring-2 ring-[#bc9ce2]" : "bg-[#2f274a]"}`}
                        title="Drag battlefield cards here to move them to command zone"
                    >
                        Command Zone: {commandZone.length}
                    </button>
                    <button
                        onClick={() => setShowZoneStrip((prev) => !prev)}
                        className="bg-[#333] rounded-lg px-3 py-1 hover:bg-[#444] transition"
                        title="Show or hide the zone strip between controls and hand"
                    >
                        {showZoneStrip ? "Hide Zones" : "Show Zones"}
                    </button>
                    <button
                        onClick={() => setShowTokenModal(true)}
                        className="bg-[#2f274a] rounded-lg px-3 py-1 hover:bg-[#3f3760] transition"
                    >
                        Create Token
                    </button>
                    <button
                        onClick={toggleRevealTopLibrary}
                        className={`rounded-lg px-3 py-1 transition ${revealTopLibrary ? "bg-[#2e5d33] hover:bg-[#3a7341]" : "bg-[#444] hover:bg-[#555]"}`}
                    >
                        {revealTopLibrary ? "Hide Top Card" : "Reveal Top Card"}
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

                {showZoneStrip && (commandZone.length > 0 || revealTopLibrary) && (
                    <div
                        className="flex gap-3 overflow-x-auto p-2 bg-[#151522] border-t border-[#333]"
                        style={{ maxHeight: "155px" }}
                    >
                        <div
                            ref={commandZonePanelDropRef}
                            className={`shrink-0 rounded p-1 transition ${activeDropZone === "command-zone" ? "bg-[#352047] ring-2 ring-[#bc9ce2]" : ""}`}
                        >
                            <span className="text-[#aaa] text-xs">Command Zone</span>
                            <div className="flex gap-2 mt-1">
                                {commandZone.length === 0 && (
                                    <span className="text-[#555] self-center text-sm">Empty</span>
                                )}
                                {commandZone.map((pc, i) => (
                                    <div key={`cz-${i}`} className="shrink-0 flex flex-col items-center gap-1">
                                        <img
                                            src={cardImageUrl(pc.card, pc.show_front)}
                                            alt={pc.card.display_name ?? pc.card.name}
                                            className="h-24 rounded shadow"
                                            title={pc.card.display_name ?? pc.card.name}
                                            draggable={false}
                                            onMouseDown={(e) => {
                                                if (e.button !== 0) return;
                                                e.preventDefault();
                                                e.stopPropagation();
                                                startZoneCardDrag("command-zone", i, pc.card, e.clientX, e.clientY);
                                            }}
                                            onTouchStart={(e) => {
                                                const touch = e.touches[0];
                                                if (touch) {
                                                    e.preventDefault();
                                                    startZoneCardDrag("command-zone", i, pc.card, touch.clientX, touch.clientY);
                                                }
                                            }}
                                            onTouchMove={(e) => {
                                                const touch = e.touches[0];
                                                if (!touch) return;
                                                e.preventDefault();
                                                updateZoneCardDrag(touch.clientX, touch.clientY);
                                            }}
                                            onTouchEnd={(e) => {
                                                const touch = e.changedTouches[0];
                                                if (touch) endZoneCardDrag(touch.clientX, touch.clientY);
                                                else endZoneCardDrag();
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                        {revealTopLibrary && (
                            <div className="shrink-0 border-l border-[#333] pl-3">
                                <span className="text-[#aaa] text-xs">Revealed Top Card</span>
                                <div className="mt-1">
                                    {library[0] ? (
                                        <img
                                            src={cardImageUrl(library[0])}
                                            alt={library[0].display_name ?? library[0].name}
                                            className="h-24 rounded shadow"
                                            title={library[0].display_name ?? library[0].name}
                                            draggable={false}
                                            onMouseDown={(e) => {
                                                if (e.button !== 0) return;
                                                e.preventDefault();
                                                e.stopPropagation();
                                                startZoneCardDrag("library-top", 0, library[0], e.clientX, e.clientY);
                                            }}
                                            onContextMenu={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setRevealedTopContextMenu({ x: e.clientX, y: e.clientY });
                                            }}
                                            onTouchStart={(e) => {
                                                const touch = e.touches[0];
                                                if (touch) {
                                                    e.preventDefault();
                                                    startZoneCardDrag("library-top", 0, library[0], touch.clientX, touch.clientY);
                                                }
                                            }}
                                            onTouchMove={(e) => {
                                                const touch = e.touches[0];
                                                if (!touch) return;
                                                e.preventDefault();
                                                updateZoneCardDrag(touch.clientX, touch.clientY);
                                            }}
                                            onTouchEnd={(e) => {
                                                const touch = e.changedTouches[0];
                                                if (touch) endZoneCardDrag(touch.clientX, touch.clientY);
                                                else endZoneCardDrag();
                                            }}
                                        />
                                    ) : (
                                        <span className="text-[#555] self-center text-sm">Library empty</span>
                                    )}
                                </div>
                            </div>
                        )}
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
                                    draggable={false}
                                    onMouseDown={(e) => {
                                        if (e.button !== 0) return;
                                        e.preventDefault();
                                        e.stopPropagation();
                                        startZoneCardDrag("exile", i, card, e.clientX, e.clientY);
                                    }}
                                    onTouchStart={(e) => {
                                        const touch = e.touches[0];
                                        if (touch) {
                                            e.preventDefault();
                                            startZoneCardDrag("exile", i, card, touch.clientX, touch.clientY);
                                        }
                                    }}
                                    onTouchMove={(e) => {
                                        const touch = e.touches[0];
                                        if (!touch) return;
                                        e.preventDefault();
                                        updateZoneCardDrag(touch.clientX, touch.clientY);
                                    }}
                                    onTouchEnd={(e) => {
                                        const touch = e.changedTouches[0];
                                        if (touch) endZoneCardDrag(touch.clientX, touch.clientY);
                                        else endZoneCardDrag();
                                    }}
                                />
                                <button onClick={() => exileCardToHand(i)} className="text-[10px] bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded px-1 py-0.5">Hand</button>
                            </div>
                        ))}
                    </div>
                )}

                {revealedTopContextMenu && (
                    <div
                        ref={revealedTopMenu.ref}
                        className="fixed bg-[#2a2a2a] border border-[#555] rounded-lg shadow-xl z-50 py-1 text-sm"
                        style={{ left: revealedTopMenu.pos.x, top: revealedTopMenu.pos.y }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button className="block w-full text-left px-4 py-2 hover:bg-[#3a3a3a]" onClick={moveRevealedTopToHand}>Move to Hand</button>
                        <button className="block w-full text-left px-4 py-2 hover:bg-[#3a3a3a]" onClick={moveRevealedTopToBattlefield}>Move to Battlefield</button>
                        <button className="block w-full text-left px-4 py-2 hover:bg-[#3a3a3a]" onClick={moveRevealedTopToGraveyard}>Move to Graveyard</button>
                        <button className="block w-full text-left px-4 py-2 hover:bg-[#3a3a3a]" onClick={moveRevealedTopToExile}>Move to Exile</button>
                        <button className="block w-full text-left px-4 py-2 hover:bg-[#3a3a3a]" onClick={moveRevealedTopToCommandZone}>Move to Command Zone</button>
                        <div className="my-1 border-t border-[#444]" />
                        <button className="block w-full text-left px-4 py-2 hover:bg-[#3a3a3a]" onClick={sendRevealedTopToBottom}>Send to Bottom</button>
                        <button className="block w-full text-left px-4 py-2 hover:bg-[#3a3a3a]" onClick={sendRevealedTopToRandom}>Insert Randomly</button>
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
                                    draggable={false}
                                    onMouseDown={(e) => {
                                        if (e.button !== 0) return;
                                        e.preventDefault();
                                        e.stopPropagation();
                                        startZoneCardDrag("graveyard", i, card, e.clientX, e.clientY);
                                    }}
                                    onTouchStart={(e) => {
                                        const touch = e.touches[0];
                                        if (touch) {
                                            e.preventDefault();
                                            startZoneCardDrag("graveyard", i, card, touch.clientX, touch.clientY);
                                        }
                                    }}
                                    onTouchMove={(e) => {
                                        const touch = e.touches[0];
                                        if (!touch) return;
                                        e.preventDefault();
                                        updateZoneCardDrag(touch.clientX, touch.clientY);
                                    }}
                                    onTouchEnd={(e) => {
                                        const touch = e.changedTouches[0];
                                        if (touch) endZoneCardDrag(touch.clientX, touch.clientY);
                                        else endZoneCardDrag();
                                    }}
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
                    ref={handDropRef}
                    className={`relative z-40 flex gap-2 overflow-x-auto p-2 border-t border-[#333] transition ${activeDropZone === "hand" ? "bg-[#15283a] ring-2 ring-[#6ea7d8]" : ""}`}
                    style={{ maxHeight: "160px" }}
                >
                    {activeDropZone === "hand" && (
                        <div className="absolute right-4 bottom-36 bg-[#1d3b5a] text-white text-xs px-2 py-1 rounded z-40 pointer-events-none">
                            Drop to return to hand
                        </div>
                    )}
                    {hand.map((card, index) => (
                        <div
                            key={`hand-${index}`}
                            className={`shrink-0 cursor-pointer relative transition-opacity duration-75 ${handHoverPreview?.index === index ? "opacity-0" : "opacity-100"}`}
                            title={`Click to enlarge · Right-click for more options`}
                            onMouseEnter={(e) => {
                                if (handHoverHideTimeoutRef.current) {
                                    clearTimeout(handHoverHideTimeoutRef.current);
                                    handHoverHideTimeoutRef.current = null;
                                }
                                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                                setHandHoverPreview({
                                    card,
                                    index,
                                    left: rect.left,
                                    top: rect.top,
                                    width: rect.width,
                                    height: rect.height,
                                    expanded: false,
                                });
                                requestAnimationFrame(() => {
                                    setHandHoverPreview((prev) => {
                                        if (!prev || prev.index !== index) return prev;
                                        return { ...prev, expanded: true };
                                    });
                                });
                            }}
                            onMouseLeave={() => {
                                setHandHoverPreview((prev) => {
                                    if (!prev || prev.index !== index) return prev;
                                    return { ...prev, expanded: false };
                                });
                                handHoverHideTimeoutRef.current = setTimeout(() => {
                                    setHandHoverPreview((prev) => (prev?.index === index ? null : prev));
                                    handHoverHideTimeoutRef.current = null;
                                }, 140);
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                setLightbox({
                                    src: cardImageUrl(card),
                                    alt: card.display_name ?? card.name,
                                });
                            }}
                            onMouseDown={(e) => {
                                if (e.button !== 0) return; // only left-click drags
                                setHandHoverPreview(null);
                                if (handHoverHideTimeoutRef.current) {
                                    clearTimeout(handHoverHideTimeoutRef.current);
                                    handHoverHideTimeoutRef.current = null;
                                }
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

            {handHoverPreview && !handDragVisual && !contextMenu && (
                <img
                    src={cardImageUrl(handHoverPreview.card)}
                    alt=""
                    className="fixed pointer-events-none rounded-xl shadow-2xl z-40"
                    style={{
                        left: handHoverPreview.left + handHoverPreview.width / 2,
                        top: handHoverPreview.top + handHoverPreview.height / 2 - (handHoverPreview.expanded ? 34 : 0),
                        width: handHoverPreview.expanded ? handHoverPreview.width * 1.65 : handHoverPreview.width,
                        height: handHoverPreview.expanded ? handHoverPreview.height * 1.65 : handHoverPreview.height,
                        transform: "translate(-50%, -50%)",
                        transition: "width 150ms ease-out, height 150ms ease-out, top 150ms ease-out",
                    }}
                />
            )}

            {zoneDragVisual && (
                <img
                    src={cardImageUrl(zoneDragVisual.card)}
                    alt=""
                    className="fixed pointer-events-none h-32 rounded-lg shadow-2xl opacity-90 z-100"
                    style={{
                        left: zoneDragVisual.x,
                        top: zoneDragVisual.y,
                        transform: "translate(-50%, -50%)",
                    }}
                />
            )}

            {libraryPlacement && (
                <div
                    className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center"
                    onClick={() => setLibraryPlacement(null)}
                >
                    <div
                        className="bg-[#111] rounded-2xl p-5 w-11/12 max-w-sm"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-lg font-bold mb-2">Send To Library</h2>
                        <p className="text-xs text-[#888] mb-4">Choose where to place this card in the library.</p>
                        <div className="flex gap-2">
                            <button onClick={() => applyLibraryPlacement("top")} className="flex-1 bg-[#334] hover:bg-[#445] rounded px-3 py-2 text-sm">Top</button>
                            <button onClick={() => applyLibraryPlacement("bottom")} className="flex-1 bg-[#334] hover:bg-[#445] rounded px-3 py-2 text-sm">Bottom</button>
                            <button onClick={() => applyLibraryPlacement("random")} className="flex-1 bg-[#2f4f33] hover:bg-[#3c6542] rounded px-3 py-2 text-sm">Random</button>
                        </div>
                    </div>
                </div>
            )}

            {showTokenModal && (
                <div
                    className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center"
                    onClick={() => setShowTokenModal(false)}
                >
                    <div
                        className="bg-[#111] rounded-2xl p-5 w-11/12 max-w-md"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-lg font-bold mb-3">Create Token</h2>
                        <p className="text-xs text-[#888] mb-3">Token appears on battlefield and can be tracked like other permanents.</p>
                        <input
                            type="text"
                            value={tokenName}
                            onChange={(e) => setTokenName(e.target.value)}
                            placeholder="Token name (for example, Soldier)"
                            className="w-full bg-[#222] border border-[#444] rounded px-3 py-2 text-sm mb-4"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setShowTokenModal(false)}
                                className="bg-[#333] hover:bg-[#444] rounded px-3 py-1 text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={createToken}
                                disabled={!tokenName.trim()}
                                className="bg-(--main-color) rounded px-3 py-1 text-sm disabled:opacity-40"
                            >
                                Add Token
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {counterEditor && (
                <div
                    className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center"
                    onClick={() => setCounterEditor(null)}
                >
                    <div
                        className="bg-[#111] rounded-2xl p-5 w-11/12 max-w-sm"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-lg font-bold mb-2">
                            {counterEditor.mode === "plusOne" ? "Add +1/+1 Counters" : "Add Counters"}
                        </h2>
                        <p className="text-xs text-[#888] mb-3">
                            {counterEditor.mode === "plusOne"
                                ? "Use positive or negative numbers to adjust power/toughness equally."
                                : "This updates the generic counter badge on the bottom-left of the card."}
                        </p>
                        <input
                            type="number"
                            step={1}
                            value={counterAmountInput}
                            onChange={(e) => setCounterAmountInput(e.target.value)}
                            className="w-full bg-[#222] border border-[#444] rounded px-3 py-2 text-sm mb-4"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setCounterEditor(null)}
                                className="bg-[#333] hover:bg-[#444] rounded px-3 py-1 text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={applyCounterEditor}
                                className="bg-(--main-color) rounded px-3 py-1 text-sm"
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Lightbox ── */}
            {lightbox && (
                <CardLightbox
                    src={lightbox.src}
                    alt={lightbox.alt}
                    onClose={() => setLightbox(null)}
                />
            )}

            {showMasterView && (
                <MatMasterView
                    lobbyId={lobbyId ?? ""}
                    players={players}
                    selfId={selfId}
                    selfData={{
                        hand: { cards: hand },
                        played_cards: battlefield,
                        life,
                        commander_damage: commanderDamage,
                        commander_damage_labels: commanderDamageLabels,
                        deck: {
                            id: "",
                            owner: displayNameRef.current,
                            name: deckName,
                            cards: commanderNameRef.current,
                        },
                        command_zone: commandZone,
                        revealed_library_top: revealTopLibrary ? library[0] : undefined,
                        viewport: battlefieldRef.current
                            ? { width: battlefieldRef.current.clientWidth, height: battlefieldRef.current.clientHeight }
                            : { width: 100, height: 100 },
                    }}
                    onClose={() => setShowMasterView(false)}
                />
            )}
        </div>
    );
}
