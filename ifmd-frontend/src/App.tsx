import {
    HashRouter as Router,
    Routes,
    Route,
} from "react-router-dom";
import Home from "./home/Home.tsx";
import Verify from "./account/VerifyAccount.tsx";
import Create from "./account/CreateAccount.tsx";
import Auth from "./account/AuthAccount.tsx";
import CreateDeck from "./decks/CreateDeck.tsx";
import { ViewUserDecks, ViewDeckFromID } from "./decks/ViewDeck.tsx";
import { Mat } from "./gameplay/mat/Mat.tsx";
import { MasterTable } from "./gameplay/MasterTable.tsx";
import Lobby from "./lobby/Lobby.tsx";
import Waiting from "./lobby/Waiting.tsx";
import { preload } from "react-dom";

function App() {
    preload("CardBack.png", {as: "image"});
    
    return (
        <>
            <Router>
                <Routes>
                    <Route path="/" element={<Home/>} />
                    <Route path="/verify/:code" element={<Verify/>} />
                    <Route path="/account/create" element={<Create/>} />
                    <Route path="/account/auth" element={<Auth/>} />
                    <Route path="/deck/create" element={<CreateDeck/>} />
                    <Route path="/deck/view/user" element={<ViewUserDecks/>} />
                    <Route path="/deck/view/:id" element={<ViewDeckFromID/>} />
                    <Route path="/lobby" element={<Lobby/>} />
                    <Route path="/waiting/:lobbyId" element={<Waiting/>} />
                    <Route path="/mat/:lobbyId" element={<Mat/>} />
                    <Route path="/table/:lobbyId" element={<MasterTable/>} />
                    <Route path="/master/:lobbyId" element={<MasterTable/>} />
                </Routes>
            </Router>
        </>
    );
}

export default App;