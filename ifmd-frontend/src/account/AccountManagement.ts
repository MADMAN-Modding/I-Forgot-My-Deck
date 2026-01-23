import Cookies from "js-cookie";

/**
 * Gets the token of the user
 * @returns {string | undefined}
 */
export function getToken(): string | undefined {
    return Cookies.get("token");
}