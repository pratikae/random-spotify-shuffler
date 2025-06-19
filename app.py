import os
import random
from flask import Flask, request, redirect
from spotipy.oauth2 import SpotifyOAuth
import spotipy
from dotenv import load_dotenv
import time
from apscheduler.schedulers.background import BackgroundScheduler

load_dotenv()

app = Flask(__name__)

sp_oauth = SpotifyOAuth(
    scope="user-read-playback-state user-modify-playback-state playlist-read-private user-library-read",
    client_id=os.getenv("SPOTIPY_CLIENT_ID"),
    client_secret=os.getenv("SPOTIPY_CLIENT_SECRET"),
    redirect_uri=os.getenv("SPOTIPY_REDIRECT_URI")
)

@app.route("/")
def login():
    auth_url = sp_oauth.get_authorize_url()
    return redirect(auth_url)

queue_scheduler = BackgroundScheduler()

@app.route("/callback")
def callback():
    code = request.args.get("code")
    token_info = sp_oauth.get_access_token(code)
    sp = spotipy.Spotify(auth=token_info['access_token'])

    device_id = sp.devices()['devices'][0]['id']
    cache_permission = 0
    cache_permission = input("do you give us permission to cache your spotify playlists and songs? yes, enter 1. no, enter anything else: ")
    if cache_permission == "1":
        cache_user(sp)
    else:
        return("user did not give permision to cache, unable to shuffle")

    user_choice = input("would you like to shuffle? 1 if yes, 0 if no: ")
    while user_choice != 0:
        shuffle_choice = 0
        while shuffle_choice != "1" and shuffle_choice != "2" and shuffle_choice != "3":
            shuffle_choice = input("enter 1 for liked songs, 2 to choose a playlist from your library, 3 for a random playlist: ")
            if shuffle_choice != "1" and shuffle_choice != "2" and shuffle_choice != "3":
                print("thats not a valid choice, dummy \n")
        
        if shuffle_choice == "1":
            track_uris = user_cache["saved_songs"]
            playlist_name = "liked songs"
        elif shuffle_choice == "2":
            playlist_name, playlist_id = user_choice_playlist()
            while playlist_name is None:
                playlist_name, playlist_id = user_choice_playlist()
            track_uris = user_cache["playlists"][playlist_id]["tracks"]
        elif shuffle_choice == "3":
            playlist_id = random.choice(list(user_cache["playlists"].keys()))
            playlist_name = user_cache["playlists"][playlist_id]["name"]
            track_uris = user_cache["playlists"][playlist_id]["tracks"]

        random.shuffle(track_uris)

        start_playback_with_queue(sp, track_uris=track_uris, device_id=device_id, playlist_name=playlist_name, queue_scheduler=queue_scheduler)
        print("must wait 60 seconds so you don't get rate limited")
        time.sleep(60)
        user_choice = input("shuffle again? 1 if yes, 0 if no: ")

    return("thank you!")

user_cache = {
    "saved_songs": [],
    "playlists": {}
}

def cache_user(sp: spotipy.Spotify):
    global user_cache
    print("caching your songs/playlists, this may take a while...")
    user_cache["saved_songs"] = get_saved_songs(sp)
    
    playlists_dict = get_playlists(sp)
    for i, playlist in playlists_dict.items():
        playlist_id = playlist["id"]
        playlist_name = playlist["name"]
        track_uris = get_songs(sp, playlist_id)

        user_cache["playlists"][playlist_id] = {
            "name": playlist_name,
            "tracks": track_uris
        }

def reset_scheduler():
    if queue_scheduler.running:
        queue_scheduler.remove_all_jobs()
    else:
        queue_scheduler.start()

curr_index = 0

def start_playback_with_queue(sp: spotipy.Spotify, track_uris, device_id, playlist_name, queue_scheduler):
    continue_true = 0
    while (continue_true != "1"):
        continue_true = input("please clear queue before proceding, enter 1 once you are ready: ")
    
    sp.start_playback(uris=[track_uris[0]], device_id=device_id)
    global curr_index
    curr_index = 1
    for track_uri in track_uris[1:51]:
        sp.add_to_queue(uri=track_uri, device_id=device_id)
        curr_index += 1

    reset_scheduler()
    queue_scheduler.add_job(
        func=check_queue,   
        args=[sp, track_uris, device_id],
        trigger="interval",
        seconds=60
    )

    return f"randomly shuffling {playlist_name}"

def check_queue(sp: spotipy.Spotify, track_uris, device_id):
    global curr_index
    current_queue = sp.queue()
    queue_length = len(current_queue.get("queue", [])) + 1

    while queue_length < 50 and curr_index < len(track_uris):
        sp.add_to_queue(uri=track_uris[curr_index], device_id=device_id)
        curr_index += 1
        queue_length += 1
        
def get_random_playlist(sp: spotipy.Spotify):
    global user_playlists_cache

    playlist = random.choice(user_playlists_cache)
    playlist_id = playlist['id']
    playlist_name = playlist['name']

    return playlist_name, playlist_id

def user_choice_playlist():
    playlist_ids = list(user_cache["playlists"].keys())

    print_playlists()

    choice = int(input("Enter the number of the playlist you want: "))
    if 0 <= choice < len(playlist_ids):
        selected_id = playlist_ids[choice]
        selected = user_cache["playlists"][selected_id]
        return selected["name"], selected_id
    else:
        print("this playlist doesn't exist, silly")
        return None, None
    
def print_playlists():
    print()
    playlist_ids = list(user_cache["playlists"].keys())
    for i, pid in enumerate(playlist_ids):
        playlist = user_cache["playlists"][pid]
        name = playlist["name"]
        num_songs = len(playlist["tracks"])
        print(f"{i}: {name} ({num_songs} songs)")

def get_playlists(sp: spotipy.Spotify):
    playlists = []
    results = sp.current_user_playlists()
    playlists.extend(results['items'])
    while results['next']:
        results = sp.next(results)
        playlists.extend(results['items'])

    playlists_dict = dict(enumerate(playlists))
    return playlists_dict

def get_songs(sp: spotipy.Spotify, playlist_id: str):
    track_items = []
    results = sp.playlist_tracks(playlist_id)
    track_items.extend(results['items'])

    while results['next']:
        results = sp.next(results)
        track_items.extend(results['items'])

    return [t['track']['uri'] for t in track_items if t['track']]

def get_saved_songs(sp: spotipy.Spotify):
    track_items = []
    results = sp.current_user_saved_tracks()
    track_items.extend(results['items'])

    while results['next']:
        results = sp.next(results)
        track_items.extend(results['items'])

    return [t['track']['uri'] for t in track_items if t['track']]
    
if __name__ == "__main__":
    app.run(port=8888, debug=True)