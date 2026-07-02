import { useEffect, useState } from "react";
import { getCardImage } from "../ImageHandling";

export function useCommanderImages(ids: string[]) {
    const [images, setImages] = useState<Record<string, string>>({});

    useEffect(() => {
        ids.forEach(id => {
            if (images[id] == null) {
                setImages(prev => ({ ...prev, [id]: "CardBack.png"}))
            }
        });

        if (!ids.length) return;
        ids.forEach(id => {
            getCardImage(id, true, true).then(url => {
                if (url) setImages(prev => ({ ...prev, [id]: url }));
            });
        });
    }, [ids.join(",")]);

    return images;
}