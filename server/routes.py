from flask import Blueprint, request, jsonify, redirect, current_app
import random
import spotipy
import spotify_helpers
from app import queue_scheduler
from database import SessionLocal
from spotify_helpers import load_user_cache

routes = Blueprint("routes", __name__)

# need to rewrite these to account for new database structure

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

@routes.route("/api/playlists")
def api_get_playlists():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "no user_id"}), 400

    cache = load_user_cache(user_id)
    if not cache:
        return jsonify({"error": "no cache found"}), 404

    playlists = [
        {
            "id": pid,
            "name": p["name"],
            "num_tracks": len(p["tracks"])
        }
        for pid, p in cache["playlists"].items()
    ]
    return jsonify(playlists)

@routes.route("/api/saved_songs")
def api_get_saved_songs():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "no user_id"}), 400

    cache = load_user_cache(user_id)
    if not cache:
        return jsonify({"error": "no cache found"}), 404

    return jsonify({
        "num_saved_songs": len(cache["saved_songs"]),
        "tracks": cache["saved_songs"]
    })

@routes.route("/api/shuffle", methods=["POST"])
def api_shuffle():
    data = request.get_json()
    sp = get_spotify_client(code=data.get("code"), token=data.get("token"))
    user_id = sp.current_user()["id"]
    shuffle_choice = data.get("shuffle_choice")

    if not user_id or not shuffle_choice:
        return jsonify({"error": "no required fields"}), 400

    cache = load_user_cache(user_id)
    if not cache:
        return jsonify({"error": "no cache found"}), 404

    devices = sp.devices().get("devices", [])
    if not devices:
        return jsonify({"error": "no devices found"}), 400

    device_id = devices[0]["id"]

    if shuffle_choice == "1":
        track_uris = cache["saved_songs"]
        playlist_name = "liked songs"
    elif shuffle_choice == "2":
        playlist_id = data.get("playlist_id")
        if playlist_id not in cache["playlists"]:
            return jsonify({"error": "invalid playlist_id"}), 404
        playlist_name = cache["playlists"][playlist_id]["name"]
        track_uris = cache["playlists"][playlist_id]["tracks"]
    elif shuffle_choice == "3":
        playlist_id = random.choice(list(cache["playlists"].keys()))
        playlist_name = cache["playlists"][playlist_id]["name"]
        track_uris = cache["playlists"][playlist_id]["tracks"]
    else:
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
    db = SessionLocal()
    user_cache = db.query(spotify_helpers.UserCache).filter_by(user_id=user_id).first()
    if user_cache:
        db.delete(user_cache)
        db.commit()
    db.close()
    return jsonify({"message": "cache cleared"})

@routes.route("/api/revoke", methods=["POST"])
def api_revoke():
    return api_cache_clear()
