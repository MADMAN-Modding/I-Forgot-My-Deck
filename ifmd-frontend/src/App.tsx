import {
    BrowserRouter as Router,
    Routes,
    Route,
    Navigate,
} from "react-router-dom";
import Home from "./home/Home.tsx";
import Verify from "./account/VerifyAccount.tsx";
import Create from "./account/CreateAccount.tsx";
import Auth from "./account/AuthAccount.tsx";
import CreateDeck from "./decks/CreateDeck.tsx";
import { ViewUserDecks, ViewDeckFromID } from "./decks/ViewDeck.tsx";
import { Mat } from "./table/Mat.tsx";

function App() {
    return (
        <>
            <Router>
                <Routes>
                    <Route
                        path="/"
                        element={<Home/>}
                    />
                    <Route
                        path="/verify/:code"
                        element={<Verify/>}
                    />
                    <Route
                        path="/account/create"
                        element={<Create/>}
                    />
                    <Route
                        path="/account/auth"
                        element={<Auth/>}
                    />
                    <Route
                        path="/deck/create"
                        element={<CreateDeck/>}
                    />
                    <Route
                        path="/deck/view/user"
                        element={<ViewUserDecks/>}
                    />
                    <Route
                        path="/deck/view/:id"
                        element={<ViewDeckFromID/>}
                    />
                    <Route
                        path="/mat"
                        element={<Mat/>}
                    />
                    <Route
                        path="*"
                        element={<Navigate to="/"/>}
                    />
                </Routes>
            </Router>
        </>
    );
}

export default App;