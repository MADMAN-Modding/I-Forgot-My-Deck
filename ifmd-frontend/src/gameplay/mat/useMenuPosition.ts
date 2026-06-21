import { useLayoutEffect, useRef, useState } from "react";

/** Clamps a context-menu's position so it never overflows the viewport. */
export function useMenuPosition(rawX: number | null, rawY: number | null) {
    const ref = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ x: rawX ?? 0, y: rawY ?? 0 });

    useLayoutEffect(() => {
        if (rawX === null || rawY === null) return;
        const el = ref.current;
        if (!el) {
            setPos({ x: rawX, y: rawY });
            return;
        }
        const { offsetWidth: w, offsetHeight: h } = el;
        const x = Math.min(rawX, window.innerWidth - w - 8);
        const y = Math.min(rawY, window.innerHeight - h - 8);
        setPos({ x: Math.max(8, x), y: Math.max(8, y) });
    }, [rawX, rawY]);

    return { ref, pos };
}
