import { useEffect, useState } from "react";
import Cookies from "js-cookie";

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
                `http://127.0.0.1:3000/api/account/token/${token}`
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
                <a href="/">Home</a>
                <a href="#news">Updates</a>
                <a
                    href="https://github.com/MADMAN-Modding/I-Forgot-My-Deck"
                    target="_blank"
                    rel="noreferrer"
                >
                    GitHub
                </a>
                <a href="#about">About</a>

                {/* Auth area */}
                <div>
                    {checkedAuth && displayName ? (
                        <span className="cursor-default">
                            {displayName}
                        </span>
                    ) : (
                        <>
                            <a href="account/auth/">Login </a>
                            &nbsp;&amp;&nbsp;
                            <a href="account/create">Signup</a>
                        </>
                    )}
                </div>
            </div>

            <div className="bg-center text-3xl font-bold text-white text-center mt-5">
                <h1>You forgot your deck, didn't you?</h1>

                <h2 className="text-xl">
                    That's ok! Add your deck{" "}
                    <a className="underline" href="">
                        here
                    </a>
                    !
                </h2>
            </div>
        </>
    );
}

export default Home;
