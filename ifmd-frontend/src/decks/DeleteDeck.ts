import { getToken } from "../account/AccountManagement";

export async function deleteDeck(deckID: string): Promise<string> {
    try {
        const token = getToken();

        if (!token) {
            return "No valid token in session, please log back in.";
        }

        const response = await fetch(`https://127.0.0.1:3000/api/decks/delete/${encodeURIComponent(token)}/${encodeURIComponent(deckID)}`);

        const data = await response.json();

        return data["msg"];
    } catch (err: any) {
        return err;
    }
}