import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const categories = ["artist", "time period"]; // took out genre

interface Artist {
  id: string;
  name: string;
}

interface Track {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
}

interface SearchProps {
  userId: string;
  token: string | null;
}

function Search({ userId, token }: SearchProps) {
  const [selectedCategory, setSelectedCategory] = useState("");
  const [artistResults, setArtistResults] = useState<Artist[]>([]);
  const [artistInputs, setArtistInputs] = useState<string[]>([""]);
  const [genreInputs, setGenreInputs] = useState<string[]>([""]);
  const [startYear, setStartYear] = useState("");
  const [endYear, setEndYear] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [playlists, setPlaylists] = useState<{ id: string; name: string; num_tracks: number }[]>([]);
  const [showExisting, setShowExisting] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);


  const navigate = useNavigate();

  // get genres on load for genre options -> not working :(
  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const res = await fetch(`http://localhost:8888/api/get_genres?user_id=${userId}`);
        const data = await res.json();
        setGenres(data.genres || []);
      } catch (error) {
        console.error("Failed to fetch genres:", error);
      }
    };
    fetchGenres();
  }, [userId]);

  // artist autocomplete!
  useEffect(() => {
    const lastInput = artistInputs[artistInputs.length - 1];
    if (selectedCategory !== "artist" || lastInput.length < 2) {
      setArtistResults([]);
      return;
    }

    const fetchArtists = async () => {
      try {
        const res = await axios.get<Artist[]>(
          `http://localhost:8888/api/search_artists?query=${encodeURIComponent(lastInput)}`
        );
        setArtistResults(res.data);
      } catch (e) {
        console.error("artist search error", e);
        setArtistResults([]);
      }
    };

    fetchArtists();
  }, [selectedCategory, artistInputs]);

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

  const doArtistSelect = (artist: Artist, index: number) => {
    const updated = [...artistInputs];
    updated[index] = artist.name;
    setArtistInputs(updated);
    setArtistResults([]);
  };

  const doSearch = async () => {
    setLoading(true);
    try {
      const payload: any = {};
      if (selectedCategory === "artist") {
        payload.artists = artistInputs.filter((a) => a.trim() !== "");
      } else if (selectedCategory === "genre") {
        payload.genres = genreInputs.filter((g) => g.trim() !== "");
      } else if (selectedCategory === "time period") {
        payload.start_year = startYear;
        payload.end_year = endYear;
      }

      const res = await axios.post<Track[]>(
        "http://localhost:8888/api/search_category",
        payload,
        { headers: { "Content-Type": "application/json" } }
      );

      setSearchResults(res.data);
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

  const doAddToQueue = async () => {
    try {
      await axios.post("http://localhost:8888/api/queue", {
        track_ids: Array.from(selectedTracks),
        token: token
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
      console.log({
        name: newPlaylistName.trim(),
        track_ids: Array.from(selectedTracks),
        user_id: userId,
        token: token
      });
      await axios.post("http://localhost:8888/api/playlist/new", {
        name: newPlaylistName.trim(),
        track_ids: Array.from(selectedTracks),
        token: token,
        user_id: userId
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
        token: token
      });
      setMessage({ text: "tracks added to playlist", type: "success" });
      setSelectedPlaylistId(""); 
      setShowExisting(false); 
    } catch (err) {
      console.error("failed to add tracks to playlist", err);
      setMessage({ text: "error adding to playlist", type: "error" });
    }
  };

  const doRemoveFromLiked = async () => {
    try {
      await axios.post("http://localhost:8888/api/remove_liked", {
        track_ids: Array.from(selectedTracks),
        token: token,
        user_id: userId
      });
      setMessage({ text: "removed from liked songs", type: "success" });
    } catch (e) {
      console.error("error removing from liked", e);
      setMessage({ text: "error removing from liked", type: "error" });
    }
  };

  const renderInput = () => {
    if (selectedCategory === "artist") {
      return (
        <div style={{ marginTop: "20px" }}>
          {artistInputs.map((value, i) => (
            <div key={i}>
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
                <button onClick={() => setArtistInputs([...artistInputs, ""])}>+</button>
              )}
              {i === artistInputs.length - 1 && artistResults.length > 0 && (
                <ul style={{ listStyleType: "none", padding: "5px", margin: 0 }}>
                  {artistResults.map((artist) => (
                    <li
                      key={artist.id}
                      onClick={() => doArtistSelect(artist, i)}
                      style={{ cursor: "pointer", padding: "4px" }}
                    >
                      {artist.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      );
    }

    if (selectedCategory === "genre") {
      return (
        <div style={{ marginTop: "20px" }}>
          {genreInputs.map((value, i) => (
            <div key={i}>
              <select
                value={value}
                onChange={(e) => {
                  const updated = [...genreInputs];
                  updated[i] = e.target.value;
                  setGenreInputs(updated);
                }}
              >
                <option value="">-- select genre --</option>
                {genres.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              {i === genreInputs.length - 1 && (
                <button onClick={() => setGenreInputs([...genreInputs, ""])}>+</button>
              )}
            </div>
          ))}
        </div>
      );
    }

    if (selectedCategory === "time period") {
      return (
        <div style={{ marginTop: "20px" }}>
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
              placeholder="e.g. 2020"
              value={endYear}
              onChange={(e) => setEndYear(e.target.value)}
            />
          </label>
        </div>
      );
    }

    return null;
  };

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h2>search by category</h2>

      <label>
        select a category:{" "}
        <select
          value={selectedCategory}
          onChange={(e) => {
            setSelectedCategory(e.target.value);
            setArtistInputs([""]);
            setGenreInputs([""]);
            setStartYear("");
            setEndYear("");
            setArtistResults([]);
          }}
        >
          <option value="">-- select --</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </label>

      {renderInput()}

      <div style={{ marginTop: "20px" }}>
        <button onClick={doSearch} disabled={loading || !selectedCategory}>
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
          <h3>results !</h3>
          <ul style={{ listStyleType: "none", padding: 0 }}>
            {searchResults.map((track) => (
              <li key={track.id} style={{ marginBottom: "8px" }}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedTracks.has(track.id)}
                    onChange={() => toggleTrack(track.id)}
                  />{" "}
                  {track.name} – {track.artists.map((a) => a.name).join(", ")}
                </label>
              </li>
            ))}
          </ul>

          <div style={{ marginTop: "20px" }}>
            <button onClick={doAddToQueue}>add to queue</button>{" "}
            <button onClick={() => {setShowNew(!showNew); setShowExisting(false);}}>
              make new playlist
            </button>{" "}
            <button onClick={() => {setShowExisting(!showExisting); setShowNew(false);}}>
              add to existing playlist
            </button>{" "}
            <button onClick={doRemoveFromLiked}>remove from liked</button>{" "}
            
            {/* new playlist input */}
            {showNew && (
              <div style={{ marginTop: "10px" }}>
                <input
                  type="text"
                  placeholder="enter new playlist name"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                />
                <button
                  onClick={doCreateNewPlaylist}
                  style={{ marginLeft: "10px" }}
                >
                  create
                </button>
              </div>
            )}

            {/* existing playlist dropdown */}
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
    </div>
  );
}

export default Search;
