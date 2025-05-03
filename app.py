import os
import random
from flask import Flask, request, redirect
from spotipy.oauth2 import SpotifyOAuth
import spotipy
from dotenv import load_dotenv

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

@app.route("/callback")
def callback():
    code = request.args.get("code")
    token_info = sp_oauth.get_access_token(code)
    sp = spotipy.Spotify(auth=token_info['access_token'])

    user__choice = input("enter 1 to choose a playlist from your library, 2 for a random playlist: ")

    if user__choice == "1":
        playlist_name, playlist_id = user_choice_playlist(get_playlists(sp))
        while playlist_name == None:
            playlist_name, playlist_id = user_choice_playlist(get_playlists(sp))
        track_uris = get_songs(sp, playlist_id)
    else:
        playlist_name, playlist_id = get_random_playlist(sp)
        track_uris = get_songs(sp, playlist_id)

    random.shuffle(track_uris)

    sp.start_playback(uris=track_uris)

    return "randomly shuffling " + playlist_name
    

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

    track_uris = [t['track']['uri'] for t in track_items if t['track']]
    return track_uris
    

if __name__ == "__main__":
    app.run(port=8888, debug=True)