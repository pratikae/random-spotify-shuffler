import random
import json
from flask import jsonify
from database import SessionLocal, User, Playlist, Track, Album, Artist, PodcastEpisode, Show, Bundle, Genre
from sqlalchemy.orm.exc import NoResultFound

def fetch_artist_genres(sp, artist_ids):
    """Fetch full artist details including genres from Spotify API"""
    artist_details = {}
    artist_ids_list = list(artist_ids)
    
    print(f"Fetching genres for {len(artist_ids_list)} unique artists...")
    
    # spotify only allows up to 50 artists per request
    for i in range(0, len(artist_ids_list), 50):
        batch = artist_ids_list[i:i+50]
        try:
            print(f"Fetching batch {i//50 + 1}/{(len(artist_ids_list)-1)//50 + 1}")
            results = sp.artists(batch)
            for artist in results['artists']:
                if artist:  # mae sure artist data exists
                    artist_details[artist['id']] = artist
                    print(f"Fetched {artist['name']}: {len(artist.get('genres', []))} genres")
        except Exception as e:
            print(f"Error fetching artist batch {i//50 + 1}: {e}")
    
    print(f"Successfully fetched details for {len(artist_details)} artists")
    return artist_details

# cache liked songs and playlists
def cache_all_music_data(sp, user_id):
    db = SessionLocal()
    
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        user = User(id=user_id)
        db.add(user)
        db.commit()
    
    # get all music data first
    saved_tracks = get_saved_songs(sp)
    playlists_data = get_playlists(sp)
    
    # get all unique artist ids from all sources
    all_artist_ids = set()
    all_track_data = []
    
    # saved tracks
    for item in saved_tracks:
        all_track_data.append(('saved', item))
        for artist_data in item.get("artists", []):
            all_artist_ids.add(artist_data["id"])
    
    # playlists
    playlist_tracks_data = {}
    for playlist_obj in playlists_data:
        playlist_id = playlist_obj["id"]
        print(f"Fetching tracks for playlist: {playlist_obj['name']}")
        playlist_tracks = get_songs(sp, playlist_id)
        playlist_tracks_data[playlist_id] = {
            'info': playlist_obj,
            'tracks': playlist_tracks
        }
        
        for track_data in playlist_tracks:
            if track_data and track_data.get("type") == "track" and track_data.get("id"):
                all_track_data.append(('playlist', track_data, playlist_id))
                for artist_data in track_data.get("artists", []):
                    all_artist_ids.add(artist_data["id"])
    
    # get all artist details with genres in batches
    artist_details = fetch_artist_genres(sp, all_artist_ids)
    
    # proccess saved tracks with full artist data
    for item in saved_tracks:
        # combine artist data with genres
        for artist_data in item.get("artists", []):
            if artist_data["id"] in artist_details:
                full_artist_data = artist_details[artist_data["id"]]
                artist_data.update(full_artist_data)
        
        track = get_or_create_track(item, db)
        if track and track not in user.saved_tracks:
            user.saved_tracks.append(track)
    
    # proccess playlists with full artist data
    print("Caching playlists with genre data...")
    for playlist_id, playlist_data in playlist_tracks_data.items():
        playlist_obj = playlist_data['info']
        playlist_tracks = playlist_data['tracks']
        
        playlist = db.query(Playlist).filter_by(id=playlist_id).first()
        if not playlist:
            images = playlist_obj.get("images", [])
            image_url = images[0]["url"] if images else None
            playlist = Playlist(id=playlist_id, name=playlist_obj["name"], user=user, snapshot_id=playlist_obj.get("snapshot_id"), image_url=image_url)
            db.add(playlist)
            db.flush()
        
        for track_data in playlist_tracks:
            if not track_data or track_data.get("type") != "track" or not track_data.get("id"):
                continue
                
            # combine artist data with genres
            for artist_data in track_data.get("artists", []):
                if artist_data["id"] in artist_details:
                    full_artist_data = artist_details[artist_data["id"]]
                    artist_data.update(full_artist_data)
            
            with db.no_autoflush:
                track = get_or_create_track(track_data, db)
                if track and track not in playlist.tracks:
                    playlist.tracks.append(track)
    
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()

