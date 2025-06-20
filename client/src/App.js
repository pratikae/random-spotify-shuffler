import React from "react";
import Playlists from "./pages/Playlists";

function App() {
  const userId = "31g6wvn3iktku5yluae55q3qmw5u?si=898f8268ec2e46df"; // my id rn
  return (
    <div>
      <h1>Spotify Queue App</h1>
      <Playlists userId={userId} />
    </div>
  );
}

export default App;
