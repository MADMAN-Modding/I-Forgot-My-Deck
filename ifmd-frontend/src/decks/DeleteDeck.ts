import { getToken } from "../account/AccountManagement";
import { WSS_URL } from "../constants";

export async function deleteDeck(deckID: string): Promise<string> {
    try {
        const token = getToken();

        if (!token) {
            return "No valid token in session, please log back in.";
        }

        const response = await fetch(
            `https://${WSS_URL}/api/decks/delete/${encodeURIComponent(deckID)}/${encodeURIComponent(token)}`
        );

        const data = await response.json();

        if (!response.ok) {
            return data?.msg ?? "Failed to delete deck.";
        }

        return data?.msg ?? "Deck Deleted";
    } catch (err: any) {
        return err?.message ?? "Failed to delete deck.";
    }
}