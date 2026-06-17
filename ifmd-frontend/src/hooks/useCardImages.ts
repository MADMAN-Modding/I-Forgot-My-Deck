import { useEffect, useState } from "react";
import { getCardImage } from "../ImageHandling";

export function useCardImages(ids: string[]) {
    const [images, setImages] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!ids.length) return;
        ids.forEach(id => {
            getCardImage(id).then(url => {
                if (url) setImages(prev => ({ ...prev, [id]: url }));
            });
        });
    }, [ids.join(",")]);

    return images;
}