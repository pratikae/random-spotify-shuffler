import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

interface Artist {
  id: string;
  name: string;
}

interface Track {
  id: string;
  name: string;
  artists: Artist[];
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

function Bundles({ userId, token }: BundleProps) {
  const [bundles, setBundles] = useState<BundleWithTracks[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [message, setMessage] = useState("");

  const [introQuery, setIntroQuery] = useState("");
  const [mainQuery, setMainQuery] = useState("");

  const [introResults, setIntroResults] = useState<Track[]>([]);
  const [mainResults, setMainResults] = useState<Track[]>([]);

  const [introId, setIntroId] = useState("");
  const [mainId, setMainId] = useState("");

  const [strict, setStrict] = useState(false);
  const navigate = useNavigate();

  // get bundles, then fetch full tracks for each bundle to show artists
  useEffect(() => {
    const fetchBundles = async () => {
      try {
        const res = await axios.get<Bundle[]>(`http://localhost:8888/api/get_bundles?user_id=${userId}`);
        const bundlesData = res.data;

        // get full track info for each intro and main song in bundles
        const tracksToFetch = new Set<string>();
        bundlesData.forEach(b => {
          tracksToFetch.add(b.intro_song_id);
          tracksToFetch.add(b.main_song_id);
        });

        // get track details for all unique track ids in parallel
        const trackDetails = await Promise.all(
          Array.from(tracksToFetch).map(id =>
            axios.get<Track>(`http://localhost:8888/api/get_track?id=${id}`).then(r => r.data)
          )
        );

        const trackMap = new Map(trackDetails.map(t => [t.id, t]));

        // map bundles to include full track info
        const bundlesWithTracks: BundleWithTracks[] = bundlesData.map(b => ({
          ...b,
          intro_song: trackMap.get(b.intro_song_id),
          main_song: trackMap.get(b.main_song_id),
        }));

        setBundles(bundlesWithTracks);
      } catch (e) {
        setMessage("failed to load bundles");
      }
    };
    fetchBundles();
  }, [userId]);

  // get intro song search results
  useEffect(() => {
    if (introQuery.length < 2) {
      setIntroResults([]);
      return;
    }
    const fetchIntroSongs = async () => {
      try {
        const res = await axios.get<Track[]>(`http://localhost:8888/api/search_songs?query=${encodeURIComponent(introQuery)}`);
        setIntroResults(res.data);
      } catch {
        setIntroResults([]);
      }
    };
    fetchIntroSongs();
  }, [introQuery]);

  // get main song search results
  useEffect(() => {
    if (mainQuery.length < 2) {
      setMainResults([]);
      return;
    }
    const fetchMainSongs = async () => {
      try {
        const res = await axios.get<Track[]>(`http://localhost:8888/api/search_songs?query=${encodeURIComponent(mainQuery)}`);
        setMainResults(res.data);
      } catch {
        setMainResults([]);
      }
    };
    fetchMainSongs();
  }, [mainQuery]);

    // create a new bundle
    const doCreateBundle = async () => {
        try {
            console.log({
                introId,
                mainId,
                strict
            });
        const res = await axios.post<Bundle>(`http://localhost:8888/api/create_bundle`, {
            user_id: userId,
            intro_song_id: introId,
            main_song_id: mainId,
            strict,
        });

        // get full track info for created bundle songs
        const [introSong, mainSong] = await Promise.all([
            axios.get<Track>(`http://localhost:8888/api/get_track?id=${res.data.intro_song_id}`).then(r => r.data),
            axios.get<Track>(`http://localhost:8888/api/get_track?id=${res.data.main_song_id}`).then(r => r.data),
        ]);

        setBundles([
            ...bundles,
            {
            ...res.data,
            intro_song: introSong,
            main_song: mainSong,
            },
        ]);

        setShowCreateForm(false);
        setIntroId("");
        setMainId("");
        setIntroQuery("");
        setMainQuery("");
        setStrict(false);
        } catch {
        setMessage("error creating bundle");
        }
    };

    const toggleStrict = async (bundleId: number, newStrict: boolean) => {
        try {
            await axios.patch(`http://localhost:8888/api/bundles/${bundleId}`, { strict: newStrict });
            setBundles(prev =>
            prev.map(b => (b.id === bundleId ? { ...b, strict: newStrict } : b))
            );
        } catch (error) {
            setMessage("failed to update strict setting");
            console.error(error);
        }
    };

    const deleteBundle = async (bundleId: number) => {
        try {
            await axios.delete(`http://localhost:8888/api/bundles/${bundleId}`);
            setBundles(prev => prev.filter(b => b.id !== bundleId));
        } catch (error) {
            setMessage("failed to delete bundle");
            console.error(error);
        }
    };

    const renderBundle = (b: BundleWithTracks) => {
        const formatArtists = (artists?: Artist[]) =>
            artists?.map(a => a.name).join(", ") ?? "unknown artists";

        const intro = b.intro_song
            ? `${b.intro_song.name} — ${formatArtists(b.intro_song.artists)}`
            : b.intro_song_id;

        const main = b.main_song
            ? `${b.main_song.name} — ${formatArtists(b.main_song.artists)}`
            : b.main_song_id;

        return (
            <div
            key={b.id}
            style={{
                border: "1px solid #ccc",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "16px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                backgroundColor: "#fff",
                position: "relative"
            }}
            >
            <label style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
                <input
                type="checkbox"
                checked={b.strict}
                onChange={(e) => toggleStrict(b.id, e.target.checked)}
                style={{ marginRight: "8px" }}
                />
                strict
            </label>
            <div style={{ fontWeight: 500 }}>{intro}</div>
            <div>{main}</div>
            <button
                onClick={() => deleteBundle(b.id)}
                style={{
                position: "absolute",
                top: "12px",
                right: "12px",
                backgroundColor: "#ff4d4d",
                color: "white",
                border: "none",
                borderRadius: "4px",
                padding: "4px 8px",
                cursor: "pointer"
                }}
            >
                delete
            </button>
            </div>
        );
    };

  // dropdown styles
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

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h2>bundles !</h2>

      <button onClick={() => setShowCreateForm(!showCreateForm)}>
        {showCreateForm ? "cancel" : "create new bundle"}
      </button>

      {showCreateForm && (
        <div style={{ marginTop: "20px" }}>
          <h3>create bundle</h3>

          <label>
            first song:{" "}
            <input
              type="text"
              placeholder="type song name"
              value={introQuery}
              onChange={(e) => {
                setIntroQuery(e.target.value);
                setIntroId("");
              }}
            />
          </label>
          {introResults.length > 0 && (
            <ul style={dropdownStyle}>
              {introResults.map((song) => (
                <li
                  key={song.id}
                  onClick={() => {
                    setIntroId(song.id);
                    setIntroQuery(`${song.name}, ${song.album} — ${song.artists.map(a => a.name).join(", ")}`);
                    setIntroResults([]);
                  }}
                  style={{ cursor: "pointer", padding: "4px 0", borderBottom: "1px solid #eee" }}
                >
                  {song.name} — {song.artists.map(a => a.name).join(", ")}
                </li>
              ))}
            </ul>
          )}

          <br />

          <label>
            second song:{" "}
            <input
              type="text"
              placeholder="type song name"
              value={mainQuery}
              onChange={(e) => {
                setMainQuery(e.target.value);
                setMainId("");
              }}
            />
          </label>
          {mainResults.length > 0 && (
            <ul style={dropdownStyle}>
              {mainResults.map((song) => (
                <li
                  key={song.id}
                  onClick={() => {
                    setMainId(song.id);
                    setMainQuery(`${song.name}, ${song.album} — ${song.artists.map(a => a.name).join(", ")}`);
                    setMainResults([]);
                  }}
                  style={{ cursor: "pointer", padding: "4px 0" }}
                >
                  {song.name} — {song.artists.map(a => a.name).join(", ")}
                </li>
              ))}
            </ul>
          )}

          <br />

          <label>
            <input
              type="checkbox"
              checked={strict}
              onChange={(e) => setStrict(e.target.checked)}
            />
            strict
          </label>

          <br />
          <br />

          <button onClick={doCreateBundle} disabled={!introId || !mainId}>
            save
          </button>
        </div>
      )}

    <div style={{ display: "flex", justifyContent: "center", marginTop: "40px" }}>
        <div style={{ width: "400px" }}>
            <h3 style={{ textAlign: "center" }}>saved bundles ({bundles.length})</h3>
            {bundles.map(renderBundle)}
        </div>
    </div>

        {message && <p>{message}</p>}
      <button onClick={() => navigate("/")}>back</button>
    </div>
  );
}

export default Bundles;
