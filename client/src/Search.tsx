// search.tsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import MiniPlayer from "./MiniPlayer.tsx";

const PAGE_SIZE = 50;

interface Artist {
  id: string;
  name: string;
}

interface Track {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  album_image?: string | null;
  preview_url?: string | null;
}

interface Playlist {
  id: string;
  name: string;
  num_tracks: number;
}

interface SearchProps {
  userId: string;
  token: string | null;
}

const inputStyle: React.CSSProperties = {
  backgroundColor: "#3e3e3e",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  color: "#fff",
  fontSize: "0.9rem",
  padding: "8px 12px",
  outline: "none",
};

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

function Search({ userId, token }: SearchProps) {
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [songName, setSongName] = useState("");

  const [artistInputs, setArtistInputs] = useState<string[]>([""]);
  const [artistResults, setArtistResults] = useState<Artist[]>([]);
  const artistJustSelected = useRef(false);

  const [startYear, setStartYear] = useState("");
  const [endYear, setEndYear] = useState("");

  const [genreInputs, setGenreInputs] = useState<string[]>([""]);
  const [genreResults, setGenreResults] = useState<string[]>([]);
  const [allGenres, setAllGenres] = useState<string[]>([]);
  const genreJustSelected = useRef(false);

  const [likedOnly, setLikedOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [miniPlayer, setMiniPlayer] = useState<{ query: string; label: string } | null>(null);

  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showExisting, setShowExisting] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  const totalPages = Math.ceil(searchResults.length / PAGE_SIZE);
  const currentPageTracks = searchResults.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const allOnPageSelected = currentPageTracks.length > 0 && currentPageTracks.every((t) => selectedTracks.has(t.id));

  const openMiniPlayer = (trackName: string, artistNames: string[]) => {
    setMiniPlayer({ query: `${trackName} ${artistNames.join(" ")} audio`, label: `${trackName} — ${artistNames.join(", ")}` });
  };

  const toggleFilter = (filter: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filter)) {
        next.delete(filter);
        if (filter === "song name") { setSongName(""); }
        if (filter === "artist") { setArtistInputs([""]); setArtistResults([]); }
        if (filter === "time period") { setStartYear(""); setEndYear(""); }
        if (filter === "genre") { setGenreInputs([""]); setGenreResults([]); }
      } else {
        next.add(filter);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!userId) return;
    axios.get(`http://localhost:8888/api/get_genres?user_id=${userId}`)
      .then((r) => setAllGenres(r.data.all_genres || []))
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (!showExisting || !token || !userId) return;
    axios.get<Playlist[]>(`http://localhost:8888/api/get_playlists`, { params: { user_id: userId } })
      .then((r) => setPlaylists(r.data))
      .catch(() => setPlaylists([]));
  }, [showExisting, token, userId]);

  useEffect(() => {
    if (artistJustSelected.current) { artistJustSelected.current = false; return; }
    const last = artistInputs[artistInputs.length - 1];
    if (last.length < 2) { setArtistResults([]); return; }
    axios.get<Artist[]>(`http://localhost:8888/api/search_artists?query=${encodeURIComponent(last)}`)
      .then((r) => setArtistResults(r.data))
      .catch(() => setArtistResults([]));
  }, [artistInputs]);

  useEffect(() => {
    if (genreJustSelected.current) { genreJustSelected.current = false; return; }
    const last = genreInputs[genreInputs.length - 1];
    if (last.length < 2) { setGenreResults([]); return; }
    setGenreResults(allGenres.filter((g) => g.toLowerCase().includes(last.toLowerCase())).slice(0, 10));
  }, [genreInputs, allGenres]);

  const doArtistSelect = (artist: Artist, index: number) => {
    artistJustSelected.current = true;
    const updated = [...artistInputs];
    updated[index] = artist.name;
    setArtistInputs(updated);
    setArtistResults([]);
  };

  const removeArtistInput = (index: number) => {
    const updated = [...artistInputs];
    updated.splice(index, 1);
    if (updated.length === 0) updated.push("");
    setArtistInputs(updated);
    setArtistResults([]);
  };

  const doGenreSelect = (genre: string, index: number) => {
    genreJustSelected.current = true;
    const updated = [...genreInputs];
    updated[index] = genre;
    setGenreInputs(updated);
    setGenreResults([]);
  };

  const removeGenreInput = (index: number) => {
    const updated = [...genreInputs];
    updated.splice(index, 1);
    if (updated.length === 0) updated.push("");
    setGenreInputs(updated);
    setGenreResults([]);
  };

  const doSearch = async () => {
    const filledArtists = artistInputs.filter((a) => a.trim() !== "");
    const filledGenres = genreInputs.filter((g) => g.trim() !== "");
    const hasSongName = songName.trim() !== "";
    const hasArtist = filledArtists.length > 0;
    const hasTime = startYear !== "" && endYear !== "";
    const hasGenre = filledGenres.length > 0;

    if (!hasSongName && !hasArtist && !hasTime && !hasGenre && !likedOnly) {
      setMessage({ text: "please enable at least one filter", type: "error" });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = { user_id: userId, liked_only: likedOnly };
      if (hasSongName) payload.song_name = songName.trim();
      if (hasArtist) payload.artists = filledArtists;
      if (hasTime) { payload.start_year = startYear; payload.end_year = endYear; }
      if (hasGenre) payload.genres = filledGenres;
      const res = await axios.post<Track[]>("http://localhost:8888/api/search_category", payload);
      setSearchResults(res.data);
      setSelectedTracks(new Set());
      setCurrentPage(0);
    } catch {
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleTrack = (id: string) => {
    setSelectedTracks((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const toggleSelectAllOnPage = () => {
    setSelectedTracks((prev) => {
      const s = new Set(prev);
      if (allOnPageSelected) { currentPageTracks.forEach((t) => s.delete(t.id)); }
      else { currentPageTracks.forEach((t) => s.add(t.id)); }
      return s;
    });
  };

  const doAddToQueue = async () => {
    try {
      await axios.post("http://localhost:8888/api/queue", { track_ids: Array.from(selectedTracks), token });
      setMessage({ text: "added to queue", type: "success" });
    } catch {
      setMessage({ text: "error adding to queue", type: "error" });
    }
  };

  const doCreateNewPlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    try {
      await axios.post("http://localhost:8888/api/playlist/new", {
        name: newPlaylistName.trim(), track_ids: Array.from(selectedTracks), token, user_id: userId,
      });
      setMessage({ text: "playlist created", type: "success" });
      setNewPlaylistName(""); setShowNew(false);
    } catch {
      setMessage({ text: "error creating playlist", type: "error" });
    }
  };

  const doAddToExistingPlaylist = async () => {
    if (!selectedPlaylistId) return;
    try {
      await axios.post("http://localhost:8888/api/playlist/add_tracks", {
        playlist_id: selectedPlaylistId, track_ids: Array.from(selectedTracks), token,
      });
      setMessage({ text: "tracks added to playlist", type: "success" });
      setSelectedPlaylistId(""); setShowExisting(false);
    } catch {
      setMessage({ text: "error adding to playlist", type: "error" });
    }
  };

  const doRemoveFromLiked = async () => {
    try {
      await axios.post("http://localhost:8888/api/remove_liked", {
        track_ids: Array.from(selectedTracks), token, user_id: userId,
      });
      setMessage({ text: "removed from liked songs", type: "success" });
    } catch {
      setMessage({ text: "error removing from liked", type: "error" });
    }
  };

  const pillBtn = (active: boolean): React.CSSProperties => ({
    padding: "6px 16px",
    borderRadius: "500px",
    border: `1px solid ${active ? "#fff" : "var(--border)"}`,
    backgroundColor: active ? "#fff" : "transparent",
    color: active ? "#000" : "var(--muted)",
    fontSize: "0.85rem",
    fontWeight: active ? 600 : 400,
    cursor: "pointer",
    transition: "all 0.15s",
  });

  const filterRowStyle: React.CSSProperties = {
    backgroundColor: "var(--card-bg)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "16px",
    marginTop: "12px",
  };

  const smallBtn = (variant: "ghost" | "icon"): React.CSSProperties => ({
    background: "none",
    border: variant === "ghost" ? "1px solid var(--border)" : "none",
    borderRadius: "4px",
    color: "var(--muted)",
    padding: "4px 8px",
    fontSize: "0.75rem",
    cursor: "pointer",
    flexShrink: 0,
  });

  return (
    <div>
      <h2 style={{ color: "#fff", fontWeight: 700, fontSize: "1.5rem", margin: "0 0 24px" }}>search</h2>

      {/* filter area */}
      <div
        style={{
          backgroundColor: "var(--card-bg)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "20px",
        }}
      >
        {/* filter pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px", alignItems: "center" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)", marginRight: "4px" }}>filters:</span>
          {(["song name", "artist", "time period", "genre"] as const).map((f) => (
            <button key={f} onClick={() => toggleFilter(f)} style={pillBtn(activeFilters.has(f))}>
              {f}
            </button>
          ))}
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", color: likedOnly ? "var(--accent)" : "var(--muted)", cursor: "pointer", marginLeft: "8px" }}>
            <input type="checkbox" checked={likedOnly} onChange={(e) => setLikedOnly(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
            liked only
          </label>
        </div>

        {/* song name filter */}
        {activeFilters.has("song name") && (
          <div style={filterRowStyle}>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "10px" }}>song name</div>
            <input
              type="text"
              placeholder="e.g. heartless"
              value={songName}
              onChange={(e) => setSongName(e.target.value)}
              style={{ ...inputStyle, width: "100%" }}
            />
          </div>
        )}

        {/* artist filter */}
        {activeFilters.has("artist") && (
          <div style={filterRowStyle}>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "10px" }}>artists</div>
            {artistInputs.map((value, i) => (
              <div key={i} style={{ position: "relative", marginBottom: "8px" }}>
                <div style={{ display: "flex", gap: "6px" }}>
                  <input
                    type="text" placeholder="artist name" value={value} autoComplete="off"
                    onChange={(e) => { const u = [...artistInputs]; u[i] = e.target.value; setArtistInputs(u); }}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  {i === artistInputs.length - 1 && (
                    <button onClick={() => setArtistInputs([...artistInputs, ""])} style={smallBtn("ghost")}>+</button>
                  )}
                  <button onClick={() => removeArtistInput(i)} style={smallBtn("ghost")}>−</button>
                </div>
                {i === artistInputs.length - 1 && artistResults.length > 0 && (
                  <ul style={dropdownStyle}>
                    {artistResults.map((a) => (
                      <li key={a.id} onClick={() => doArtistSelect(a, i)}
                        style={{ padding: "6px 8px", cursor: "pointer", borderRadius: "4px", color: "#fff" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLLIElement).style.backgroundColor = "#383838"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLLIElement).style.backgroundColor = "transparent"; }}>
                        {a.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {/* time period filter */}
        {activeFilters.has("time period") && (
          <div style={filterRowStyle}>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "10px" }}>time period</div>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <input type="number" placeholder="start year (e.g. 2000)" value={startYear}
                onChange={(e) => setStartYear(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>—</span>
              <input type="number" placeholder="end year (e.g. 2012)" value={endYear}
                onChange={(e) => setEndYear(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            </div>
          </div>
        )}

        {/* genre filter */}
        {activeFilters.has("genre") && (
          <div style={filterRowStyle}>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "10px" }}>genres</div>
            {genreInputs.map((value, i) => (
              <div key={i} style={{ position: "relative", marginBottom: "8px" }}>
                <div style={{ display: "flex", gap: "6px" }}>
                  <input
                    type="text" placeholder="genre name" value={value} autoComplete="off"
                    onChange={(e) => { const u = [...genreInputs]; u[i] = e.target.value; setGenreInputs(u); }}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  {i === genreInputs.length - 1 && (
                    <button onClick={() => setGenreInputs([...genreInputs, ""])} style={smallBtn("ghost")}>+</button>
                  )}
                  <button onClick={() => removeGenreInput(i)} style={smallBtn("ghost")}>−</button>
                </div>
                {i === genreInputs.length - 1 && genreResults.length > 0 && (
                  <ul style={dropdownStyle}>
                    {genreResults.map((g, idx) => (
                      <li key={idx} onClick={() => doGenreSelect(g, i)}
                        style={{ padding: "6px 8px", cursor: "pointer", borderRadius: "4px", color: "#fff" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLLIElement).style.backgroundColor = "#383838"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLLIElement).style.backgroundColor = "transparent"; }}>
                        {g}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {/* search button */}
        <button
          onClick={doSearch}
          disabled={loading}
          style={{
            marginTop: "16px",
            backgroundColor: "var(--accent)",
            color: "#000",
            border: "none",
            borderRadius: "500px",
            padding: "10px 28px",
            fontSize: "0.9rem",
            fontWeight: 700,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "searching..." : "search"}
        </button>
      </div>

      {/* message */}
      {message && (
        <div style={{
          marginTop: "16px", padding: "10px 16px", borderRadius: "8px", fontSize: "0.85rem",
          backgroundColor: message.type === "success" ? "#0d2e1a" : "#2e0d0d",
          border: `1px solid ${message.type === "success" ? "var(--accent)" : "#ff4d4d"}`,
          color: message.type === "success" ? "var(--accent)" : "#ff4d4d",
        }}>
          {message.text}
        </div>
      )}

      {/* results */}
      {searchResults.length > 0 && (
        <div style={{ marginTop: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.9rem", color: "var(--muted)" }}>
              {searchResults.length} results
            </span>
            <button onClick={toggleSelectAllOnPage} style={pillBtn(allOnPageSelected)}>
              {allOnPageSelected ? "deselect page" : "select page"}
            </button>
            {totalPages > 1 && (
              <>
                <button onClick={() => setCurrentPage((p) => p - 1)} disabled={currentPage === 0} style={pillBtn(false)}>← prev</button>
                <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{currentPage + 1} / {totalPages}</span>
                <button onClick={() => setCurrentPage((p) => p + 1)} disabled={currentPage >= totalPages - 1} style={pillBtn(false)}>next →</button>
              </>
            )}
            {selectedTracks.size > 0 && (
              <span style={{ fontSize: "0.85rem", color: "var(--accent)", fontWeight: 600 }}>
                {selectedTracks.size} selected
              </span>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {currentPageTracks.map((track) => (
              <div
                key={track.id}
                style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "8px 10px", borderRadius: "6px",
                  backgroundColor: selectedTracks.has(track.id) ? "rgba(29,185,84,0.1)" : "transparent",
                  transition: "background-color 0.1s",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => { if (!selectedTracks.has(track.id)) (e.currentTarget as HTMLDivElement).style.backgroundColor = "var(--hover)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = selectedTracks.has(track.id) ? "rgba(29,185,84,0.1)" : "transparent"; }}
                onClick={() => toggleTrack(track.id)}
              >
                <input
                  type="checkbox"
                  checked={selectedTracks.has(track.id)}
                  onChange={() => toggleTrack(track.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ accentColor: "var(--accent)", flexShrink: 0 }}
                />
                {/* album art */}
                <div style={{ width: 40, height: 40, borderRadius: "4px", backgroundColor: "#333", flexShrink: 0, overflow: "hidden" }}>
                  {track.album_image ? (
                    <img src={track.album_image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: "1rem" }}>🎵</div>
                  )}
                </div>
                {/* track info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.9rem", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {track.name}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {track.artists.map((a) => a.name).join(", ")}
                  </div>
                </div>
                {/* preview + yt */}
                <button
                  onClick={(e) => { e.stopPropagation(); openMiniPlayer(track.name, track.artists.map((a) => a.name)); }}
                  style={smallBtn("icon")}
                  title="mini player"
                >▶</button>
                <a
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(track.name + " " + track.artists.map((a) => a.name).join(" ") + " audio")}`}
                  target="_blank" rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ ...smallBtn("ghost"), display: "inline-block", color: "var(--muted)", textDecoration: "none" }}
                  title="open on youtube"
                >yt</a>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "16px" }}>
              <button onClick={() => setCurrentPage((p) => p - 1)} disabled={currentPage === 0} style={pillBtn(false)}>← prev</button>
              <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{currentPage + 1} / {totalPages}</span>
              <button onClick={() => setCurrentPage((p) => p + 1)} disabled={currentPage >= totalPages - 1} style={pillBtn(false)}>next →</button>
            </div>
          )}
        </div>
      )}

      {/* action bar (shown when tracks selected) */}
      {selectedTracks.size > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#282828",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "12px 20px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            zIndex: 200,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{selectedTracks.size} selected</span>

          <button onClick={doAddToQueue}
            style={{ backgroundColor: "var(--accent)", color: "#000", border: "none", borderRadius: "500px", padding: "7px 16px", fontSize: "0.8rem", fontWeight: 700 }}>
            add to queue
          </button>

          <button onClick={() => { setShowNew(!showNew); setShowExisting(false); }}
            style={pillBtn(showNew)}>
            new playlist
          </button>
          <button onClick={() => { setShowExisting(!showExisting); setShowNew(false); }}
            style={pillBtn(showExisting)}>
            add to playlist
          </button>
          <button onClick={doRemoveFromLiked}
            style={{ background: "none", border: "1px solid #ff4d4d", borderRadius: "500px", color: "#ff4d4d", padding: "6px 14px", fontSize: "0.8rem", cursor: "pointer" }}>
            remove from liked
          </button>
        </div>
      )}

      {/* new playlist inline form */}
      {showNew && selectedTracks.size > 0 && (
        <div style={{ position: "fixed", bottom: "86px", left: "50%", transform: "translateX(-50%)", backgroundColor: "#282828", border: "1px solid var(--border)", borderRadius: "10px", padding: "14px 20px", display: "flex", gap: "10px", alignItems: "center", zIndex: 200 }}>
          <input
            type="text" placeholder="playlist name" value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            style={{ ...inputStyle, width: "220px" }}
          />
          <button onClick={doCreateNewPlaylist}
            style={{ backgroundColor: "var(--accent)", color: "#000", border: "none", borderRadius: "500px", padding: "7px 16px", fontSize: "0.8rem", fontWeight: 700 }}>
            create
          </button>
        </div>
      )}

      {/* add to existing playlist inline form */}
      {showExisting && selectedTracks.size > 0 && (
        <div style={{ position: "fixed", bottom: "86px", left: "50%", transform: "translateX(-50%)", backgroundColor: "#282828", border: "1px solid var(--border)", borderRadius: "10px", padding: "14px 20px", display: "flex", gap: "10px", alignItems: "center", zIndex: 200 }}>
          <select value={selectedPlaylistId} onChange={(e) => setSelectedPlaylistId(e.target.value)}
            style={{ ...inputStyle, width: "220px" }}>
            <option value="">select a playlist</option>
            {playlists.map((pl) => (
              <option key={pl.id} value={pl.id}>{pl.name} ({pl.num_tracks})</option>
            ))}
          </select>
          <button onClick={doAddToExistingPlaylist} disabled={!selectedPlaylistId}
            style={{ backgroundColor: "var(--accent)", color: "#000", border: "none", borderRadius: "500px", padding: "7px 16px", fontSize: "0.8rem", fontWeight: 700, opacity: selectedPlaylistId ? 1 : 0.5 }}>
            add
          </button>
        </div>
      )}

      {miniPlayer && (
        <MiniPlayer query={miniPlayer.query} trackLabel={miniPlayer.label} onClose={() => setMiniPlayer(null)} />
      )}
    </div>
  );
}

export default Search;
