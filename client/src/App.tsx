import React, { useState, useEffect } from "react";
import Login from "./Login.tsx";
import Menu from "./Menu.tsx";
import Shuffler from "./Shuffler.tsx";

type Page = "menu" | "shuffler";

const App: React.FC = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [page, setPage] = useState<Page>("menu");

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
      userName={displayName ?? ""}
      userId={userId}
      token={accessToken}
      onLogout={handleLogout}
      onNavigate={(page: Page) => setPage(page)}
    />
  );
};

export default App;
