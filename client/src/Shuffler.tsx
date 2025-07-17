import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

interface Playlist {
  id: string;
  name: string;
  num_tracks: number;
}

interface ShufflerProps {
  userId: string;
  token: string | null;
}

function Shuffler({ userId, token }: ShufflerProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [shuffleChoice, setShuffleChoice] = useState<"1" | "2" | "3" | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>("");

  const navigate = useNavigate(); 

  // fetch all playlists on load
  useEffect(() => {
    const fetchPlaylists = async () => {
      try {
        const res = await axios.get(`http://localhost:8888/api/get_playlists?user_id=${userId}`);
        setPlaylists(res.data);
      } catch {
        setMessage("failed to load playlists");
      }
    };
    fetchPlaylists();
  }, [userId]);

  const handleShuffle = async () => {
    setLoading(true);
    setMessage("");

    const payload: any = {
      token,
      code: null,
      shuffle_choice: shuffleChoice,
    };

    if (shuffleChoice === "2") {
      if (!selectedPlaylistId) {
        setMessage("please select a playlist");
        setLoading(false);
        return;
      }
      payload.playlist_id = selectedPlaylistId;
    }

    try {
      const res = await axios.post("http://localhost:8888/api/shuffle", payload);
      setMessage({ text: res.data.message, type: "success" });
    } catch (err) {
      setMessage({text: "error shuffling", type: "error"});
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h2>shuffle options</h2>
      <h3>please remember to clear your queue before shuffling!</h3>

      <div>
        <input
          type="radio"
          id="liked"
          name="shuffle_choice"
          value="1"
          checked={shuffleChoice === "1"}
          onChange={() => setShuffleChoice("1")}
        />
        <label htmlFor="liked">liked songs</label>
      </div>

      <div>
        <input
          type="radio"
          id="choose_playlist"
          name="shuffle_choice"
          value="2"
          checked={shuffleChoice === "2"}
          onChange={() => setShuffleChoice("2")}
        />
        <label htmlFor="choose_playlist">choose a playlist</label>
      </div>

      {shuffleChoice === "2" && (
        <select
          value={selectedPlaylistId}
          onChange={(e) => setSelectedPlaylistId(e.target.value)}
          disabled={loading}
          style={{ marginTop: "10px" }}
        >
          <option value="">select a playlist</option>
          {playlists.map((pl) => (
            <option key={pl.id} value={pl.id}>
              {pl.name} ({pl.num_tracks} tracks)
            </option>
          ))}
        </select>
      )}

      <div>
        <input
          type="radio"
          id="random_playlist"
          name="shuffle_choice"
          value="3"
          checked={shuffleChoice === "3"}
          onChange={() => setShuffleChoice("3")}
        />
        <label htmlFor="random_playlist">generate a random playlist</label>
      </div>

      <br />
      <br />
      <button onClick={handleShuffle} disabled={loading || !shuffleChoice}>
        shuffle
      </button>

      <br />
      <br />
      {message && (
        <div
          style={{
            marginTop: "10px",
            color: message.type === "success" ? "green" : "red",
            fontWeight: "bold",
          }}
        >
          {message.text}
        </div>
      )}

      <br /> <br />
      <button onClick={() => navigate("/")} disabled={loading}>
        back
      </button>
    </div>
  );
}

export default Shuffler;
