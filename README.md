# Protify Shuffle

A web app that extends Spotify with features the native client lacks - true random shuffle, playlist bundling, and genre/metadata-based search.

## Features

**Shuffle** - Spotify's shuffle is not truly random; it tends to repeat artists and favor recently played tracks. This app implements an unbiased random shuffle across any playlist.

**Bundles** - Pair two tracks together (an "intro" and a "main" track) so they always play back-to-back when shuffling. Useful for songs that flow naturally into each other or that belong in a specific sequence.

**Search** - Filter your library by genre, artist, release year, and other metadata pulled from the Spotify API. (Work in progress.)

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python / Flask |
| Spotify API | Spotipy |
| Database | SQLite via SQLAlchemy |
| Background jobs | APScheduler |
| Frontend | React (TypeScript) |
| HTTP client | Axios |

## Prerequisites

- Python 3.10+
- Node.js 16+ and npm
- A [Spotify Developer](https://developer.spotify.com/dashboard) account with a registered app

## Setup

### 1. Spotify credentials

Create an app in the Spotify Developer Dashboard and set the redirect URI to:

```
http://127.0.0.1:8888/callback
```

### 2. Backend

```bash
cd server
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install flask spotipy python-dotenv apscheduler flask-cors sqlalchemy
```

Create `server/.env`:

```
SPOTIPY_CLIENT_ID=your_client_id
SPOTIPY_CLIENT_SECRET=your_client_secret
SPOTIPY_REDIRECT_URI=http://127.0.0.1:8888/callback
```

Initialize the database and start the server:

```bash
python create_db.py
python app.py
```

The backend runs on `http://localhost:8888`.

### 3. Frontend

```bash
cd client
npm install
npm start
```

The frontend runs on `http://localhost:3000`.

## Usage

1. Open `http://localhost:3000` in your browser.
2. Click **Login with Spotify** and authorize the app.
3. Your playlists and saved tracks are fetched and cached locally on first login.
4. Use the **Shuffler** tab to pick a playlist and start a truly random playback queue.
5. Use the **Bundles** tab to create and manage track pairs that always play together.
6. Use the **Search** tab to filter tracks by genre or other metadata.

## Project Structure

```
spotify-random-shuffler/
├── server/
│   ├── app.py               # Flask entry point (port 8888)
│   ├── routes.py            # API route definitions
│   ├── database.py          # SQLAlchemy models
│   ├── spotify_helpers.py   # Spotify API logic and caching
│   ├── scheduler.py         # Background job setup
│   └── create_db.py         # Database initialization script
├── client/
│   └── src/
│       ├── App.tsx          # Root component and routing
│       ├── Shuffler.tsx     # Shuffle feature
│       ├── Bundles.tsx      # Bundle management
│       ├── Search.tsx       # Search and filter feature
│       ├── MiniPlayer.tsx   # Track preview player
│       └── services.tsx     # API call helpers
├── requirements.txt
└── README.md
```

## API Overview

| Method | Endpoint | Description |
|---|---|---|
| GET | `/login` | Initiates Spotify OAuth flow |
| GET | `/callback` | OAuth callback; returns user info and token |
| GET | `/api/get_playlists` | Returns playlists for a user |
| GET | `/api/get_bundles` | Returns bundles for a user |

## Notes

- Track metadata (artists, genres, albums) is cached in a local SQLite database on first login to reduce Spotify API calls in subsequent sessions.
- Playback control features require a Spotify Premium account.
