import React, { useEffect, useState } from "react";
import { getPlaylists } from "../services/api";

function Playlists({ userId }) {
  const [playlists, setPlaylists] = useState([]);

  useEffect(() => {
    getPlaylists(userId)
      .then(res => setPlaylists(res.data))
      .catch(console.error);
  }, [userId]);

  return (
    <div>
      <h2>Your Playlists</h2>
      <ul>
        {playlists.map(p => (
          <li key={p.id}>{p.name} - {p.num_tracks} tracks</li>
        ))}
      </ul>
    </div>
  );
}

export default Playlists;