import threading
def cache_playlists_async(sp, user_id):
    def worker():
        cache_all_music_data(sp, user_id)

    threading.Thread(target=worker).start()


def cache_incremental(sp, user_id):
    """Smart incremental cache: only fetches what changed since last cache."""
    db = SessionLocal()
    try:
        user = db.query(User).filter_by(id=user_id).first()
        if not user:
            db.close()
            cache_all_music_data(sp, user_id)
            return

        _sync_saved_tracks(sp, user, db)
        _sync_playlists(sp, user, db)

        db.commit()
        print("incremental cache complete")
    except Exception as e:
        db.rollback()
        print(f"incremental cache error: {e}")
        raise
    finally:
        db.close()


def _sync_saved_tracks(sp, user, db):
    """Add new liked songs and remove any that were unliked."""
    first_page = sp.current_user_saved_tracks(limit=1)
    spotify_total = first_page["total"]
    cached_ids = set(t.id for t in user.saved_tracks)
    cached_total = len(cached_ids)

    if spotify_total == cached_total:
        print(f"saved tracks unchanged ({spotify_total}), skipping")
        return

    print(f"saved tracks changed: cached={cached_total}, spotify={spotify_total}")

    if spotify_total > cached_total:
        # only fetch new tracks — spotify returns newest first, stop when we hit cached ones
        new_track_data = []
        results = sp.current_user_saved_tracks(limit=50)
        while results:
            all_in_batch_cached = True
            for item in results["items"]:
                track = item.get("track")
                if not track or not track.get("id"):
                    continue
                if track["id"] not in cached_ids:
                    all_in_batch_cached = False
                    new_track_data.append(track)
            if all_in_batch_cached or not results["next"]:
                break
            results = sp.next(results)

        print(f"fetching {len(new_track_data)} new saved tracks")
        new_artist_ids = {a["id"] for t in new_track_data for a in t.get("artists", [])}
        artist_details = fetch_artist_genres(sp, new_artist_ids) if new_artist_ids else {}

        for track_data in new_track_data:
            for artist_data in track_data.get("artists", []):
                if artist_data["id"] in artist_details:
                    artist_data.update(artist_details[artist_data["id"]])
            track = get_or_create_track(track_data, db)
            if track and track not in user.saved_tracks:
                user.saved_tracks.append(track)

    else:
        # songs were removed — fetch full id set from spotify and reconcile
        print("songs removed, reconciling saved tracks")
        all_spotify_ids = set()
        results = sp.current_user_saved_tracks(limit=50)
        while results:
            for item in results["items"]:
                track = item.get("track")
                if track and track.get("id"):
                    all_spotify_ids.add(track["id"])
            if not results["next"]:
                break
            results = sp.next(results)

        removed_ids = cached_ids - all_spotify_ids
        added_ids = all_spotify_ids - cached_ids

        # remove unliked tracks from user's saved list (don't delete the track itself)
        if removed_ids:
            user.saved_tracks = [t for t in user.saved_tracks if t.id not in removed_ids]
            print(f"removed {len(removed_ids)} unliked tracks")

        # add any new ones
        if added_ids:
            new_track_data = []
            results = sp.current_user_saved_tracks(limit=50)
            while results:
                for item in results["items"]:
                    track = item.get("track")
                    if track and track.get("id") in added_ids:
                        new_track_data.append(track)
                if not results["next"]:
                    break
                results = sp.next(results)

            new_artist_ids = {a["id"] for t in new_track_data for a in t.get("artists", [])}
            artist_details = fetch_artist_genres(sp, new_artist_ids) if new_artist_ids else {}
            for track_data in new_track_data:
                for artist_data in track_data.get("artists", []):
                    if artist_data["id"] in artist_details:
                        artist_data.update(artist_details[artist_data["id"]])
                track = get_or_create_track(track_data, db)
                if track and track not in user.saved_tracks:
                    user.saved_tracks.append(track)


