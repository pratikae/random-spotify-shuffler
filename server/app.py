import os
from flask import Flask
from dotenv import load_dotenv
from apscheduler.schedulers.background import BackgroundScheduler
from spotipy.oauth2 import SpotifyOAuth
from database import init_db
from routes import routes
from scheduler import queue_scheduler 

load_dotenv()
init_db()

app = Flask(__name__)

from flask_cors import CORS
CORS(app)
CORS(routes)

app.sp_oauth = SpotifyOAuth(
    scope="user-read-playback-state user-modify-playback-state playlist-read-private user-library-read",
    client_id=os.getenv("SPOTIPY_CLIENT_ID"),
    client_secret=os.getenv("SPOTIPY_CLIENT_SECRET"),
    redirect_uri=os.getenv("SPOTIPY_REDIRECT_URI")
)

queue_scheduler.start()

app.register_blueprint(routes)

if __name__ == "__main__":
    app.run(port=8888, debug=True)
