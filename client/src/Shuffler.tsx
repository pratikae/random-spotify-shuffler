import React, { useState, useEffect } from "react";
import axios from "axios";

interface Playlist {
  id: string;
  name: string;
  num_tracks: number;
  image_url: string | null;
}

interface ShufflerProps {
  userId: string;
  token: string | null;
}

function Shuffler({ userId, token }: ShufflerProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(`pinned_${userId}`);
      return new Set(stored ? JSON.parse(stored) : []);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    const fetchPlaylists = async () => {
      try {
        const res = await axios.get(`/api/get_playlists?user_id=${userId}`);
        setPlaylists(res.data);
      } catch {
        setMessage({ text: "failed to load playlists", type: "error" });
      }
    };
    fetchPlaylists();
  }, [userId]);

  const togglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem(`pinned_${userId}`, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const handleShuffle = async (choice: "1" | "2" | "3", playlistId?: string, cardId?: string) => {
    if (loading) return;
    setLoading(true);
    setMessage(null);
    setActiveCardId(cardId ?? null);

    const payload: Record<string, unknown> = { token, code: null, shuffle_choice: choice };
    if (choice === "2" && playlistId) payload.playlist_id = playlistId;

    try {
      const res = await axios.post("/api/shuffle", payload);
      setMessage({ text: res.data.message, type: "success" });
    } catch {
      setMessage({ text: "error shuffling — is spotify open?", type: "error" });
    } finally {
      setLoading(false);
      setActiveCardId(null);
    }
  };

  const pinnedPlaylists = playlists.filter((pl) => pinnedIds.has(pl.id));
  const unpinnedPlaylists = playlists.filter((pl) => !pinnedIds.has(pl.id));

  const cardBase: React.CSSProperties = {
    backgroundColor: "var(--card-bg)",
    borderRadius: "8px",
    padding: "12px",
    cursor: "pointer",
    transition: "background-color 0.2s",
    userSelect: "none",
    position: "relative",
  };

  const PinButton = ({ id }: { id: string }) => {
    const pinned = pinnedIds.has(id);
    const visible = pinned || hoveredCardId === id;
    return (
      <button
        onClick={(e) => togglePin(id, e)}
        title={pinned ? "unpin" : "pin to top"}
        style={{
          position: "absolute",
          top: "8px",
          right: "8px",
          background: pinned ? "rgba(175,105,255,0.85)" : "rgba(0,0,0,0.6)",
          border: "none",
          borderRadius: "50%",
          width: "26px",
          height: "26px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.75rem",
          cursor: "pointer",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.15s",
          zIndex: 2,
          color: "#fff",
        }}
      >
        📌
      </button>
    );
  };

  const PlaylistCard = ({ pl }: { pl: Playlist }) => (
    <div
      style={{
        ...cardBase,
        opacity: loading && activeCardId !== pl.id ? 0.5 : 1,
      }}
      onClick={() => handleShuffle("2", pl.id, pl.id)}
      onMouseEnter={(e) => {
        setHoveredCardId(pl.id);
        if (!loading) (e.currentTarget as HTMLDivElement).style.backgroundColor = "var(--hover)";
      }}
      onMouseLeave={(e) => {
        setHoveredCardId(null);
        (e.currentTarget as HTMLDivElement).style.backgroundColor = "var(--card-bg)";
      }}
    >
      <PinButton id={pl.id} />
      <div
        style={{
          width: "100%",
          paddingBottom: "100%",
          borderRadius: "4px",
          backgroundColor: "#333",
          marginBottom: "12px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {pl.image_url ? (
          <img
            src={pl.image_url}
            alt={pl.name}
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span
            style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              fontSize: "2rem", color: "var(--muted)",
            }}
          >
            🎵
          </span>
        )}
      </div>
      <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#fff", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {pl.name}
      </div>
      <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
        {pl.num_tracks} tracks
        {activeCardId === pl.id && loading && (
          <span style={{ color: "var(--accent)", marginLeft: "6px" }}>shuffling...</span>
        )}
      </div>
    </div>
  );

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: "16px",
  };

  return (
    <div>
      <h2 style={{ color: "#fff", fontWeight: 700, fontSize: "1.5rem", marginTop: 0, marginBottom: "24px" }}>
        your library
      </h2>

      <div
        style={{
          backgroundColor: "#2a1a00",
          border: "1px solid #ff9900",
          borderRadius: "8px",
          padding: "10px 16px",
          marginBottom: "28px",
          fontSize: "0.85rem",
          color: "#ffb347",
        }}
      >
        ⚠️ clear your spotify queue before shuffling
      </div>

      {message && (
        <div
          style={{
            marginBottom: "20px",
            padding: "10px 16px",
            borderRadius: "8px",
            backgroundColor: message.type === "success" ? "#1e0d2e" : "#2e0d0d",
            border: `1px solid ${message.type === "success" ? "var(--accent)" : "#ff4d4d"}`,
            color: message.type === "success" ? "var(--accent)" : "#ff4d4d",
            fontSize: "0.9rem",
          }}
        >
          {message.text}
        </div>
      )}

      {/* pinned section */}
      {pinnedPlaylists.length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>
            pinned
          </div>
          <div style={gridStyle}>
            {pinnedPlaylists.map((pl) => <PlaylistCard key={pl.id} pl={pl} />)}
          </div>
        </div>
      )}

      {/* main grid with special cards + rest */}
      <div style={pinnedPlaylists.length > 0 ? { marginBottom: "8px" } : {}}>
        {pinnedPlaylists.length > 0 && (
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>
            all
          </div>
        )}
        <div style={gridStyle}>
          {/* liked songs */}
          <div
            style={{ ...cardBase, opacity: loading && activeCardId !== "liked" ? 0.5 : 1 }}
            onClick={() => handleShuffle("1", undefined, "liked")}
            onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLDivElement).style.backgroundColor = "var(--hover)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "var(--card-bg)"; }}
          >
            <div
              style={{
                width: "100%", paddingBottom: "100%", borderRadius: "4px",
                background: "linear-gradient(135deg, #fc88f1, #ffb3f6)",
                marginBottom: "12px", position: "relative", overflow: "hidden",
              }}
            >
              <span style={{ position: "absolute", bottom: "10px", left: "10px", fontSize: "2rem" }}>🤍</span>
            </div>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#fff", marginBottom: "4px" }}>liked songs</div>
            {activeCardId === "liked" && loading && <div style={{ fontSize: "0.75rem", color: "var(--accent)" }}>shuffling...</div>}
          </div>

          {/* randomizer */}
          <div
            style={{ ...cardBase, opacity: loading && activeCardId !== "surprise" ? 0.5 : 1 }}
            onClick={() => handleShuffle("3", undefined, "surprise")}
            onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLDivElement).style.backgroundColor = "var(--hover)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "var(--card-bg)"; }}
          >
            <div
              style={{
                width: "100%", paddingBottom: "100%", borderRadius: "4px",
                background: "linear-gradient(135deg, #af69ff, #191414)",
                marginBottom: "12px", position: "relative", overflow: "hidden",
              }}
            >
              <span style={{ position: "absolute", bottom: "10px", left: "10px", fontSize: "2rem" }}>🎲</span>
            </div>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#fff", marginBottom: "4px" }}>randomizer</div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>random playlist</div>
            {activeCardId === "surprise" && loading && <div style={{ fontSize: "0.75rem", color: "var(--accent)" }}>shuffling...</div>}
          </div>

          {/* all playlist cards */}
          {unpinnedPlaylists.map((pl) => <PlaylistCard key={pl.id} pl={pl} />)}
        </div>
      </div>
    </div>
  );
}

export default Shuffler;
