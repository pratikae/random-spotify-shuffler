// search.tsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import MiniPlayer from "./MiniPlayer.tsx";

const PAGE_SIZE = 50;

const dropdownStyle: React.CSSProperties = {
  listStyleType: "none",
  margin: 0,
  padding: "0.5rem",
  border: "1px solid #ccc",
  maxHeight: "150px",
  overflowY: "auto",
  textAlign: "left",
  width: "300px",
  marginLeft: "auto",
  marginRight: "auto",
  backgroundColor: "white",
  position: "relative",
  zIndex: 10,
  fontSize: "0.9rem",
};

interface Artist {
  id: string;
  name: string;
}

interface Track {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
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

function Search({ userId, token }: SearchProps) {
  // active filter toggles
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

  // artist filter
  const [artistInputs, setArtistInputs] = useState<string[]>([""]);
  const [artistResults, setArtistResults] = useState<Artist[]>([]);
  const artistJustSelected = useRef(false);

  // time period filter
  const [startYear, setStartYear] = useState("");
  const [endYear, setEndYear] = useState("");

  // genre filter
  const [genreInputs, setGenreInputs] = useState<string[]>([""]);
  const [genreResults, setGenreResults] = useState<string[]>([]);
  const [allGenres, setAllGenres] = useState<string[]>([]);
  const genreJustSelected = useRef(false);

  const toggleFilter = (filter: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filter)) {
        next.delete(filter);
        // clear state when filter is toggled off
        if (filter === "artist") { setArtistInputs([""]); setArtistResults([]); }
        if (filter === "time period") { setStartYear(""); setEndYear(""); }
        if (filter === "genre") { setGenreInputs([""]); setGenreResults([]); }
      } else {
        next.add(filter);
      }
      return next;
    });
  };

  const [likedOnly, setLikedOnly] = useState(false);

  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const [miniPlayer, setMiniPlayer] = useState<{ query: string; label: string } | null>(null);

  const openMiniPlayer = (trackName: string, artistNames: string[]) => {
    setMiniPlayer({
      query: `${trackName} ${artistNames.join(" ")} audio`,
      label: `${trackName} — ${artistNames.join(", ")}`,
    });
  };

  // playlist states
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showExisting, setShowExisting] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  const navigate = useNavigate();

  const totalPages = Math.ceil(searchResults.length / PAGE_SIZE);
  const currentPageTracks = searchResults.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const allOnPageSelected = currentPageTracks.length > 0 && currentPageTracks.every((t) => selectedTracks.has(t.id));

  // fetch genres on mount
  useEffect(() => {
    if (!userId) return;
    const fetchGenres = async () => {
      try {
        const res = await axios.get(`http://localhost:8888/api/get_genres?user_id=${userId}`);
        setAllGenres(res.data.all_genres || []);
      } catch (err) {
        console.error("error fetching genres", err);
      }
    };
    fetchGenres();
  }, [userId]);

  // fetch playlists when user opens "existing" section
  useEffect(() => {
    if (!showExisting || !token || !userId) return;
    const fetchPlaylists = async () => {
      try {
        const res = await axios.get<Playlist[]>(`http://localhost:8888/api/playlists`, {
          params: { user_id: userId, token },
        });
        setPlaylists(res.data);
      } catch (err) {
        console.error("error fetching playlists", err);
        setPlaylists([]);
      }
    };
    fetchPlaylists();
  }, [showExisting, token, userId]);

  // artist autocomplete
  useEffect(() => {
    if (artistJustSelected.current) {
      artistJustSelected.current = false;
      return;
    }
    const lastInput = artistInputs[artistInputs.length - 1];
    if (lastInput.length < 2) {
      setArtistResults([]);
      return;
    }
    const fetchArtists = async () => {
      try {
        const res = await axios.get<Artist[]>(
          `http://localhost:8888/api/search_artists?query=${encodeURIComponent(lastInput)}`
        );
        setArtistResults(res.data);
      } catch {
        setArtistResults([]);
      }
    };
    fetchArtists();
  }, [artistInputs]);

  // genre autocomplete
  useEffect(() => {
    if (genreJustSelected.current) {
      genreJustSelected.current = false;
      return;
    }
    const lastInput = genreInputs[genreInputs.length - 1];
    if (lastInput.length < 2) {
      setGenreResults([]);
      return;
    }
    const filtered = allGenres
      .filter((g) => g.toLowerCase().includes(lastInput.toLowerCase()))
      .slice(0, 10);
    setGenreResults(filtered);
  }, [genreInputs, allGenres]);

  const doArtistSelect = (artist: Artist, index: number) => {
    artistJustSelected.current = true;
    const updated = [...artistInputs];
    updated[index] = artist.name;
    setArtistInputs(updated);
    setArtistResults([]);
  };

  const removeArtistFilter = (index: number) => {
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

  const removeGenreFilter = (index: number) => {
    const updated = [...genreInputs];
    updated.splice(index, 1);
    if (updated.length === 0) updated.push("");
    setGenreInputs(updated);
    setGenreResults([]);
  };

  const doSearch = async () => {
    const filledArtists = artistInputs.filter((a) => a.trim() !== "");
    const filledGenres = genreInputs.filter((g) => g.trim() !== "");
    const hasArtist = filledArtists.length > 0;
    const hasTime = startYear !== "" && endYear !== "";
    const hasGenre = filledGenres.length > 0;

    if (!hasArtist && !hasTime && !hasGenre) {
      setMessage({ text: "please enter at least one filter", type: "error" });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const payload: any = { user_id: userId, liked_only: likedOnly };
      if (hasArtist) payload.artists = filledArtists;
      if (hasTime) {
        payload.start_year = startYear;
        payload.end_year = endYear;
      }
      if (hasGenre) payload.genres = filledGenres;

      const res = await axios.post<Track[]>(
        "http://localhost:8888/api/search_category",
        payload,
        { headers: { "Content-Type": "application/json" } }
      );
      setSearchResults(res.data);
      setSelectedTracks(new Set());
      setCurrentPage(0);
    } catch (error) {
      console.error("Error searching:", error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleTrack = (id: string) => {
    setSelectedTracks((prev) => {
      const newSet = new Set(prev);
      newSet.has(id) ? newSet.delete(id) : newSet.add(id);
      return newSet;
    });
  };

  const toggleSelectAllOnPage = () => {
    setSelectedTracks((prev) => {
      const newSet = new Set(prev);
      if (allOnPageSelected) {
        currentPageTracks.forEach((t) => newSet.delete(t.id));
      } else {
        currentPageTracks.forEach((t) => newSet.add(t.id));
      }
      return newSet;
    });
  };

  const doAddToQueue = async () => {
    try {
      await axios.post("http://localhost:8888/api/queue", {
        track_ids: Array.from(selectedTracks),
        token: token,
      });
      setMessage({ text: "added to queue", type: "success" });
    } catch (e) {
      console.error("error adding to queue", e);
      setMessage({ text: "error adding to queue", type: "error" });
    }
  };

  const doCreateNewPlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    try {
      await axios.post("http://localhost:8888/api/playlist/new", {
        name: newPlaylistName.trim(),
        track_ids: Array.from(selectedTracks),
        token: token,
        user_id: userId,
      });
      setMessage({ text: "playlist created", type: "success" });
      setNewPlaylistName("");
      setShowNew(false);
    } catch (e) {
      console.error("error creating playlist", e);
      setMessage({ text: "error creating playlist", type: "error" });
    }
  };

  const doAddToExistingPlaylist = async () => {
    if (!selectedPlaylistId) return;
    try {
      await axios.post("http://localhost:8888/api/playlist/add_tracks", {
        playlist_id: selectedPlaylistId,
        track_ids: Array.from(selectedTracks),
        token: token,
      });
      setMessage({ text: "tracks added to playlist", type: "success" });
      setSelectedPlaylistId("");
      setShowExisting(false);
    } catch (e) {
      console.error("error adding to existing playlist", e);
      setMessage({ text: "error adding to playlist", type: "error" });
    }
  };

  const doRemoveFromLiked = async () => {
    try {
      await axios.post("http://localhost:8888/api/remove_liked", {
        track_ids: Array.from(selectedTracks),
        token: token,
        user_id: userId,
      });
      setMessage({ text: "removed from liked songs", type: "success" });
    } catch (e) {
      console.error("error removing from liked", e);
      setMessage({ text: "error removing from liked", type: "error" });
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h2>search by category</h2>
      <p style={{ color: "#666", fontSize: "0.9rem" }}>
        toggle filters — results will match all of them
      </p>

      {/* liked only toggle */}
      <div style={{ marginTop: "16px" }}>
        <label style={{ fontSize: "0.9rem", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={likedOnly}
            onChange={(e) => setLikedOnly(e.target.checked)}
            style={{ marginRight: "6px" }}
          />
          liked songs only
        </label>
      </div>

      {/* filter toggle buttons */}
      <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "16px" }}>
        {["artist", "time period", "genre"].map((f) => (
          <button
            key={f}
            onClick={() => toggleFilter(f)}
            style={{
              padding: "6px 14px",
              borderRadius: "20px",
              border: "1px solid #999",
              backgroundColor: activeFilters.has(f) ? "#333" : "transparent",
              color: activeFilters.has(f) ? "#fff" : "#333",
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* artist filter */}
      {activeFilters.has("artist") && (
        <div style={{ marginTop: "20px" }}>
          <strong>artist</strong>
          {artistInputs.map((value, i) => (
            <div key={i} style={{ marginBottom: "10px" }}>
              <input
                type="text"
                placeholder="enter artist name"
                value={value}
                onChange={(e) => {
                  const updated = [...artistInputs];
                  updated[i] = e.target.value;
                  setArtistInputs(updated);
                }}
                autoComplete="off"
              />
              {i === artistInputs.length - 1 && (
                <button
                  onClick={() => setArtistInputs([...artistInputs, ""])}
                  style={{ marginLeft: "5px" }}
                >
                  +
                </button>
              )}
              <button onClick={() => removeArtistFilter(i)} style={{ marginLeft: "5px" }}>
                -
              </button>
              {i === artistInputs.length - 1 && artistResults.length > 0 && (
                <ul style={dropdownStyle}>
                  {artistResults.map((artist) => (
                    <li
                      key={artist.id}
                      onClick={() => doArtistSelect(artist, i)}
                      style={{ cursor: "pointer", padding: "4px 0", borderBottom: "1px solid #eee" }}
                    >
                      {artist.name}
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
        <div style={{ marginTop: "20px" }}>
          <strong>time period</strong>
          <div style={{ marginTop: "8px" }}>
            <label>
              start year:{" "}
              <input
                type="number"
                placeholder="e.g. 2000"
                value={startYear}
                onChange={(e) => setStartYear(e.target.value)}
                style={{ marginRight: "10px" }}
              />
            </label>
            <label>
              end year:{" "}
              <input
                type="number"
                placeholder="e.g. 2012"
                value={endYear}
                onChange={(e) => setEndYear(e.target.value)}
              />
            </label>
          </div>
        </div>
      )}

      {/* genre filter */}
      {activeFilters.has("genre") && (
        <div style={{ marginTop: "20px" }}>
          <strong>genre</strong>
          {genreInputs.map((value, i) => (
            <div key={i} style={{ marginBottom: "10px" }}>
              <input
                type="text"
                placeholder="enter genre"
                value={value}
                onChange={(e) => {
                  const updated = [...genreInputs];
                  updated[i] = e.target.value;
                  setGenreInputs(updated);
                }}
                autoComplete="off"
              />
              {i === genreInputs.length - 1 && (
                <button
                  onClick={() => setGenreInputs([...genreInputs, ""])}
                  style={{ marginLeft: "5px" }}
                >
                  +
                </button>
              )}
              <button onClick={() => removeGenreFilter(i)} style={{ marginLeft: "5px" }}>
                -
              </button>
              {i === genreInputs.length - 1 && genreResults.length > 0 && (
                <ul style={dropdownStyle}>
                  {genreResults.map((genre, idx) => (
                    <li
                      key={idx}
                      onClick={() => doGenreSelect(genre, i)}
                      style={{ cursor: "pointer", padding: "4px 0", borderBottom: "1px solid #eee" }}
                    >
                      {genre}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: "20px" }}>
        <button onClick={doSearch} disabled={loading}>
          {loading ? "searching..." : "go"}
        </button>
      </div>

      {searchResults.length > 0 && (
        <div
          style={{
            marginTop: "30px",
            textAlign: "left",
            width: "60%",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          <h3>results ({searchResults.length} total)</h3>

          <div style={{ marginBottom: "10px", display: "flex", alignItems: "center", gap: "10px" }}>
            <button onClick={toggleSelectAllOnPage}>
              {allOnPageSelected ? "deselect page" : "select page"}
            </button>
            <span style={{ fontSize: "0.9rem", color: "#555" }}>
              page {currentPage + 1} of {totalPages}
            </span>
            <button onClick={() => setCurrentPage((p) => p - 1)} disabled={currentPage === 0}>
              prev
            </button>
            <button onClick={() => setCurrentPage((p) => p + 1)} disabled={currentPage >= totalPages - 1}>
              next
            </button>
            {selectedTracks.size > 0 && (
              <span style={{ fontSize: "0.9rem", color: "#555" }}>
                {selectedTracks.size} selected
              </span>
            )}
          </div>

          <ul style={{ listStyleType: "none", padding: 0 }}>
            {currentPageTracks.map((track) => (
              <li key={track.id} style={{ marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="checkbox"
                  checked={selectedTracks.has(track.id)}
                  onChange={() => toggleTrack(track.id)}
                />
                <span>{track.name} - {track.artists.map((a) => a.name).join(", ")}</span>
                <button
                  onClick={() => openMiniPlayer(track.name, track.artists.map((a) => a.name))}
                  style={{ fontSize: "0.75rem", padding: "2px 7px", cursor: "pointer" }}
                  title="play in mini player"
                >
                  ▶
                </button>
                <a
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(track.name + " " + track.artists.map(a => a.name).join(" ") + " audio")}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: "0.75rem", padding: "2px 7px", cursor: "pointer", textDecoration: "none", border: "1px solid #ccc", borderRadius: "3px" }}
                  title="open on youtube"
                >
                  yt
                </a>
              </li>
            ))}
          </ul>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "10px" }}>
            <button onClick={() => setCurrentPage((p) => p - 1)} disabled={currentPage === 0}>
              prev
            </button>
            <span style={{ fontSize: "0.9rem", color: "#555" }}>
              page {currentPage + 1} of {totalPages}
            </span>
            <button onClick={() => setCurrentPage((p) => p + 1)} disabled={currentPage >= totalPages - 1}>
              next
            </button>
          </div>
        </div>
      )}

      {searchResults.length > 0 && (
        <div style={{ marginTop: "20px" }}>
          <button onClick={doAddToQueue} disabled={selectedTracks.size === 0}>add to queue</button>{" "}
          <button onClick={() => { setShowNew(!showNew); setShowExisting(false); }}>
            make new playlist
          </button>{" "}
          <button onClick={() => { setShowExisting(!showExisting); setShowNew(false); }}>
            add to existing playlist
          </button>{" "}
          <button onClick={doRemoveFromLiked} disabled={selectedTracks.size === 0}>remove from liked</button>

          {showNew && (
            <div style={{ marginTop: "10px" }}>
              <input
                type="text"
                placeholder="enter new playlist name"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
              />
              <button onClick={doCreateNewPlaylist} style={{ marginLeft: "10px" }}>
                create
              </button>
            </div>
          )}

          {showExisting && (
            <div style={{ marginTop: "10px" }}>
              <select
                value={selectedPlaylistId}
                onChange={(e) => setSelectedPlaylistId(e.target.value)}
              >
                <option value="">select a playlist</option>
                {playlists.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name} ({pl.num_tracks} tracks)
                  </option>
                ))}
              </select>
              <button
                onClick={doAddToExistingPlaylist}
                style={{ marginLeft: "10px" }}
                disabled={!selectedPlaylistId}
              >
                add
              </button>
            </div>
          )}
        </div>
      )}

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

      <br />
      <br />
      <button onClick={() => navigate("/")} disabled={loading}>
        back
      </button>

      {miniPlayer && (
        <MiniPlayer
          query={miniPlayer.query}
          trackLabel={miniPlayer.label}
          onClose={() => setMiniPlayer(null)}
        />
      )}
    </div>
  );
}

export default Search;
