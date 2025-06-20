from flask import Blueprint, request, jsonify, redirect, current_app
import random
import spotipy
import spotify_helpers
from app import queue_scheduler
from database import SessionLocal, User, Playlist, Track
from spotify_helpers import load_user_cache


routes = Blueprint("routes", __name__)

def get_spotify_client(code=None, token=None):
    if token:
        return spotipy.Spotify(auth=token)
    elif code:
        token_info = current_app.sp_oauth.get_access_token(code)
        return spotipy.Spotify(auth=token_info['access_token'])
    else:
        raise Exception("no token or code given")

@routes.route("/login")
def login():
    auth_url = current_app.sp_oauth.get_authorize_url()
    return redirect(auth_url)

@routes.route("/callback")
def callback():
    code = request.args.get("code")
    if not code:
        return jsonify({"error": "no code param"}), 400

    sp = get_spotify_client(code=code)
    user_id = sp.me()["id"]

    cache_permission = request.args.get("cache_permission", "1")
    if cache_permission != "1":
        return jsonify({"error": "user didn't give permission to cache"}), 403

    db = SessionLocal()
    spotify_helpers.cache_user(sp, user_id)
    db.close()

    return jsonify({"message": "Callback success", "user_id": user_id})

@routes.route("/api/get_playlists", methods="GET")
def api_get_playlists():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "no user_id"}), 400

    db = SessionLocal()
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        db.close()
        return jsonify({"error": "user not found"}), 404

    playlists = [
        {
            "id": playlist.id,
            "name": playlist.name,
            "num_tracks": len(playlist.tracks)
        }
        for playlist in user.playlists
    ]
    db.close()
    return jsonify(playlists)

@routes.route("/api/get_saved_songs", methods="GET")
def api_get_saved_songs():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "no user_id"}), 400

    db = SessionLocal()
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        db.close()
        return jsonify({"error": "user not found"}), 404

    tracks = [
        {"id": t.id, "name": t.name, "album": t.album.name if t.album else None}
        for t in user.saved_tracks
    ]
    db.close()
    return jsonify({
        "num_saved_songs": len(tracks),
        "tracks": tracks
    })

@routes.route("/api/shuffle", methods=["POST"])
def api_shuffle():
    data = request.get_json()
    sp = get_spotify_client(code=data.get("code"), token=data.get("token"))
    user_id = sp.current_user()["id"]
    shuffle_choice = data.get("shuffle_choice")

    if not user_id or not shuffle_choice:
        return jsonify({"error": "no required fields"}), 400

    db = SessionLocal()
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        db.close()
        return jsonify({"error": "user not found"}), 404

    devices = sp.devices().get("devices", [])
    if not devices:
        return jsonify({"error": "no devices found"}), 400

    device_id = devices[0]["id"]

    if shuffle_choice == "1":
        track_uris = [t.id for t in user.saved_tracks]
        playlist_name = "liked songs"
    elif shuffle_choice == "2":
        playlist_id = data.get("playlist_id")
        playlist = db.query(Playlist).filter_by(id=playlist_id, user_id=user_id).first()
        if not playlist:
            db.close()
            return jsonify({"error": "invalid playlist_id"}), 404
        playlist_name = playlist.name
        track_uris = [t.id for t in playlist.tracks]
    elif shuffle_choice == "3":
        if not user.playlists:
            db.close()
            return jsonify({"error": "no playlists"}), 400
        playlist = random.choice(user.playlists)
        playlist_name = playlist.name
        track_uris = [t.id for t in playlist.tracks]
    else:
        db.close()
        return jsonify({"error": "invalid shuffle_choice"}), 400

    random.shuffle(track_uris)
    spotify_helpers.start_playback_with_queue(sp, track_uris, device_id, queue_scheduler, user_id=user_id)


    return jsonify({
        "message": f"shuffling {playlist_name}!",
        "num_tracks": len(track_uris)
    })

@routes.route("/api/cache/refresh", methods=["POST"])
def api_cache_refresh():
    data = request.get_json()
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "no user_id"}), 400

    sp = get_spotify_client(token=data.get("token"))
    spotify_helpers.cache_user(sp, user_id)
    return jsonify({"message": "cache refreshed"})

@routes.route("/api/cache/clear", methods=["POST"])
def api_cache_clear():
    data = request.get_json()
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "no user_id"}), 400

    db = SessionLocal()
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        for playlist in user.playlists:
            db.delete(playlist)
        user.saved_tracks.clear()
        db.commit()
    db.close()

    return jsonify({"message": "cache cleared"})

@routes.route("/api/revoke", methods=["POST"])
def api_revoke():
    return api_cache_clear()
