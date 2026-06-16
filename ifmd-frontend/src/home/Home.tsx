import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { Link } from "react-router-dom";
import { WSS_URL } from "../constants";

function Home() {
    const [displayName, setDisplayName] = useState(null);
    const [checkedAuth, setCheckedAuth] = useState(false);

    async function authenticateUser() {
        const token = Cookies.get("token");

        // No cookies skip auth
        if (!token) {
            setCheckedAuth(true);
            return;
        }

        try {
            const response = await fetch(
                `wss://${WSS_URL}/api/account/token/${token}`
            );

            const data = await response.json();

            if (response.ok) {
                setDisplayName(data.displayName);
            } else {
                // Invalid token
                Cookies.remove("token");
            }
        } catch (err) {
            console.error(err);
            Cookies.remove("token");
        } finally {
            setCheckedAuth(true);
        }
    }

    // Run once when homepage loads
    useEffect(() => {
        authenticateUser();
    }, []);

    return (
        <>
            <div className="mt-4 flex flex-wrap bg-[#333333] text-white w-2/3 m-auto rounded-2xl *:hover:bg-(--main-color) *:transition *:duration-400 *:rounded-xl *:m-auto *:pl-1 *:pr-1">
                <Link to="/">Home</Link>
                <Link
                    to="https://github.com/MADMAN-Modding/I-Forgot-My-Deck"
                    target="_blank"
                    rel="noreferrer"
                >
                    GitHub
                </Link>
                <Link to="/deck/create">Create Deck</Link>

                <Link to="/deck/view/user">View Decks</Link>

                <Link to="/lobby">Join Game</Link>

                {/* Auth area */}
                <div>
                    {checkedAuth && displayName ? (
                        <span className="cursor-default">
                            {displayName}
                        </span>
                    ) : (
                        <>
                            <Link to="account/auth/">Login</Link>
                            &nbsp;&amp;&nbsp;
                            <Link to="account/create">Signup</Link>
                        </>
                    )}
                </div>
            </div>

            <div className="bg-center text-3xl font-bold text-white text-center mt-5">
                <h1>You forgot your deck, didn't you?</h1>

                <h2 className="text-xl">
                    That's ok! Add your deck{" "}
                    <Link className="underline" to="deck/create">
                        here
                    </Link>
                    !
                </h2>
            </div>
        </>
    );
}

export default Home;
