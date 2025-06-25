import React, { useState } from "react";
import axios from "axios";

function Shuffler({ userId, onBack, token }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleShuffle = async (choice) => {
    setLoading(true);
    setMessage("");

    try {
      const res = await axios.post("http://localhost:8888/api/shuffle", {
            token,
            code: null,
            shuffle_choice: choice,
        });
      setMessage(res.data.message);
    } catch (err) {
      setMessage("error shuffling");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h2>shuffle options</h2>
      <h3>please remember to clear your queue before shuffling!</h3>
      <button onClick={() => handleShuffle("1")} disabled={loading}>
        liked songs
      </button>
      <br /><br />
      {/* <button onClick={() => handleShuffle("2")} disabled={loading}>
        choose a playlist
      </button>
      <br /><br />
      <button onClick={() => handleShuffle("3")} disabled={loading}>
        random playlist
      </button> */}
      <br /><br />
      {message && <p>{message}</p>}
      <br />
      <button onClick={onBack}>Back</button>
    </div>
  );
}

export default Shuffler;
