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

function App() {
    return (
        <>
            <Router>
                <Routes>
                    <Route
                        path="/"
                        element={<Home />}
                    />
                    <Route
                        path="/verify/:code"
                        element={<Verify />}
                    />
                    <Route
                        path="/account/create"
                        element={<Create />}
                    />
                    <Route
                        path="/account/auth"
                        element={<Auth />}
                    />
                    <Route
                        path="*"
                        element={<Navigate to="/" />}
                    />
                </Routes>
            </Router>
        </>
    );
}

export default App;