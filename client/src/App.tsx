import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./Login.tsx";
import Layout from "./Layout.tsx";
import Shuffler from "./Shuffler.tsx";
import Bundles from "./Bundles.tsx";
import Search from "./Search.tsx";

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

  const handleLogout = () => {
    setUserId(null);
    setAccessToken(null);
    setDisplayName(null);
  };

  const withLayout = (component: React.ReactNode) => {
    if (!userId || !accessToken) return <Navigate to="/" replace />;
    return (
      <Layout
        userId={userId}
        token={accessToken}
        userName={displayName ?? userId}
        onLogout={handleLogout}
      >
        {component}
      </Layout>
    );
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            userId && accessToken
              ? <Navigate to="/shuffler" replace />
              : <Login />
          }
        />
        <Route path="/shuffler" element={withLayout(<Shuffler userId={userId ?? ""} token={accessToken} />)} />
        <Route path="/bundles" element={withLayout(<Bundles userId={userId ?? ""} token={accessToken} />)} />
        <Route path="/search" element={withLayout(<Search userId={userId ?? ""} token={accessToken} />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
