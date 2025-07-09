from flask import Blueprint, request, jsonify, redirect, current_app
import random
import spotipy
import spotify_helpers
from scheduler import queue_scheduler
from database import SessionLocal, User, Playlist, Track, Album, Artist, PodcastEpisode, Show, Bundle, track_artist_table, playlist_track_table
from spotify_helpers import cache_liked_songs, cache_playlists_async, apply_bundles, get_bundles

routes = Blueprint("routes", __name__)

def get_spotify_client(code=None, token=None):
    if token:
        return spotipy.Spotify(auth=token)
    elif code:
        token_info = current_app.sp_oauth.get_access_token(code, as_dict=True)
        return spotipy.Spotify(auth=token_info['access_token'])
    else:
        raise Exception("no token or code given")

@routes.route("/login")
def login():
    auth_url = current_app.sp_oauth.get_authorize_url()
    return redirect(auth_url)

from urllib.parse import quote
@routes.route("/callback")
def callback():
    code = request.args.get("code")
    if not code:
        return jsonify({"error": "no code param"}), 400

    token_info = current_app.sp_oauth.get_access_token(code, as_dict=True)
    access_token = token_info["access_token"]

    sp = spotipy.Spotify(auth=access_token)
    user_info = sp.me()
    user_id = user_info["id"]
    display_name = user_info.get("display_name", user_id)

    db = SessionLocal()
    user = db.query(User).filter_by(id=user_id).first()
    db.close()
    
    # print("caching user...")
    # cache_liked_songs(sp, user_id)
    # cache_playlists_async(sp, user_id)
    
    # only cache user if they are new
    if not user:
        print("caching new user...")
        cache_liked_songs(sp, user_id)
        cache_playlists_async(sp, user_id)

    return redirect(
        f"http://localhost:3000/?user_id={user_id}&display_name={quote(display_name)}&token={access_token}"
    )

@routes.route("/api/get_playlists", methods=["GET"])
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

@routes.route("/api/get_bundles", methods=["GET"])
def api_get_bundles():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "no user_id"}), 404
    
    db = SessionLocal()
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        db.close()
        return jsonify({"error": "user not found"}), 404

    bundles = [
        {
            "id": bundle.id,
            "intro_song_id": bundle.intro_song_id,
            "main_song_id": bundle.main_song_id,
            "strict": bundle.strict
        }
        for bundle in user.bundles
    ]
    db.close()
    return jsonify(bundles)

@routes.route("/api/get_saved_songs", methods=["GET"])
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
        {
            "id": t.id, 
            "name": t.name, 
            "album": t.album.name if t.album else None
        }
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

    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        pass

    random.shuffle(track_uris) 
    bundles = user.bundles  
    if bundles:
        track_uris = apply_bundles(track_uris, bundles)
        
    db.close()
    spotify_helpers.start_playback_with_queue(sp, track_uris, device_id, queue_scheduler, user_id=user_id)

    return jsonify({
        "message": f"shuffling {playlist_name}!",
        "num_tracks": len(track_uris)
    })
    
from flask_cors import cross_origin

@routes.route('/api/create_bundle', methods=["POST", "OPTIONS"])
@cross_origin()
def api_create_bundle():
    if request.method == "OPTIONS":
        return "", 200
    data = request.json
    intro_song_id = data.get('intro_song_id')
    main_song_id = data.get('main_song_id')
    strict = data.get('strict', False)
    user_id = data.get('user_id') 

    if not intro_song_id or not main_song_id or not user_id:
        return jsonify({'error': 'Missing required song IDs or user_id'}), 400

    db = SessionLocal()
    try:
        existing = db.query(Bundle).filter_by(
            intro_song_id=intro_song_id,
            main_song_id=main_song_id,
            strict=strict,
            user_id=user_id 
        ).first()

        if existing:
            return jsonify({'error': 'bundle already exists'}), 409

        new_bundle = Bundle(
            intro_song_id=intro_song_id,
            main_song_id=main_song_id,
            strict=strict,
            user_id=user_id 
        )
        db.add(new_bundle)
        db.commit()
        db.refresh(new_bundle)
    finally:
        db.close()

    return jsonify({
        'message': 'bundle created',
        'bundle_id': new_bundle.id,
        'intro_song_id': new_bundle.intro_song_id,
        'main_song_id': new_bundle.main_song_id,
        'strict': new_bundle.strict
    }), 201

