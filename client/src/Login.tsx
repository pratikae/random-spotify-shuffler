import React from "react";

const Login: React.FC = () => {
  return (
    <div
      style={{
        height: "100vh",
        backgroundColor: "#121212",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "24px",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "8px" }}>🎲</div>
        <h1 style={{ color: "#fff", fontSize: "2rem", fontWeight: 700, margin: 0 }}>protify</h1>
        <p style={{ color: "#b3b3b3", marginTop: "8px", fontSize: "0.95rem" }}>
          extended features for spotify
        </p>
      </div>
      <button
        onClick={() => { window.location.href = "/login"; }}
        style={{
          backgroundColor: "#1DB954",
          color: "#000",
          border: "none",
          borderRadius: "500px",
          padding: "14px 36px",
          fontSize: "0.95rem",
          fontWeight: 700,
          letterSpacing: "0.05em",
          cursor: "pointer",
          transition: "background-color 0.2s, transform 0.1s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1ed760")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#1DB954")}
      >
        log in with spotify
      </button>
    </div>
  );
};

export default Login;
