import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./Login.tsx";
import Menu from "./Menu.tsx";
import Shuffler from "./Shuffler.tsx";
import Bundles from "./Bundles.tsx";

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

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            userId && accessToken ? (
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
            ) : (
              <Login />
            )
          }
        />
        <Route
          path="/shuffler"
          element={
            userId && accessToken ? (
              <Shuffler userId={userId} token={accessToken} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/bundles"
          element={
            userId && accessToken ? (
              <Bundles userId={userId} token={accessToken} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