@routes.route("/api/bundles/<int:bundle_id>", methods=["PATCH"])
def api_update_bundle(bundle_id):
    data = request.json
    strict = data.get("strict")
    if strict is None:
        return jsonify({"error": "strict field required"}), 400

    db = SessionLocal()
    bundle = db.query(Bundle).filter_by(id=bundle_id).first()
    if not bundle:
        db.close()
        return jsonify({"error": "bundle not found"}), 404

    bundle.strict = strict
    db.commit()
    db.close()
    return jsonify({"message": "bundle updated", "bundle_id": bundle_id, "strict": strict})

@routes.route("/api/bundles/<int:bundle_id>", methods=["DELETE"])
def api_delete_bundle(bundle_id):
    db = SessionLocal()
    bundle = db.query(Bundle).filter_by(id=bundle_id).first()
    if not bundle:
        db.close()
        return jsonify({"error": "bundle not found"}), 404

    db.delete(bundle)
    db.commit()
    db.close()
    return jsonify({"message": "bundle deleted", "bundle_id": bundle_id})

@routes.route("/api/search_songs", methods=["GET"])
def api_search_songs():
    try:
        query = request.args.get("query", "").lower()
        db = SessionLocal()
        if not query:
            return jsonify([])

        matches = (
            db.query(Track)
            .filter(Track.name.ilike(f"%{query}%"))
            .limit(10)
            .all()
        )

        return jsonify([
            {
                "id": s.id,
                "name": s.name,
                "artists": [
                    {
                        "id": artist.id,
                        "name": artist.name
                    } for artist in s.artists
                ]
            }
            for s in matches
        ])
    except Exception as e:
        print(f"Search songs error: {e}")
        return jsonify({"error": "internal server error"}), 500
    finally:
        db.close()
        
@routes.route("/api/get_track", methods=["GET"])
def api_get_track():
    track_id = request.args.get("id")
    db = SessionLocal()
    try:
        track = db.query(Track).filter(Track.id == track_id).one_or_none()
        if not track:
            return jsonify({"error": "Track not found"}), 404

        return jsonify({
            "id": track.id,
            "name": track.name,
            "artists": [{"id": a.id, "name": a.name} for a in track.artists]
        })
    finally:
        db.close()

@routes.route("/api/cache/refresh", methods=["POST"])
def api_cache_refresh():
    data = request.get_json()
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "no user_id"}), 400

    sp = get_spotify_client(token=data.get("token"))

    api_cache_clear(sp, user_id) 
    print("refreshing cache")
    cache_liked_songs(sp, user_id)
    cache_playlists_async(sp, user_id)
    print("cache refreshed")
    return jsonify({"message": "cache cleared and refreshed, reload (playlists may take a while to appear, reload until they appear)"})

@routes.route("/api/cache/clear", methods=["POST"])
def api_cache_clear(sp, user_id):
    db = SessionLocal()

    user = db.query(User).filter(User.id == user_id).first()
    if user:
        for playlist in user.playlists:
            db.delete(playlist)

        user.saved_tracks.clear()

    # this clears the joint tables, which was the issue earlier?
    db.execute(track_artist_table.delete())
    db.execute(playlist_track_table.delete())

    # delete any remaining rows
    db.query(Track).filter(~Track.saved_by_users.any(), ~Track.playlists.any()).delete(synchronize_session=False)
    db.query(Artist).filter(~Artist.tracks.any()).delete(synchronize_session=False)
    db.query(Album).filter(~Album.tracks.any()).delete(synchronize_session=False)
    db.query(PodcastEpisode).filter(~PodcastEpisode.show.has()).delete(synchronize_session=False)
    db.query(Show).filter(~Show.episodes.any()).delete(synchronize_session=False)

    db.commit()
    db.close()

    print("cache cleared")
    return jsonify({"message": "cache cleared successfully"})

