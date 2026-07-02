import { Link } from "react-router-dom";
import NavBar from "./NavBar";
import { useEffect, useState } from "react";
import Cookies from "js-cookie";
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
                `https://${WSS_URL}/api/account/token/${token}`
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
        <div className="mt-4 flex flex-wrap bg-[#333333] text-white w-2/3 m-auto rounded-2xl *:transition *:duration-400 *:rounded-xl *:m-auto *:pl-1 *:pr-1">
            <NavBar valid={displayName !== null && checkedAuth}/>
              {/* Auth area */}
                <>
                    {checkedAuth && displayName ? (
                        <>
                        <span className="cursor-default">
                            {displayName}
                        </span>

                        <button className="pl-1" onClick={() => {Cookies.remove("token"); window.location.reload()}}>Logout</button>
                        </>
                    ) : (
                        <div className="hover:bg-(--main-color)">
                            <Link to="/account/auth/">Login</Link>
                            &nbsp;&amp;&nbsp;
                            <Link to="/account/create">Signup</Link>
                        </div>
                    )}
                </>
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

                <p className="text-sm fixed bottom-0">I Forgot My Deck is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.</p>
            </div>
        </>
    );
}

export default Home;