def _sync_playlists(sp, user, db):
    """Add/update changed playlists using snapshot_id, remove deleted ones."""
    from database import Playlist
    spotify_playlists = get_playlists(sp)
    spotify_ids = {p["id"] for p in spotify_playlists}

    # remove playlists deleted from spotify
    for playlist in list(user.playlists):
        if playlist.id not in spotify_ids:
            print(f"removing deleted playlist: {playlist.name}")
            db.delete(playlist)

    for playlist_obj in spotify_playlists:
        playlist_id = playlist_obj["id"]
        snapshot_id = playlist_obj.get("snapshot_id")

        playlist = db.query(Playlist).filter_by(id=playlist_id).first()

        if playlist and playlist.snapshot_id == snapshot_id:
            print(f"playlist '{playlist.name}' unchanged, skipping")
            # still backfill image_url if it was missing
            if not playlist.image_url:
                images = playlist_obj.get("images", [])
                if images:
                    playlist.image_url = images[0]["url"]
            continue

        print(f"syncing playlist '{playlist_obj['name']}'")
        playlist_tracks = get_songs(sp, playlist_id)

        if not playlist:
            images = playlist_obj.get("images", [])
            image_url = images[0]["url"] if images else None
            playlist = Playlist(id=playlist_id, name=playlist_obj["name"], user=user, snapshot_id=snapshot_id, image_url=image_url)
            db.add(playlist)
            db.flush()
        else:
            playlist.name = playlist_obj["name"]
            playlist.snapshot_id = snapshot_id
            images = playlist_obj.get("images", [])
            playlist.image_url = images[0]["url"] if images else playlist.image_url
            playlist.tracks.clear()
            db.flush()

        # only fetch artist details for artists not already in db
        new_artist_ids = set()
        for track_data in playlist_tracks:
            if not track_data or track_data.get("type") != "track":
                continue
            for artist_data in track_data.get("artists", []):
                from database import Artist
                existing = db.get(Artist, artist_data["id"])
                if not existing or not existing.genres:
                    new_artist_ids.add(artist_data["id"])

        artist_details = fetch_artist_genres(sp, new_artist_ids) if new_artist_ids else {}

        for track_data in playlist_tracks:
            if not track_data or track_data.get("type") != "track" or not track_data.get("id"):
                continue
            for artist_data in track_data.get("artists", []):
                if artist_data["id"] in artist_details:
                    artist_data.update(artist_details[artist_data["id"]])
            with db.no_autoflush:
                track = get_or_create_track(track_data, db)
                if track and track not in playlist.tracks:
                    playlist.tracks.append(track)
    
def get_or_create_album(album_data, db):
    album_id = album_data.get("id")
    if not album_id:
        return None

    album = db.get(Album, album_data["id"])
    if not album:
        images = album_data.get("images", [])
        image_url = images[0]["url"] if images else None
        album = Album(
            id=album_data["id"],
            name=album_data["name"],
            release_date=album_data.get("release_date", ""),
            image_url=image_url
        )
        db.add(album)
    return album

def get_or_create_artist(artist_data, db):
    from sqlalchemy.exc import IntegrityError
    
    artist = db.get(Artist, artist_data["id"])
    if not artist:
        artist = Artist(id=artist_data["id"], name=artist_data["name"])
        db.add(artist)
        
    #  genres if they exist in the artist data
    if "genres" in artist_data and artist_data["genres"]:
        print(f"Processing {len(artist_data['genres'])} genres for {artist_data['name']}")
        for genre_name in artist_data["genres"]:
            genre = db.query(Genre).filter_by(name=genre_name).first()
            if not genre:
                try:
                    genre = Genre(name=genre_name)
                    db.add(genre)
                    db.flush()
                    print(f"Created new genre: {genre_name}")
                except IntegrityError:
                    # if genre already exists, rollback and get it
                    db.rollback()
                    genre = db.query(Genre).filter_by(name=genre_name).first()
                    if not genre:
                        print(f"Still couldn't find genre {genre_name}, skipping")
                        continue
            
            if genre not in artist.genres:
                artist.genres.append(genre)
                
    return artist

