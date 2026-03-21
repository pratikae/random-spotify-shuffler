import React from "react";

interface MiniPlayerProps {
  query: string;
  trackLabel: string;
  onClose: () => void;
}

function MiniPlayer({ query, trackLabel, onClose }: MiniPlayerProps) {
  const ytSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        right: 0,
        width: "320px",
        backgroundColor: "#111",
        zIndex: 1000,
        boxShadow: "0 -2px 12px rgba(0,0,0,0.4)",
        borderTopLeftRadius: "8px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "6px 10px",
          color: "#fff",
          fontSize: "0.8rem",
          gap: "8px",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {trackLabel}
        </span>
        <a
          href={ytSearchUrl}
          target="_blank"
          rel="noreferrer"
          style={{ color: "#aaa", fontSize: "0.75rem", whiteSpace: "nowrap", textDecoration: "none" }}
        >
          open ↗
        </a>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: "1rem", lineHeight: 1, flexShrink: 0 }}
        >
          ✕
        </button>
      </div>
      <iframe
        width="320"
        height="180"
        src={`https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(query)}`}
        allow="autoplay; encrypted-media"
        allowFullScreen
        style={{ display: "block", border: "none" }}
        title={trackLabel}
      />
    </div>
  );
}

export default MiniPlayer;
