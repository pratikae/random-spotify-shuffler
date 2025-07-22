from flask import Blueprint, request, jsonify, redirect, current_app
import random
import spotipy
import spotify_helpers
from scheduler import queue_scheduler
from database import SessionLocal, User, Playlist, Track, Album, Artist, PodcastEpisode, Show, Bundle, track_artist_table, playlist_track_table, saved_track_table
from spotify_helpers import cache_liked_songs, cache_playlists_async, apply_bundles, fetch_genres, get_tracks_by_artists, get_tracks_by_genres, get_tracks_by_release_year, get_playlists
from spotipy import Spotify

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

# main shuffle route
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
    
# bundle routes
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
    try:
        bundle = db.query(Bundle).filter_by(id=bundle_id).first()
        if not bundle:
            return jsonify({"error": "bundle not found"}), 404

        bundle.strict = strict  # dont change it again!!
        db.commit()
        return jsonify({"message": "bundle updated", "bundle_id": bundle_id, "strict": strict})
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()

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

@routes.route("/api/search_category", methods=["POST"])
def api_search_category():
    data = request.get_json()
    artists = data.get("artists", [])
    genre = data.get("genre")
    start_year = data.get("start_year")
    end_year = data.get("end_year")
    limit = int(data.get("limit", 50))

    db = SessionLocal()

    try:
        all_tracks = []

        # artists
        if artists:
            artist_tracks = get_tracks_by_artists(db, artists)
            all_tracks.extend(artist_tracks)

        # genres
        if genre:
            genre_tracks = get_tracks_by_genres(db, [genre])
            all_tracks.extend(genre_tracks)

        # release date
        if start_year and end_year:
            year_tracks = get_tracks_by_release_year(db, int(start_year), int(end_year))
            all_tracks.extend(year_tracks)

        # get rid of any duplicate tracks
        track_map = {}
        for track in all_tracks:
            track_map[track.id] = track
        unique_tracks = list(track_map.values())[:limit]

        return jsonify([
            {
                "id": t.id,
                "name": t.name,
                "artists": [{"id": a.id, "name": a.name} for a in t.artists]
            } for t in unique_tracks
        ])

    except Exception as e:
        print("error in search_categories:", e)
        return jsonify([]), 500

    finally:
        db.close()

@routes.route("/api/search_artists", methods=["GET"])
def api_search_artists():
    try:
        query = request.args.get("query", "").lower()
        db = SessionLocal()
        if not query:
            return jsonify([])

        matches = (
            db.query(Artist)
            .filter(Artist.name.ilike(f"%{query}%"))
            .limit(10)
            .all()
        )

        return jsonify([
            {
                "id": artist.id,
                "name": artist.name
            }
            for artist in matches
        ])
    except Exception as e:
        print(f"search artists error: {e}")
        return jsonify({"error": "internal server error"}), 500
    finally:
        db.close()

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
                "album": s.album.name if s.album else None,
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
        print(f"search songs error: {e}")
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

@routes.route("/api/playlist/new", methods=["POST"])
def create_new_playlist():
    data = request.get_json()
    user_id = data.get("user_id")
    name = data.get("name")
    track_ids = data.get("track_ids", [])
    token = data.get("token")

    if not user_id or not name:
        return jsonify({"error": "missing user_id or name"}), 400
    
    # create new playlist in spotify
    sp = Spotify(auth=token)
    try:
        new_playlist = sp.user_playlist_create(user_id, name, public=False)
        new_id = new_playlist['id']

        # add tracks to new playlist 
        if track_ids:
            sp.playlist_add_items(new_id, track_ids)

    except Exception as e:
        print("spotify error:", e)
        return jsonify({"error": "failed to create spotify playlist"}), 500

    db = SessionLocal()
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        db.close()
        return jsonify({"error": "user not found"}), 404

    # make new playlist in db
    playlist = Playlist(name=name, user=user, id=new_id)
    db.add(playlist)

    for track_id in track_ids:
        track = db.query(Track).filter_by(id=track_id).first()
        if track and track not in playlist.tracks:
            playlist.tracks.append(track)

    db.commit()
    db.close()
    
    return jsonify({"message": "playlist created", "playlist_name": name}), 200

@routes.route("/api/playlist/add_tracks", methods=["POST"])
def add_to_playlist():
    data = request.get_json()
    playlist_id = data.get("playlist_id")
    track_ids = data.get("track_ids", [])
    token = data.get("token")

    if not playlist_id or not track_ids:
        return jsonify({"error": "missing playlist_id or track_ids"}), 400

    # add to playlist in db
    db = SessionLocal()
    playlist = db.query(Playlist).filter_by(id=playlist_id).first()
    if not playlist:
        db.close()
        return jsonify({"error": "playlist not found"}), 404

    for track_id in track_ids:
        track = db.query(Track).filter_by(id=track_id).first()
        if track and track not in playlist.tracks:
            playlist.tracks.append(track)

    db.commit()
    db.close()
    
    # add to playlist in spotify
    sp = Spotify(auth=token)
    try:
        sp.playlist_add_items(playlist_id, track_ids)
        
    except Exception as e:
        print("spotify error:", e)
        return jsonify({"error": "failed to add tracks"}), 500
    
    return jsonify({"message": "tracks added to playlist"}), 200
    
@routes.route("/api/queue", methods=["POST"])
def add_to_queue():
    data = request.get_json()
    track_ids = data.get("track_ids", [])
    token = data.get("token")
    
    if not track_ids:
        return jsonify({"error": "missing track_ids"}), 400
    
    sp = Spotify(auth=token)
    try:
        for track in track_ids:
            sp.add_to_queue(track)
    except Exception as e:
        print("spotify error:", e)
        return jsonify({"error": "failed to add tracks to queue"}), 500
    
    return jsonify({"message": "track added to queue"}), 200
    
@routes.route("/api/remove_liked", methods=["POST"])    
def remove_from_liked():
    data = request.get_json()
    track_ids = data.get("track_ids", [])
    token = data.get("token")
    user_id = data.get("user_id")
    
    if not track_ids:
        return jsonify({"error": "missing track_ids"}), 400
    if not token:
        return jsonify({"error": "missing access token"}), 400
    if not user_id:
        return jsonify({"error": "missing user_id"}), 400
    
    # remove from spotify library
    sp = Spotify(auth=token)
    try:
        sp.current_user_saved_tracks_delete(track_ids)
    except Exception as e:
        print("spotify error:", e)
        return jsonify({"error": "failed to delete tracks"}), 500
    
    # remove from cache
    db = SessionLocal()
    try:
        for track in track_ids:
            db.query(saved_track_table).filter(
                (saved_track_table.c.user_id == user_id) &
                (saved_track_table.c.track_id == track)
            ).delete(synchronize_session=False)
        db.commit()
    except Exception as e:
        print("db error:", e)
        db.rollback()
        return jsonify({"error": "failed to delete tracks from cache"}), 500
    finally:
        db.close()

    return jsonify({"message": "tracks removed from liked songs"}), 200
    
    
      
# not working 
@routes.route("/api/get_genres", methods=["GET"])
def get_genres():
    print("get_genres called")
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    db = SessionLocal()
    genres_set = fetch_genres(db)
    db.close()
    
    print("genres:")
    print(genres_set)
    return jsonify({"genres": genres_set})

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

