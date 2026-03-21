import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import MiniPlayer from "./MiniPlayer.tsx";

interface Artist {
  id: string;
  name: string;
}

interface Track {
  id: string;
  name: string;
  artists: Artist[];
  album?: string;
  album_image?: string | null;
  preview_url?: string | null;
}

interface Bundle {
  id: number;
  intro_song_id: string;
  main_song_id: string;
  strict: boolean;
}

interface BundleWithTracks extends Bundle {
  intro_song?: Track;
  main_song?: Track;
}

interface BundleProps {
  userId: string;
  token: string | null;
}

// ── module-level components so they aren't recreated on every render ──

const dropdownStyle: React.CSSProperties = {
  listStyleType: "none",
  margin: "4px 0 0",
  padding: "4px",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  maxHeight: "160px",
  overflowY: "auto",
  backgroundColor: "#282828",
  position: "absolute",
  zIndex: 100,
  width: "100%",
  fontSize: "0.85rem",
};

function AlbumThumb({ track, size = 48 }: { track?: Track; size?: number }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "4px",
        backgroundColor: "#333", flexShrink: 0, overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {track?.album_image ? (
        <img src={track.album_image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span style={{ fontSize: size * 0.4, color: "var(--muted)" }}>🎵</span>
      )}
    </div>
  );
}

interface SearchInputProps {
  query: string;
  setQuery: (v: string) => void;
  artistQuery: string;
  setArtistQuery: (v: string) => void;
  results: Track[];
  onSelect: (song: Track) => void;
  onPreview: (trackName: string, artists: Artist[]) => void;
  label: string;
}

