import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const categories = ["artist", "time period"];

interface Artist {
  id: string;
  name: string;
}

interface Track {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
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
  const [selectedCategory, setSelectedCategory] = useState("");
  const [artistResults, setArtistResults] = useState<Artist[]>([]);
  const [artistInputs, setArtistInputs] = useState<string[]>([""]);
  const [startYear, setStartYear] = useState("");
  const [endYear, setEndYear] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [selectAll, setSelectAll] = useState(false);

  // missing states
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showExisting, setShowExisting] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  const navigate = useNavigate();

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
      } catch {
        setArtistResults([]);
      }
    };

    fetchArtists();
  }, [selectedCategory, artistInputs]);

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

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedTracks(new Set());
    } else {
      const allIds = new Set(searchResults.map((track) => track.id));
      setSelectedTracks(allIds);
    }
    setSelectAll(!selectAll);
  };

  const removeArtistFilter = (index: number) => {
    const updated = [...artistInputs];
    updated.splice(index, 1);
    if (updated.length === 0) updated.push(""); // keep at least one input
    setArtistInputs(updated);
  };

  const clearTimePeriod = () => {
    setStartYear("");
    setEndYear("");
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
                <button onClick={() => setArtistInputs([...artistInputs, ""])} style={{ marginLeft: "5px" }}>
                  +
                </button>
              )}
              <button onClick={() => removeArtistFilter(i)} style={{ marginLeft: "5px" }}>
                -
              </button>
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
          {(startYear || endYear) && (
            <button onClick={clearTimePeriod} style={{ marginLeft: "10px" }}>
              clear
            </button>
          )}
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
          <button onClick={toggleSelectAll} style={{ marginBottom: "10px" }}>
            {selectAll ? "deselect all" : "select all"}
          </button>
          <ul style={{ listStyleType: "none", padding: 0 }}>
            {searchResults.map((track) => (
              <li key={track.id} style={{ marginBottom: "8px" }}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedTracks.has(track.id)}
                    onChange={() => toggleTrack(track.id)}
                  />{" "}
                  {track.name} - {track.artists.map((a) => a.name).join(", ")}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {searchResults.length > 0 && (
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
