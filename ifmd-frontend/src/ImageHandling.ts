import { getToken } from "./account/AccountManagement";
import { WSS_URL } from "./constants";

export async function getCardImage(id: string, front = true): Promise<string> {
    let base64: string = "";
    const token = getToken();

    if (!token) {
        alert("You are not logged in, please login and recreate your deck")
        return "CardBack.png";
    }

    try {
        const response = await fetch(`https://${WSS_URL}/api/card/img/${encodeURIComponent(id)}/${encodeURIComponent(front)}/${encodeURIComponent(token)}`)

        if (response.ok) {
            base64 = await response.text()
        } else {
            return "CardBack.png"
        }

    } catch (err) {
        console.error(err);
        return "CardBack.png"
    }

    if (base64 != "") {
        let blob = b64toBlob(base64, "image/png")
        return URL.createObjectURL(blob);
    } else {
        return "CardBack.png";
    }
}

// Source - https://stackoverflow.com/a/16245768
// Posted by user1114, modified by community. See post 'Timeline' for change history
// Retrieved 2026-06-17, License - CC BY-SA 4.0

const b64toBlob = (b64Data: string, contentType = '', sliceSize = 512) => {
    const byteCharacters = atob(b64Data);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize);

        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }

        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }

    const blob = new Blob(byteArrays, { type: contentType });
    return blob;
}
