import React, { useState, useEffect } from "react";
import Login from "./Login";
import Menu from "./Menu";
import Shuffler from "./Shuffler";

function App() {
  const [userId, setUserId] = useState(null);
  const [displayName, setDisplayName] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [page, setPage] = useState("menu");

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
    setDisplayName(null);
    setAccessToken(null); 
    setPage("menu");
  };

  if (!userId) {
    return <Login />;
  }

  if (page === "shuffler") {
    return (
      <Shuffler
        userId={userId}
        token={accessToken}
        onBack={() => setPage("menu")}
      />
    );
  }

  return (
    <Menu
      userName={displayName}
      onLogout={handleLogout}
      onNavigate={(page) => setPage(page)}
    />
  );
}

export default App;
