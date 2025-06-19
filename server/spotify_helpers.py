import random
import json
from database import SessionLocal, UserCache

# need to rewrite these to account for new database structure

def cache_user(sp, user_id):
    db = SessionLocal()
    saved_songs = get_saved_songs(sp)
    playlists_dict = get_playlists(sp)

    cached_playlists = {}
    for i, playlist in playlists_dict.items():
        playlist_id = playlist["id"]
        playlist_name = playlist["name"]
        track_uris = get_songs(sp, playlist_id)
        cached_playlists[playlist_id] = {
            "name": playlist_name,
            "tracks": track_uris
        }

    user_cache = db.query(UserCache).filter(UserCache.user_id == user_id).first()
    if not user_cache:
        user_cache = UserCache(user_id=user_id)

    user_cache.playlists = cached_playlists
    user_cache.saved_songs = saved_songs
    user_cache.curr_index = 0

    db.add(user_cache)
    db.commit()
    db.close()

def load_user_cache(user_id):
    db = SessionLocal()
    user_cache = db.query(UserCache).filter(UserCache.user_id == user_id).first()
    db.close()
    if not user_cache:
        return None

    playlists = user_cache.playlists
    saved_songs = user_cache.saved_songs
    return {
        "playlists": playlists,
        "saved_songs": saved_songs
    }

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
    return [t['track']['uri'] for t in track_items if t['track']]

def get_saved_songs(sp):
    track_items = []
    results = sp.current_user_saved_tracks()
    track_items.extend(results['items'])
    while results['next']:
        results = sp.next(results)
        track_items.extend(results['items'])
    return [t['track']['uri'] for t in track_items if t['track']]

def start_playback_with_queue(sp, track_uris, device_id, queue_scheduler, user_id):
    sp.start_playback(uris=[track_uris[0]], device_id=device_id)

    db = SessionLocal()
    user_cache = db.query(UserCache).filter_by(user_id=user_id).first()
    if not user_cache:
        db.close()
        raise Exception("user cache not found")

    user_cache.curr_index = 1
    db.commit()
    db.close()

    reset_scheduler(queue_scheduler)
    queue_scheduler.add_job(
        func=check_queue,
        args=[sp, track_uris, device_id, user_id],
        trigger="interval",
        seconds=60
    )

def reset_scheduler(queue_scheduler):
    if queue_scheduler.running:
        queue_scheduler.remove_all_jobs()
    else:
        queue_scheduler.start()

def check_queue(sp, track_uris, device_id, user_id):
    db = SessionLocal()
    user_cache = db.query(UserCache).filter_by(user_id=user_id).first()
    if not user_cache:
        db.close()
        return

    curr_index = user_cache.curr_index
    current_queue = sp.queue()
    queue_length = len(current_queue.get("queue", [])) + 1

    while queue_length < 50 and curr_index < len(track_uris):
        sp.add_to_queue(uri=track_uris[curr_index], device_id=device_id)
        curr_index += 1
        queue_length += 1

    user_cache.curr_index = curr_index
    db.commit()
    db.close()
