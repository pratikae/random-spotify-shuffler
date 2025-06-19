import os
from flask import Flask
from dotenv import load_dotenv
from apscheduler.schedulers.background import BackgroundScheduler
from spotipy.oauth2 import SpotifyOAuth
from database import init_db
from routes import routes

load_dotenv()
init_db()

app = Flask(__name__)

app.sp_oauth = SpotifyOAuth(
    scope="user-read-playback-state user-modify-playback-state playlist-read-private user-library-read",
    client_id=os.getenv("SPOTIPY_CLIENT_ID"),
    client_secret=os.getenv("SPOTIPY_CLIENT_SECRET"),
    redirect_uri=os.getenv("SPOTIPY_REDIRECT_URI")
)

app.queue_scheduler = BackgroundScheduler()
app.queue_scheduler.start()

app.register_blueprint(routes)

if __name__ == "__main__":
    app.run(port=8888, debug=True)