def get_or_create_track(track_data, db):
    if track_data.get("type") == "episode":
        return get_or_create_podcast_episode(track_data, db)

    track_id = track_data.get("id")
    if not track_id:
        print("Skipping track with missing ID:", track_data)
        return None

    track = db.get(Track, track_id)
    if not track:
        album = get_or_create_album(track_data["album"], db) if track_data.get("album") else None
        track = Track(
            id=track_id,
            name=track_data["name"],
            album=album,
            preview_url=track_data.get("preview_url")
        )
        db.add(track)
        for artist_data in track_data.get("artists", []):
            artist = get_or_create_artist(artist_data, db)
            track.artists.append(artist)
        db.flush()
    elif track.preview_url is None and track_data.get("preview_url"):
        track.preview_url = track_data.get("preview_url")
    return track

def get_or_create_podcast_episode(episode_data, db):
    episode_id = episode_data.get("id")
    if not episode_id:
        return None

    episode = db.get(PodcastEpisode, episode_id)
    if episode:
        return episode

    show = None
    if "show" in episode_data and episode_data["show"]:
        show = get_or_create_show(episode_data["show"], db)

    episode = PodcastEpisode(
        id=episode_id,
        name=episode_data.get("name"),
        show=show,
        release_date=episode_data.get("release_date"),
    )
    db.add(episode)
    db.flush() 
    return episode

def get_or_create_show(show_data, db):
    show_id = show_data.get("id")
    if not show_id:
        return None
    show = db.get(Show, show_id)
    if show:
        return show
    show = Show(id=show_id, name=show_data.get("name"))
    db.add(show)
    return show

def load_user_cache(user_id):
    db = SessionLocal()
    
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        db.close()
        return None

    saved_songs = [track.id for track in user.saved_tracks]
    
    playlists = {}
    for playlist in user.playlists:
        playlists[playlist.id] = {
            "name": playlist.name,
            "tracks": [track.id for track in playlist.tracks]
        }

    db.close()
    return {
        "saved_songs": saved_songs,
        "playlists": playlists
    }

def start_playback_with_queue(sp, track_uris, device_id, queue_scheduler, user_id):
    sp.start_playback(uris=[f"spotify:track:{track_uris[0]}"], device_id=device_id)

    db = SessionLocal()
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        db.close()
        raise Exception("user not found")

    user.curr_index = 1
    db.commit()
    db.close()

    reset_scheduler(queue_scheduler)
    from datetime import datetime
    queue_scheduler.add_job(
        func=check_queue,
        args=[sp, track_uris, device_id, user_id],
        trigger="interval",
        seconds=60,
        next_run_time=datetime.now()
    )

def check_queue(sp, track_uris, device_id, user_id):
    print("checking queue :)")
    db = SessionLocal()
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        db.close()
        return

    curr_index = user.curr_index
    current_queue = sp.queue()
    queue_length = len(current_queue.get("queue", [])) + 1

    while queue_length < 50 and curr_index < len(track_uris):
        sp.add_to_queue(uri=f"spotify:track:{track_uris[curr_index]}", device_id=device_id)
        curr_index += 1
        queue_length += 1

    user.curr_index = curr_index
    db.commit()
    db.close()
    
# bundles helpers
import requests
def play_immediately(token, track_id):
    headers = {'Authorization': f'Bearer {token}'}
    data = {"uris": [f"spotify:track:{track_id}"]}
    requests.put('https://api.spotify.com/v1/me/player/play', json=data, headers=headers)

def skip_current(token):
    headers = {'Authorization': f'Bearer {token}'}
    requests.post('https://api.spotify.com/v1/me/player/next', headers=headers)

def queue_bundle(token, track_id):
    headers = {'Authorization': f'Bearer {token}'}
    requests.post(
        'https://api.spotify.com/v1/me/player/queue',
        params={'uri': f'spotify:track:{track_id}'},
        headers=headers
    )
    
