import { Link } from "react-router-dom";

interface NavBarProps {
    valid: boolean;
}

export default function NavBar({ valid }: NavBarProps) {
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


                {valid ? (
                    <>
                        <Link to="/deck/create">Create Deck</Link>

                        <Link to="/deck/view/user">View Decks</Link>

                        <Link to="/lobby">Join Game</Link>
                    </>
                ) : (
                    <>

                    </>
                )}
            </div>
        </>
    );
}