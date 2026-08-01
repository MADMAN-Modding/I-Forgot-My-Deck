import { useEffect } from "react";

interface CardLightboxProps {
    src: string;
    alt: string;
    onClose: () => void;
}

export function CardLightbox({ src, alt, onClose }: CardLightboxProps) {
    // Close on Escape key
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 bg-black/80 z-1000 flex items-center justify-center"
            onClick={onClose}
        >
            <img
                src={src}
                alt={alt}
                className="max-h-[90vh] max-w-[90vw] rounded-3xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                draggable={false}
            />
        </div>
    );
}
