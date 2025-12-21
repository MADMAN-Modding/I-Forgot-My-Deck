import "./App.css";
import {
    BrowserRouter as Router,
    Routes,
    Route,
    Navigate,
} from "react-router-dom";
import Home from "./account/AuthAccount.tsx";
import Verify from "./account/VerifyAccount.tsx";
import Create from "./account/CreateAccount.tsx";

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
                        path="*"
                        element={<Navigate to="/" />}
                    />
                </Routes>
            </Router>
        </>
    );
}

export default App;