import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Login from "./Login";
import Menu from "./Menu";
import Shuffler from "./Shuffler";
// import Bundles from "./Bundles";

const App: React.FC = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("user_id");
    const name = params.get("display_name");
    const token = params.get("token");

    if (id && token) {
      setUserId(id);
      setDisplayName(name || id);
      setAccessToken(token);
      window.history.replaceState({}, document.title, "/");
    }
  }, []);

  if (!userId || !accessToken) {
    return <Login />;
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <Menu
              userName={displayName ?? ""}
              userId={userId}
              token={accessToken}
              onLogout={() => {
                setUserId(null);
                setAccessToken(null);
                setDisplayName(null);
              }}
            />
          }
        />
        <Route
          path="/shuffler"
          element={
            <Shuffler
              userId={userId}
              token={accessToken}
            />
          }
        />
        {/* <Route path="/bundles" element={<Bundles />} /> */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