def apply_bundles(track_ids: list[str], bundles: list[Bundle]) -> list[str]:
    new_queue = []
    seen_bundles = set()

    for track_id in track_ids:
        # find next bundle that matches current track
        bundle = next((
            b for b in bundles
            if b.id not in seen_bundles and (
                (b.strict and (b.intro_song_id == track_id or b.main_song_id == track_id)) or
                (not b.strict and b.intro_song_id == track_id)
            )
        ), None)

        if bundle:
            seen_bundles.add(bundle.id)

            if bundle.strict:
                # always intro then main regardless of current track
                new_queue.append(bundle.intro_song_id)
                new_queue.append(bundle.main_song_id)
            else:
                # not strict, if current is intro, add intro + main
                # if current is main, just add main
                if track_id == bundle.intro_song_id:
                    new_queue.append(bundle.intro_song_id)
                    new_queue.append(bundle.main_song_id)
                else:
                    new_queue.append(track_id)
        else:
            new_queue.append(track_id)

    return new_queue

def get_curr(token):
    headers = {
        'Authorization': f'Bearer {token}'
    }
    response = requests.get('https://api.spotify.com/v1/me/player/currently-playing', headers=headers)

    if response.status_code != 200:
        return None  

    data = response.json()
    item = data.get('item')
    if not item:
        return None

    return {
        'id': item['id'],
        'name': item['name'],
        'artists': [artist['name'] for artist in item['artists']],
        'uri': item['uri']
    }
    
def get_playlists(sp):
    playlists = []
    results = sp.current_user_playlists()
    playlists.extend(results['items'])
    while results['next']:
        results = sp.next(results)
        playlists.extend(results['items'])
    return playlists  
    
def get_songs(sp, playlist_id):
    items = []
    results = sp.playlist_tracks(playlist_id)
    items.extend(results['items'])
    while results['next']:
        results = sp.next(results)
        items.extend(results['items'])
    
    return [item.get('track') or item.get('episode') for item in items if (item.get('track') or item.get('episode'))]

def get_saved_songs(sp):
    track_items = []
    results = sp.current_user_saved_tracks()
    track_items.extend(results['items'])
    while results['next']:
        results = sp.next(results)
        track_items.extend(results['items'])
    return [t['track'] for t in track_items if t['track']]

def get_bundles(user_id: str, db_session):
    user = db_session.query(User).filter_by(id=user_id).first()
    if not user:
        return []

    bundles = []
    for bundle in user.bundles:
        bundles.append({
            "intro_song_id": bundle.intro_song_id,
            "main_song_id": bundle.main_song_id,
            "strict": bundle.strict
        })
    return bundles

def serialize_track(track):
        return {
            "id": track["id"],
            "name": track["name"],
            "artists": [
                {"id": a["id"], "name": a["name"]} for a in track["artists"]
            ],
        }

# search helpers
def get_tracks_by_release_year(db, start_year: int, end_year: int):
    return (
        db.query(Track)
        .join(Track.album)
        .filter(Album.release_date >= f"{start_year}-01-01")
        .filter(Album.release_date <= f"{end_year}-12-31")
        .all()
    )
    
def get_tracks_by_name(db, name: str):
    return (
        db.query(Track)
        .filter(Track.name.ilike(f"%{name}%"))
        .all()
    )

def get_tracks_by_artists(db, artist_names: list[str]):
    return (
        db.query(Track)
        .join(Track.artists)
        .filter(Artist.name.in_(artist_names))
        .all()
    )
    
def get_tracks_by_genres(session, genre_list: list[str]):
    return (
        session.query(Track)
        .join(Track.artists)
        .join(Artist.genres)
        .filter(Genre.name.in_(genre_list))
        .all()
    )

def reset_scheduler(queue_scheduler):
    if queue_scheduler.running:
        queue_scheduler.remove_all_jobs()
    else:
        queue_scheduler.start()
