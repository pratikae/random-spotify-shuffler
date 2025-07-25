import random
import json
from flask import jsonify
from database import SessionLocal, User, Playlist, Track, Album, Artist, PodcastEpisode, Show, Bundle, Genre
from sqlalchemy.orm.exc import NoResultFound

def cache_liked_songs(sp, user_id):
    db = SessionLocal()
    
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        user = User(id=user_id)
        db.add(user)
        db.commit()
        
    saved_tracks = get_saved_songs(sp)

    for item in saved_tracks:
        track = get_or_create_track(item, db)
        if track not in user.saved_tracks:
            user.saved_tracks.append(track)

    db.commit()
    db.close()

import threading
def cache_playlists_async(sp, user_id):
    def worker():
        db = SessionLocal()
        user = db.query(User).filter_by(id=user_id).first()
        if not user:
            db.close()
            return

        playlists_data = get_playlists(sp)
        
        for playlist_obj in playlists_data:
            playlist_id = playlist_obj["id"]
            playlist = db.query(Playlist).filter_by(id=playlist_id).first()
            if not playlist:
                playlist = Playlist(id=playlist_id, name=playlist_obj["name"], user=user)
                db.add(playlist)
                db.flush() 

            playlist_tracks = get_songs(sp, playlist_id)
            for track_data in playlist_tracks:
                if not track_data or track_data.get("type") != "track":
                    print(f"skipping non-track or malformed item: {track_data}")
                    continue
                if not track_data.get("id"):
                    print(f"skipping track with missing ID: {track_data}")
                    continue

                with db.no_autoflush:
                    track = get_or_create_track(track_data, db)
                    if track and track not in playlist.tracks:
                        playlist.tracks.append(track)

                    
        db.commit()
        db.close()

    threading.Thread(target=worker).start()
    
def get_or_create_album(album_data, db):
    album_id = album_data.get("id")
    if not album_id:
        return None
    
    album = db.get(Album, album_data["id"])
    if not album:
        album = Album(
            id=album_data["id"],
            name=album_data["name"],
            release_date=album_data["release_date"]
        )
        db.add(album)
    return album

def get_or_create_artist(artist_data, db):
    artist = db.get(Artist, artist_data["id"])
    if not artist:
        artist = Artist(id=artist_data["id"], name=artist_data["name"])
        db.add(artist)
        
    if "genres" in artist_data:
        for genre_name in artist_data["genres"]:
            genre = db.query(Genre).filter_by(name=genre_name).first()
            if not genre:
                genre = Genre(name=genre_name)
                db.add(genre)
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
            album=album
        )
        db.add(track)
        for artist_data in track_data.get("artists", []):
            artist = get_or_create_artist(artist_data, db)
            track.artists.append(artist)
        db.flush()
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

def fetch_genres(db):
    genre_names = db.query(Genre.name).distinct().all()
    print("Raw genre names from DB:", genre_names)
    genres = sorted({name for (name,) in genre_names})  # get everything unique genre and sort
    return genres

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
