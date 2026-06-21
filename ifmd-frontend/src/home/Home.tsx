import { Link } from "react-router-dom";
import NavBar from "./NavBar";

function Home() {
    return (
        <>
            <NavBar></NavBar>
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
