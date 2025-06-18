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
    print(device_id)

    user__choice = 0
    while user__choice != "1" and user__choice != "2" and user__choice != "3":
        user__choice = input("enter 1 for liked songs, 2 to choose a playlist from your library, 3 for a random playlist: ")
        if user__choice != "1" and user__choice != "2" and user__choice != "3":
            print("thats not a valid choice, dummy \n")

    if user__choice == "1":
        print("loading")
        track_uris = get_saved_songs(sp)
        playlist_name = "liked songs"
    elif user__choice == "2":
        print("loading")
        playlist_name, playlist_id = user_choice_playlist(get_playlists(sp))
        while playlist_name is None:
            playlist_name, playlist_id = user_choice_playlist(get_playlists(sp))
        track_uris = get_songs(sp, playlist_id)
    elif user__choice == "3":
        print("loading")
        playlist_name, playlist_id = get_random_playlist(sp)
        track_uris = get_songs(sp, playlist_id)

    random.shuffle(track_uris)

    return start_playback_with_queue(sp, track_uris=track_uris, device_id=device_id, playlist_name=playlist_name, queue_scheduler=queue_scheduler)

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
        seconds=15
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
    playlists = get_playlists(sp)
    if not playlists:
        return None, [], None

    playlist = random.choice(playlists)
    playlist_id = playlist['id']
    playlist_name = playlist['name']

    return playlist_name, playlist_id

def user_choice_playlist(playlists_dict: dict):
    print_playlists(playlists_dict)
    choice = int(input("enter the number of the playlist you want: "))
    if choice in playlists_dict:
        selected = playlists_dict[choice]
        return selected['name'], selected['id']
    else:
        print("this playlist doesn't exist, silly")
        return None, None
    
def print_playlists(playlists_dict):
    print()
    for index, playlist in playlists_dict.items():
        print(f"{index}: {playlist['name']}")

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