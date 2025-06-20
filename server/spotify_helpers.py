import random
import json
from database import SessionLocal, User, Playlist, Track, Album, Artist, saved_track_table, playlist_track_table, track_artist_table
from sqlalchemy.orm.exc import NoResultFound

def cache_user(sp, user_id):
    db = SessionLocal()
    
    # first check if user exists, create user if not
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        user = User(id=user_id)
        db.add(user)
        db.commit()
        
    # add user data to database tables
    saved_tracks = get_saved_songs(sp)
    playlists_data = get_playlists(sp)

    for item in saved_tracks:
        track = get_or_create_track(item, db)
        if track not in user.saved_tracks:
            user.saved_tracks.append(track)
    
    for playlist_obj in playlists_data.values():
        playlist_id = playlist_obj["id"]
        playlist = db.query(Playlist).filter_by(id=playlist_id).first()
        if not playlist:
            playlist = Playlist(id=playlist_id, name=playlist_obj["name"], user=user)
            db.add(playlist)

        playlist_tracks = get_songs(sp, playlist_id)
        for track_data in playlist_tracks:
            track = get_or_create_track(track_data, db)
            if track not in playlist.tracks:
                playlist.tracks.append(track)

    db.commit()
    db.close()
    
def get_or_create_album(album_data, db):
    album = db.query(Album).filter_by(id=album_data["id"]).first()
    if not album:
        album = Album(
            id=album_data["id"],
            name=album_data["name"],
            release_date=album_data["release_date"],
            artists=", ".join(artist["name"] for artist in album_data["artists"])
        )
        db.add(album)
    return album

def get_or_create_artist(artist_data, db):
    artist = db.query(Artist).filter_by(id=artist_data["id"]).first()
    if not artist:
        artist = Artist(id=artist_data["id"], name=artist_data["name"])
        db.add(artist)
    return artist

def get_or_create_track(track_data, db):
    track = db.query(Track).filter_by(id=track_data["id"]).first()
    if not track:
        album = get_or_create_album(track_data["album"], db)
        track = Track(
            id=track_data["id"],
            name=track_data["name"],
            album=album
        )
        db.add(track)
        for artist_data in track_data["artists"]:
            artist = get_or_create_artist(artist_data, db)
            track.artists.append(artist)
    return track

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
    sp.start_playback(uris=[track_uris[0]], device_id=device_id)

    db = SessionLocal()
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        db.close()
        raise Exception("user not found")

    user.curr_index = 1
    db.commit()
    db.close()

    reset_scheduler(queue_scheduler)
    queue_scheduler.add_job(
        func=check_queue,
        args=[sp, track_uris, device_id, user_id],
        trigger="interval",
        seconds=60
    )

def check_queue(sp, track_uris, device_id, user_id):
    db = SessionLocal()
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        db.close()
        return

    curr_index = user.curr_index
    current_queue = sp.queue()
    queue_length = len(current_queue.get("queue", [])) + 1

    while queue_length < 50 and curr_index < len(track_uris):
        sp.add_to_queue(uri=track_uris[curr_index], device_id=device_id)
        curr_index += 1
        queue_length += 1

    user.curr_index = curr_index
    db.commit()
    db.close()
    
def get_playlists(sp):
    playlists = []
    results = sp.current_user_playlists()
    playlists.extend(results['items'])
    while results['next']:
        results = sp.next(results)
        playlists.extend(results['items'])
    playlists_dict = dict(enumerate(playlists))
    return playlists_dict
    
def get_songs(sp, playlist_id):
    track_items = []
    results = sp.playlist_tracks(playlist_id)
    track_items.extend(results['items'])
    while results['next']:
        results = sp.next(results)
        track_items.extend(results['items'])
    return [t['track'] for t in track_items if t['track']]

def get_saved_songs(sp):
    track_items = []
    results = sp.current_user_saved_tracks()
    track_items.extend(results['items'])
    while results['next']:
        results = sp.next(results)
        track_items.extend(results['items'])
    return [t['track'] for t in track_items if t['track']]

def reset_scheduler(queue_scheduler):
    if queue_scheduler.running:
        queue_scheduler.remove_all_jobs()
    else:
        queue_scheduler.start()