function SearchInput({ query, setQuery, artistQuery, setArtistQuery, results, onSelect, onPreview, label }: SearchInputProps) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "6px" }}>{label}</label>
      <div style={{ display: "flex", gap: "8px", marginBottom: "4px" }}>
        <input
          type="text"
          placeholder="song name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            flex: 1, padding: "10px 12px",
            backgroundColor: "#3e3e3e", border: "1px solid var(--border)",
            borderRadius: "6px", color: "#fff", fontSize: "0.9rem", outline: "none",
          }}
        />
        <input
          type="text"
          placeholder="artist (optional)"
          value={artistQuery}
          onChange={(e) => setArtistQuery(e.target.value)}
          style={{
            flex: 1, padding: "10px 12px",
            backgroundColor: "#3e3e3e", border: "1px solid var(--border)",
            borderRadius: "6px", color: "#fff", fontSize: "0.9rem", outline: "none",
          }}
        />
      </div>
      <div style={{ position: "relative" }}>
        {results.length > 0 && (
          <ul style={dropdownStyle}>
            {results.map((song) => (
              <li
                key={song.id}
                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px", borderRadius: "4px", cursor: "pointer" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLLIElement).style.backgroundColor = "#383838"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLLIElement).style.backgroundColor = "transparent"; }}
              >
                <AlbumThumb track={song} size={32} />
                <span
                  style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#fff" }}
                  onClick={() => onSelect(song)}
                >
                  {song.name} — {song.artists.map((a) => a.name).join(", ")}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onPreview(song.name, song.artists); }}
                  style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "0.8rem", padding: "2px 4px", cursor: "pointer", flexShrink: 0 }}
                  title="preview"
                >▶</button>
                <a
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(song.name + " " + song.artists.map((a) => a.name).join(" ") + " audio")}`}
                  target="_blank" rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ fontSize: "0.7rem", color: "var(--muted)", border: "1px solid #555", borderRadius: "3px", padding: "2px 5px", flexShrink: 0 }}
                >yt</a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function Bundles({ userId, token }: BundleProps) {
  const [bundles, setBundles] = useState<BundleWithTracks[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [message, setMessage] = useState("");

  const [introQuery, setIntroQuery] = useState("");
  const [introArtistQuery, setIntroArtistQuery] = useState("");
  const [mainQuery, setMainQuery] = useState("");
  const [mainArtistQuery, setMainArtistQuery] = useState("");
  const [introResults, setIntroResults] = useState<Track[]>([]);
  const [mainResults, setMainResults] = useState<Track[]>([]);
  const introJustSelected = useRef(false);
  const mainJustSelected = useRef(false);
  const [introId, setIntroId] = useState("");
  const [mainId, setMainId] = useState("");
  const [strict, setStrict] = useState(false);

  const [miniPlayer, setMiniPlayer] = useState<{ query: string; label: string } | null>(null);

  const openMiniPlayer = (trackName: string, artists: Artist[]) => {
    const artistNames = artists.map((a) => a.name);
    setMiniPlayer({
      query: `${trackName} ${artistNames.join(" ")} audio`,
      label: `${trackName} — ${artistNames.join(", ")}`,
    });
  };

  useEffect(() => {
    const fetchBundles = async () => {
      try {
        const res = await axios.get<Bundle[]>(`http://localhost:8888/api/get_bundles?user_id=${userId}`);
        const bundlesData = res.data;
        const tracksToFetch = new Set<string>();
        bundlesData.forEach((b) => { tracksToFetch.add(b.intro_song_id); tracksToFetch.add(b.main_song_id); });
        const trackDetails = await Promise.all(
          Array.from(tracksToFetch).map((id) =>
            axios.get<Track>(`http://localhost:8888/api/get_track?id=${id}`).then((r) => r.data)
          )
        );
        const trackMap = new Map(trackDetails.map((t) => [t.id, t]));
        setBundles(bundlesData.map((b) => ({ ...b, intro_song: trackMap.get(b.intro_song_id), main_song: trackMap.get(b.main_song_id) })));
      } catch {
        setMessage("failed to load bundles");
      }
    };
    fetchBundles();
  }, [userId]);

  useEffect(() => {
    if (introJustSelected.current) { introJustSelected.current = false; return; }
    if (introQuery.length < 2 && introArtistQuery.length < 2) { setIntroResults([]); return; }
    const params = new URLSearchParams();
    if (introQuery) params.set("query", introQuery);
    if (introArtistQuery) params.set("artist", introArtistQuery);
    axios.get<Track[]>(`http://localhost:8888/api/search_songs?${params}`)
      .then((r) => setIntroResults(r.data))
      .catch(() => setIntroResults([]));
  }, [introQuery, introArtistQuery]);

  useEffect(() => {
    if (mainJustSelected.current) { mainJustSelected.current = false; return; }
    if (mainQuery.length < 2 && mainArtistQuery.length < 2) { setMainResults([]); return; }
    const params = new URLSearchParams();
    if (mainQuery) params.set("query", mainQuery);
    if (mainArtistQuery) params.set("artist", mainArtistQuery);
    axios.get<Track[]>(`http://localhost:8888/api/search_songs?${params}`)
      .then((r) => setMainResults(r.data))
      .catch(() => setMainResults([]));
  }, [mainQuery, mainArtistQuery]);

  const doCreateBundle = async () => {
    try {
      const res = await axios.post<Bundle>(`http://localhost:8888/api/create_bundle`, {
        user_id: userId, intro_song_id: introId, main_song_id: mainId, strict,
      });
      const [introSong, mainSong] = await Promise.all([
        axios.get<Track>(`http://localhost:8888/api/get_track?id=${res.data.intro_song_id}`).then((r) => r.data),
        axios.get<Track>(`http://localhost:8888/api/get_track?id=${res.data.main_song_id}`).then((r) => r.data),
      ]);
      setBundles([...bundles, { ...res.data, intro_song: introSong, main_song: mainSong }]);
      setShowCreateForm(false);
      setIntroId(""); setMainId("");
      setIntroQuery(""); setIntroArtistQuery("");
      setMainQuery(""); setMainArtistQuery("");
      setStrict(false);
    } catch {
      setMessage("error creating bundle");
    }
  };

  const toggleStrict = async (bundleId: number, newStrict: boolean) => {
    try {
      await axios.patch(`http://localhost:8888/api/bundles/${bundleId}`, { strict: newStrict });
      setBundles((prev) => prev.map((b) => (b.id === bundleId ? { ...b, strict: newStrict } : b)));
    } catch {
      setMessage("failed to update strict setting");
    }
  };

  const deleteBundle = async (bundleId: number) => {
    try {
      await axios.delete(`http://localhost:8888/api/bundles/${bundleId}`);
      setBundles((prev) => prev.filter((b) => b.id !== bundleId));
    } catch {
      setMessage("failed to delete bundle");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <h2 style={{ color: "#fff", fontWeight: 700, fontSize: "1.5rem", margin: 0 }}>bundles</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{
            backgroundColor: showCreateForm ? "transparent" : "var(--accent)",
            border: showCreateForm ? "1px solid var(--border)" : "none",
            borderRadius: "500px",
            color: showCreateForm ? "var(--muted)" : "#000",
            padding: "8px 20px",
            fontSize: "0.85rem",
            fontWeight: 700,
          }}
        >
          {showCreateForm ? "cancel" : "+ new bundle"}
        </button>
      </div>

      {/* create form */}
      {showCreateForm && (
        <div
          style={{
            backgroundColor: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "20px",
            marginBottom: "24px",
          }}
        >
          <h3 style={{ margin: "0 0 16px", fontSize: "1rem", color: "#fff" }}>create bundle</h3>
          <SearchInput
            query={introQuery}
            setQuery={(v) => { setIntroQuery(v); setIntroId(""); }}
            artistQuery={introArtistQuery}
            setArtistQuery={(v) => { setIntroArtistQuery(v); setIntroId(""); }}
            results={introResults}
            onSelect={(song) => {
              introJustSelected.current = true;
              setIntroId(song.id);
              setIntroQuery(song.name);
              setIntroArtistQuery(song.artists.map((a) => a.name).join(", "));
              setIntroResults([]);
            }}
            onPreview={openMiniPlayer}
            label="first song (intro)"
          />
          <SearchInput
            query={mainQuery}
            setQuery={(v) => { setMainQuery(v); setMainId(""); }}
            artistQuery={mainArtistQuery}
            setArtistQuery={(v) => { setMainArtistQuery(v); setMainId(""); }}
            results={mainResults}
            onSelect={(song) => {
              mainJustSelected.current = true;
              setMainId(song.id);
              setMainQuery(song.name);
              setMainArtistQuery(song.artists.map((a) => a.name).join(", "));
              setMainResults([]);
            }}
            onPreview={openMiniPlayer}
            label="second song (main)"
          />
          <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.85rem", color: "var(--muted)", marginBottom: "16px", cursor: "pointer" }}>
            <input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} />
            strict — plays bundle regardless of which song comes up
          </label>
          <button
            onClick={doCreateBundle}
            disabled={!introId || !mainId}
            style={{
              backgroundColor: introId && mainId ? "var(--accent)" : "#333",
              color: introId && mainId ? "#000" : "var(--muted)",
              border: "none",
              borderRadius: "500px",
              padding: "10px 24px",
              fontSize: "0.85rem",
              fontWeight: 700,
            }}
          >
            save bundle
          </button>
        </div>
      )}

      {/* bundle list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {bundles.length === 0 && (
          <div style={{ color: "var(--muted)", fontSize: "0.9rem", textAlign: "center", paddingTop: "40px" }}>
            no bundles yet — create one to link two songs together
          </div>
        )}
        {bundles.map((b) => {
          const introArtists = b.intro_song?.artists?.map((a) => a.name).join(", ") ?? "unknown";
          const mainArtists = b.main_song?.artists?.map((a) => a.name).join(", ") ?? "unknown";
          return (
            <div
              key={b.id}
              style={{
                backgroundColor: "var(--card-bg)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                gap: "14px",
              }}
            >
              {/* overlapping album art */}
              <div style={{ position: "relative", width: "64px", height: "48px", flexShrink: 0 }}>
                <div style={{ position: "absolute", left: 0, top: 0 }}>
                  <AlbumThumb track={b.intro_song} size={44} />
                </div>
                <div style={{ position: "absolute", left: "20px", top: "4px", border: "2px solid var(--card-bg)", borderRadius: "4px" }}>
                  <AlbumThumb track={b.main_song} size={40} />
                </div>
              </div>

              {/* song info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {b.intro_song?.name ?? b.intro_song_id}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", flexShrink: 0 }}>— {introArtists}</span>
                  <button
                    onClick={() => b.intro_song && openMiniPlayer(b.intro_song.name, b.intro_song.artists)}
                    style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "0.75rem", cursor: "pointer", padding: "0 4px", flexShrink: 0 }}
                  >▶</button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {b.main_song?.name ?? b.main_song_id}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#666", flexShrink: 0 }}>— {mainArtists}</span>
                  <button
                    onClick={() => b.main_song && openMiniPlayer(b.main_song.name, b.main_song.artists)}
                    style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "0.75rem", cursor: "pointer", padding: "0 4px", flexShrink: 0 }}
                  >▶</button>
                </div>
              </div>

              {/* strict toggle */}
              <label
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  fontSize: "0.75rem", color: b.strict ? "var(--accent)" : "var(--muted)",
                  cursor: "pointer", flexShrink: 0,
                  padding: "4px 10px", borderRadius: "500px",
                  border: `1px solid ${b.strict ? "var(--accent)" : "var(--border)"}`,
                  transition: "all 0.15s",
                }}
              >
                <input
                  type="checkbox"
                  checked={b.strict}
                  onChange={(e) => toggleStrict(b.id, e.target.checked)}
                  style={{ display: "none" }}
                />
                {b.strict ? "strict ✓" : "strict"}
              </label>

              {/* delete */}
              <button
                onClick={() => deleteBundle(b.id)}
                style={{
                  background: "none", border: "1px solid var(--border)",
                  borderRadius: "6px", color: "var(--muted)",
                  padding: "6px 10px", fontSize: "0.75rem", cursor: "pointer", flexShrink: 0,
                  transition: "color 0.15s, border-color 0.15s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ff4d4d"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#ff4d4d"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; }}
              >
                delete
              </button>
            </div>
          );
        })}
      </div>

      {message && (
        <div style={{ marginTop: "16px", fontSize: "0.85rem", color: "#ff4d4d" }}>{message}</div>
      )}

      {miniPlayer && (
        <MiniPlayer query={miniPlayer.query} trackLabel={miniPlayer.label} onClose={() => setMiniPlayer(null)} />
      )}
    </div>
  );
}

export default Bundles;
