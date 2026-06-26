import { useRef, useCallback } from "react";

const LONG_PRESS_MS = 450;
const MOVE_CANCEL_THRESHOLD = 10; // px of finger movement that cancels the long-press

/**
 * Returns touch handlers that fire `onLongPress(x, y)` after holding for
 * LONG_PRESS_MS without moving more than MOVE_CANCEL_THRESHOLD px.
 * Designed to be spread onto an element alongside existing handlers
 * (e.g. onMouseDown for drag, onContextMenu for right-click).
 */
export function useLongPress(onLongPress: (x: number, y: number) => void) {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const startRef = useRef<{ x: number; y: number } | null>(null);
    const firedRef = useRef(false);

    const clear = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        startRef.current = null;
    }, []);

    const onTouchStart = useCallback((e: React.TouchEvent) => {
        const touch = e.touches[0];
        if (!touch) return;
        if (timerRef.current) clearTimeout(timerRef.current);
        startRef.current = { x: touch.clientX, y: touch.clientY };
        firedRef.current = false;

        timerRef.current = setTimeout(() => {
            if (startRef.current) {
                firedRef.current = true;
                onLongPress(startRef.current.x, startRef.current.y);
            }
        }, LONG_PRESS_MS);
    }, [onLongPress]);

    const onTouchMove = useCallback((e: React.TouchEvent) => {
        const touch = e.touches[0];
        if (!touch || !startRef.current) return;
        const dx = touch.clientX - startRef.current.x;
        const dy = touch.clientY - startRef.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > MOVE_CANCEL_THRESHOLD) {
            clear();
        }
    }, [clear]);

    const onTouchEnd = useCallback((e: React.TouchEvent) => {
        // If the long-press already fired, swallow the resulting click/tap
        // so we don't also trigger a "play card" / drag-start action.
        if (firedRef.current) {
            e.preventDefault();
        }
        clear();
    }, [clear]);

    const onTouchCancel = useCallback(() => {
        clear();
    }, [clear]);

    return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel };
}