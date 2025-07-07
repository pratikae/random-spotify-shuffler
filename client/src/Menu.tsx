import React, { useState } from "react";
import axios from "axios";

type MenuProps = {
  userName: string;
  userId: string;
  token: string;
  onLogout: () => void;
  onNavigate: (page: "shuffler") => void;
};

const Menu: React.FC<MenuProps> = ({ userName, userId, token, onLogout, onNavigate }) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleRefreshCache = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await axios.post(
        "http://localhost:8888/api/cache/refresh",
        { user_id: userId, token },
        { headers: { "Content-Type": "application/json" } }
      );
      setMessage(res.data.message || "cache refreshed successfully");
    } catch (error) {
      setMessage("error refreshing cache");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h2>welcome, {userName}!</h2>

      <button onClick={() => onNavigate("shuffler")} disabled={loading}>
        shuffle
      </button>
      <br />
      <br />
      <button onClick={handleRefreshCache} disabled={loading}>
        {loading ? "refreshing cache..." : "refresh cache"}
      </button>
      <br />
      <br />
      <button onClick={onLogout} disabled={loading}>
        logout
      </button>

      {message && <p>{message}</p>}
    </div>
  );
};

export default Menu;


// simple ui for caching with every log in

// const Menu: React.FC<MenuProps> = ({ userName, onLogout, onNavigate }) => {
//   return (
//     <div style={{ textAlign: "center", marginTop: "100px" }}>
//       <h2>welcome, {userName}</h2>
//       <button onClick={() => onNavigate("shuffler")}>shuffle</button>
//       <br /><br />
//       <button onClick={onLogout}>logout</button>
//     </div>
//   );
// };

// export default Menu;