import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import axios from "axios";

interface LayoutProps {
  userId: string;
  token: string;
  userName: string;
  onLogout: () => void;
  children: React.ReactNode;
}

function Layout({ userId, token, userName, onLogout, children }: LayoutProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [fullRefreshing, setFullRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshMsg("");
    try {
      await axios.post("/api/cache/refresh", { user_id: userId, token });
      setRefreshMsg("synced");
      setTimeout(() => setRefreshMsg(""), 3000);
    } catch {
      setRefreshMsg("error");
      setTimeout(() => setRefreshMsg(""), 3000);
    } finally {
      setRefreshing(false);
    }
  };

  const handleFullRefresh = async () => {
    if (!window.confirm("Full refresh clears and re-caches everything. This takes a while — continue?")) return;
    setFullRefreshing(true);
    setRefreshMsg("");
    try {
      await axios.post("/api/cache/full_refresh", { user_id: userId, token });
      setRefreshMsg("full sync done");
      setTimeout(() => setRefreshMsg(""), 4000);
    } catch {
      setRefreshMsg("error");
      setTimeout(() => setRefreshMsg(""), 3000);
    } finally {
      setFullRefreshing(false);
    }
  };

  const navLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "8px 12px",
    borderRadius: "6px",
    fontSize: "0.9rem",
    fontWeight: isActive ? 700 : 400,
    color: isActive ? "#fff" : "var(--muted)",
    backgroundColor: isActive ? "var(--hover)" : "transparent",
    transition: "color 0.1s, background-color 0.1s",
  });

  const busy = refreshing || fullRefreshing;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* sidebar */}
      <nav
        style={{
          width: "var(--sidebar-w)",
          minWidth: "var(--sidebar-w)",
          backgroundColor: "#000",
          display: "flex",
          flexDirection: "column",
          padding: "24px 12px 16px",
          overflow: "hidden",
        }}
      >
        {/* logo */}
        <div style={{ marginBottom: "28px", paddingLeft: "4px" }}>
          <span style={{ fontSize: "1.3rem", fontWeight: 700, color: "#fff", letterSpacing: "-0.5px" }}>
            🎲 protify
          </span>
        </div>

        {/* nav links */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <NavLink to="/shuffler" style={navLinkStyle}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
            </svg>
            library
          </NavLink>
          <NavLink to="/bundles" style={navLinkStyle}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
            bundles
          </NavLink>
          <NavLink to="/search" style={navLinkStyle}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            search
          </NavLink>
        </div>

        {/* spacer */}
        <div style={{ flex: 1 }} />

        {/* bottom section */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "12px", paddingLeft: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {userName}
          </div>

          {/* quick refresh */}
          <button
            onClick={handleRefresh}
            disabled={busy}
            style={{
              width: "100%",
              padding: "8px 12px",
              backgroundColor: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              color: refreshMsg === "error" ? "#ff4d4d" : (refreshMsg ? "var(--accent)" : "var(--muted)"),
              fontSize: "0.8rem",
              marginBottom: "6px",
              transition: "color 0.2s",
            }}
          >
            {refreshing ? "syncing..." : refreshMsg || "refresh cache"}
          </button>

          {/* full refresh */}
          <button
            onClick={handleFullRefresh}
            disabled={busy}
            style={{
              width: "100%",
              padding: "8px 12px",
              backgroundColor: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              color: fullRefreshing ? "var(--accent)" : "#666",
              fontSize: "0.75rem",
              marginBottom: "8px",
              transition: "color 0.2s",
            }}
          >
            {fullRefreshing ? "rebuilding..." : "full refresh"}
          </button>

          <button
            onClick={onLogout}
            disabled={busy}
            style={{
              width: "100%",
              padding: "8px 12px",
              backgroundColor: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              color: "var(--muted)",
              fontSize: "0.8rem",
            }}
          >
            log out
          </button>
        </div>
      </nav>

      {/* main content */}
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          backgroundColor: "var(--bg)",
          padding: "32px",
        }}
      >
        {children}
      </main>
    </div>
  );
}

export default Layout;
